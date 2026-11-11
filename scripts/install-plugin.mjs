#!/usr/bin/env node
// Standalone release installer. No imports from the source checkout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const hosts=['codex','claude','dsh','skill'];
const marker='.harness-link-install.json';
function safeAbsolute(target) {
  target=path.resolve(target);
  let cursor=path.parse(target).root;
  for(const part of path.relative(cursor,target).split(path.sep).filter(Boolean)) {
    if(/[\x00-\x1f:*?"<>|]/.test(part)||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))throw new Error('Unsafe installation path');
    cursor=path.join(cursor,part);
    try {if(fs.lstatSync(cursor).isSymbolicLink())throw new Error('Installation path contains a symlink/junction');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return target;
}
function relative(name) {
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f:*?"<>|]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw new Error(`Unsafe archive path: ${name}`);
  return name;
}
export function unpackZip(input) {
  const bytes=Buffer.from(input),files=new Map(),names=new Set();let total=0;
  let end=bytes.length-22;
  while(end>=Math.max(0,bytes.length-65557)&&bytes.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0||end<bytes.length-65557||end+22+bytes.readUInt16LE(end+20)!==bytes.length)throw new Error('Invalid ZIP end');
  const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16);
  if(bytes.readUInt32LE(end+4)!==0||bytes.readUInt16LE(end+8)!==count||count===65535||offset+bytes.readUInt32LE(end+12)!==end)throw new Error('Unsupported multipart/ZIP64 archive');
  for(let i=0;i<count;i++) {
    if(offset+46>end||bytes.readUInt32LE(offset)!==0x02014b50)throw new Error('Invalid ZIP directory');
    const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),size=bytes.readUInt32LE(offset+24),compressed=bytes.readUInt32LE(offset+20);
    const length=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),mode=bytes.readUInt32LE(offset+38)>>>16;
    const name=relative(bytes.subarray(offset+46,offset+46+length).toString('utf8'));
    if(flags&1||![0,8].includes(method)||((mode&0xf000)!==0&&(mode&0xf000)!==0x8000)||names.has(name.toLowerCase())||size>32*1024*1024||(total+=size)>96*1024*1024)throw new Error('Unsafe or oversized ZIP entry');
    names.add(name.toLowerCase());const start=bytes.readUInt32LE(offset+42);
    if(start+30>offset||bytes.readUInt32LE(start)!==0x04034b50)throw new Error('Invalid ZIP local header');
    const data=start+30+bytes.readUInt16LE(start+26)+bytes.readUInt16LE(start+28);
    if(data+compressed>offset)throw new Error('Invalid ZIP entry bounds');
    const packed=bytes.subarray(data,data+compressed),content=method===0?Buffer.from(packed):inflateRawSync(packed,{maxOutputLength:32*1024*1024});
    if(content.length!==size)throw new Error('Invalid ZIP entry size');
    files.set(name,content);offset+=46+length+extra+comment;
  }
  if(offset!==end)throw new Error('Unexpected ZIP directory data');
  // Refuse file/directory collisions before creating any files.
  for(const name of names)for(let dir=path.posix.dirname(name);dir!=='.';dir=path.posix.dirname(dir))if(names.has(dir))throw new Error('ZIP file/directory collision');
  return files;
}
export function defaultLocation(host,env=process.env,home=os.homedir()) {
  if(host==='skill')return path.resolve(home,'.agents','skills','harness-kit');
  return path.resolve(env.LOCALAPPDATA??path.join(home,'.local','share'),'harness-kit','plugins',host);
}
export function releaseEndpoint(source) {
  const url=new URL(source);
  if(url.protocol!=='https:'||url.hostname!=='github.com'||url.username||url.password||url.search||url.hash)throw new Error('Use a GitHub repository, Release or release ZIP HTTPS link');
  const parts=url.pathname.split('/').filter(Boolean),[owner,repo]=parts;
  if(!owner||!repo||!parts.every(p=>/^[\w.%+-]+$/.test(p)))throw new Error('Invalid GitHub link');
  let tag;
  if(parts.length===2||(parts.length===3&&parts[2]==='releases')||(parts[2]==='releases'&&parts[3]==='latest'&&parts.length===4)){}
  else if(parts[2]==='releases'&&['tag','download'].includes(parts[3])&&parts[4])tag=parts[4];
  else if(parts[2]==='blob'&&parts.length>=5){} // README/installation document links resolve the current published release.
  else throw new Error('Unsupported GitHub link; use repository or Release URL');
  return {api:`https://api.github.com/repos/${owner}/${repo}/releases/${tag?'tags/'+tag:'latest'}`,repository:`${owner}/${repo}`};
}
async function getBytes(url,limit,fetcher) {
  const response=await fetcher(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'harness-kit-installer'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Download failed (${response.status}): ${url}`);
  if(Number(response.headers.get('content-length'))>limit)throw new Error('Download exceeds limit');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Download exceeds limit');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
export async function loadPackage(source,host,fetcher=fetch) {
  const kind=host==='skill'?'skill':host==='dsh'?'dsh':'marketplace';
  let names,read,origin;
  if(fs.existsSync(source)&&fs.statSync(source).isDirectory()) {
    const directory=safeAbsolute(source);names=fs.readdirSync(directory);
    read=async name=>fs.readFileSync(safeAbsolute(path.join(directory,name)));origin=directory;
  } else {
    const endpoint=releaseEndpoint(source),release=JSON.parse((await getBytes(endpoint.api,2*1024*1024,fetcher)).toString('utf8'));
    if(release.draft||!Array.isArray(release.assets))throw new Error('Release is not available');
    const assets=new Map(release.assets.map(a=>[a.name,a.browser_download_url]));names=[...assets.keys()];
    read=async name=>{
      const url=assets.get(name);
      if(typeof url!=='string'||!url.startsWith(`https://github.com/${endpoint.repository}/releases/download/`))throw new Error('Release asset URL does not match repository');
      return getBytes(url,name==='SHA256SUMS'?65536:40*1024*1024,fetcher);
    };origin=endpoint.repository+'@'+release.tag_name;
  }
  const archives=names.filter(n=>new RegExp(`^harness-kit-${kind}-[0-9][\\w.+-]*\\.zip$`).test(n));
  if(archives.length!==1||!names.includes('SHA256SUMS'))throw new Error('Expected one matching release ZIP and SHA256SUMS');
  const archive=archives[0],sums=(await read('SHA256SUMS')).toString('utf8');
  const matching=sums.split(/\r?\n/).map(l=>/^([a-f\d]{64})\s+\*?(.+)$/.exec(l.trim())).filter(m=>m&&m[2]===archive);
  if(matching.length!==1)throw new Error('Missing or duplicate archive checksum');
  const bytes=await read(archive),checksum=sha(bytes);
  if(checksum!==matching[0][1].toLowerCase())throw new Error('Archive SHA-256 mismatch');
  const files=unpackZip(bytes),prefix=kind==='marketplace'?'marketplace/':'harness-kit/';
  if([...files.keys()].some(n=>!n.startsWith(prefix)))throw new Error('Unexpected archive root');
  const stripped=new Map([...files].map(([n,b])=>[n.slice(prefix.length),b]));
  const skill=kind==='skill'?'':'skills/harness-kit/';
  for(const required of [`${skill}SKILL.md`,`${skill}scripts/harness.mjs`,...(kind==='marketplace'?['.agents/plugins/marketplace.json','.claude-plugin/marketplace.json','plugins/harness-kit/plugin.json']:[])]) {
    // Marketplace's Skill lives below its plugin root.
    const key=kind==='marketplace'&&required.startsWith('skills/')?'plugins/harness-kit/'+required:required;
    if(!stripped.has(key))throw new Error(`Incomplete package: ${key}`);
  }
  if(kind==='dsh'&&!stripped.has('package.json'))throw new Error('Missing DSH manifest');
  return {files:stripped,checksum,origin,archive,kind};
}
export function commandsFor(host,directory,profile) {
  if(host==='codex')return [['codex','plugin','marketplace','add',directory,'--json'],['codex','plugin','add','harness-kit@harness-kit-local','--json']];
  if(host==='claude')return [['claude','plugin','marketplace','add',directory],['claude','plugin','install','harness-kit@harness-kit-local']];
  if(host==='dsh') {
    if(!profile||!/^[\w.-]+$/.test(profile))throw new Error('DSH requires the actual --profile name');
    return [['dsh','plugin','--profile',profile,'add',directory]];
  }
  return [];
}
export function packageRuntime(loaded) {
  const prefix=loaded.kind==='skill'?'':loaded.kind==='marketplace'?'plugins/harness-kit/skills/harness-kit/':'skills/harness-kit/';
  const bytes=loaded.files.get(prefix+'runtime.json');
  const requirements=bytes?JSON.parse(bytes.toString('utf8')):{version:1,anyOf:[{name:'bun',minimum:'1.3.4'}]};
  if(requirements.version!==1||!Array.isArray(requirements.anyOf)||!requirements.anyOf.length||requirements.anyOf.some(r=>!['node','bun'].includes(r.name)||!/^\d+\.\d+\.\d+$/.test(r.minimum)))throw new Error('Invalid package runtime requirements');
  const name=process.versions.bun?'bun':'node',actual=process.versions[name].split('.').map(Number);
  const compatible=requirements.anyOf.some(r=>{const minimum=r.minimum.split('.').map(Number);return r.name===name&&actual.some((v,i)=>v>minimum[i]&&actual.slice(0,i).every((n,j)=>n===minimum[j]))||r.name===name&&actual.every((v,i)=>v===minimum[i]);});
  if(!compatible)throw new Error('Package runtime mismatch: this archive requires '+requirements.anyOf.map(r=>r.name+' >= '+r.minimum).join(' or ')+'. Use that runtime, or a newly built Node-compatible package; existing v0.5.0 archives require Bun.');
  return name;
}
function executable(command,env=process.env) {
  const directories=path.isAbsolute(command)||command.includes('/')||command.includes('\\')?['']:(env.PATH??'').split(path.delimiter).filter(Boolean);
  const extensions=process.platform==='win32'&&!path.extname(command)?['.exe','.com','.cmd','.bat','']:[''];
  for(const directory of directories)for(const extension of extensions){const candidate=path.resolve(directory,command+extension);try{if(fs.statSync(candidate).isFile()){fs.accessSync(candidate,process.platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return candidate;}}catch{}}
  return null;
}

async function executeProcess(argv,{cwd,env=process.env,timeoutMs=60000,signal,maxOutput=32768,windowsVerbatimArguments=false}={}) {
  if(signal?.aborted)return {exitCode:null,reason:'cancelled',stdout:'',stderr:'',output:''};
  const child=spawn(argv[0],argv.slice(1),{cwd,env,windowsHide:true,windowsVerbatimArguments,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  let reason=null,output='';const collected={stdout:'',stderr:''};
  for(const name of ['stdout','stderr']){const decoder=new StringDecoder('utf8');child[name].on('data',chunk=>{const text=decoder.write(chunk);collected[name]=(collected[name]+text).slice(-maxOutput);output=(output+text).slice(-maxOutput);});child[name].on('end',()=>{const text=decoder.end();collected[name]=(collected[name]+text).slice(-maxOutput);output=(output+text).slice(-maxOutput);});}
  function stop(why){
    if(reason)return;reason=why;
    if(child.pid){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:2000});else{try{process.kill(-child.pid,'SIGKILL');}catch{}}}
    try{child.kill('SIGKILL');}catch{}
    child.stdout.destroy();child.stderr.destroy();
  }
  const timer=setTimeout(()=>stop('timeout'),timeoutMs),abort=()=>stop('cancelled');signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try{const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code));});return {exitCode,reason,...collected,output};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export function resolveCommand(command) {
  const resolved=executable(command);
  if(!resolved)throw new Error('Missing host command: '+command);
  if(/\.(cmd|bat)$/i.test(resolved))throw new Error('Use a native executable for '+command+'; its shell shim cannot be safely invoked here');
  return resolved;
}
export async function runCommand(argv) {
  const result=await executeProcess([resolveCommand(argv[0]),...argv.slice(1)]);
  return {exitCode:result.reason==='timeout'?124:result.exitCode,stdout:result.stdout,stderr:result.stderr,timedOut:result.reason==='timeout'};
}

const pathKey=value=>path.resolve(value.replace(/^\\\\\?\\/, '')).replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
async function marketplaceState(host,run) {
  const result=await run([host,'plugin','marketplace','list','--json']);
  if(result.exitCode!==0)throw new Error('Cannot inspect existing marketplaces: '+result.stderr);
  const parsed=JSON.parse(result.stdout),entries=host==='codex'?parsed.marketplaces:parsed;
  if(!Array.isArray(entries))throw new Error('Unsupported marketplace list response');
  return entries.find(e=>e.name==='harness-kit-local');
}
export async function installFromLink(options,{fetcher=fetch,run=runCommand,preflight=resolveCommand}={}) {
  const {source,host,location,dryRun=false,profile}=options;
  if(!hosts.includes(host)||!source)throw new Error('Provide --host codex|claude|dsh|skill and --source <GitHub-link>');
  const suggested=defaultLocation(host);
  if(!location)return {status:'needs-location',defaultLocation:suggested,question:`Install to the default location ${suggested}, or choose another directory?`,choices:['default','custom absolute path'],changed:[]};
  if(location!=='default'&&!path.isAbsolute(location))throw new Error('Custom location must be an absolute path');
  const base=safeAbsolute(location==='default'?suggested:location);
  commandsFor(host,base,profile); // Validate required host options before download or writes.
  if(host!=='skill')preflight(host);
  const loaded=await loadPackage(source,host,fetcher);
  const runtime=packageRuntime(loaded);
  const directory=host==='skill'?base:safeAbsolute(path.join(base,loaded.checksum.slice(0,16)));
  const commands=commandsFor(host,directory,profile);
  if(host==='codex'||host==='claude') {
    const existing=await marketplaceState(host,run);
    if(existing) {
      const existingPath=host==='codex'?existing.root:existing.installLocation;
      if(typeof existingPath!=='string'||pathKey(existingPath)!==pathKey(directory))throw new Error('Existing harness-kit-local marketplace points elsewhere; preserve it and resolve the source conflict first');
      commands.shift(); // Reuse an identical registered source, never overwrite another source.
    }
  }
  const stateFile=path.join(directory,marker);
  if(fs.existsSync(directory)) {
    if(!fs.existsSync(stateFile))throw new Error(`Preserving existing/unowned installation: ${directory}`);
    const state=JSON.parse(fs.readFileSync(safeAbsolute(stateFile),'utf8'));
    if(state.owner!=='harness-kit-link'||state.checksum!==loaded.checksum||state.host!==host)throw new Error('Existing install differs; select a new location');
    for(const [name,bytes] of loaded.files)if(!fs.existsSync(safeAbsolute(path.join(directory,name)))||sha(fs.readFileSync(safeAbsolute(path.join(directory,name))))!==sha(bytes))throw new Error(`Preserving modified installation: ${name}`);
  }
  const result={status:dryRun?'preview':'installed',host,directory,archive:loaded.archive,origin:loaded.origin,checksum:loaded.checksum,runtime,commands,hostRuntime:'not-confirmed',notice:'Confirm Skill discovery in a new session; setup is unnecessary. Host cache locations remain host-managed.'};
  if(dryRun)return result;
  if(!fs.existsSync(directory)) {
    fs.mkdirSync(path.dirname(directory),{recursive:true});
    const staging=directory+'.staging-'+crypto.randomUUID();fs.mkdirSync(staging);
    try {
      for(const [name,bytes] of loaded.files){const target=safeAbsolute(path.join(staging,relative(name)));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
      fs.writeFileSync(path.join(staging,marker),json({owner:'harness-kit-link',host,checksum:loaded.checksum,origin:loaded.origin}));
      if(fs.existsSync(directory))throw new Error('Installation destination changed');
      fs.renameSync(staging,directory);
    } catch(error) {
      if(path.dirname(staging)!==path.dirname(directory)||!path.basename(staging).startsWith(path.basename(directory)+'.staging-'))throw new Error('Unsafe staging cleanup');
      fs.rmSync(staging,{recursive:true,force:true});throw error;
    }
  }
  const completed=[];
  for(const command of commands) {
    let execution;try {execution=await run(command);}catch(error){execution={exitCode:2,stdout:'',stderr:error.message};}
    completed.push({command,...execution});
    if(execution.exitCode!==0)return {...result,status:'partial',failedStep:command,completed,notice:'Files were saved, but host registration is incomplete. Preserve the directory for diagnosis and retry; do not report installation complete.'};
  }
  if(host==='codex'||host==='claude') {
    const command=[host,'plugin','list','--json'];
    let execution;try {execution=await run(command);}catch(error){execution={exitCode:2,stdout:'',stderr:error.message};}
    completed.push({command,...execution});
    let installed;
    try {
      const parsed=JSON.parse(execution.stdout),entries=host==='codex'?parsed.installed:parsed;
      installed=entries.find(e=>(e.pluginId??e.id)==='harness-kit@harness-kit-local'&&e.enabled===true);
    }catch{}
    if(execution.exitCode!==0||!installed)return {...result,status:'partial',completed,notice:'Registration commands ran, but the host did not confirm the plugin is enabled. Inspect plugin status and retry.'};
    return {...result,completed,registration:'confirmed',installedVersion:installed.version};
  }
  return {...result,completed,registration:host==='skill'?'not-applicable':'command-succeeded-profile-restart-required'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  try {
    const options={},args=process.argv.slice(2);
    while(args.length){const flag=args.shift();if(flag==='--dry-run')options.dryRun=true;else if(['--source','--host','--location','--profile'].includes(flag)){const value=args.shift();if(!value||value.startsWith('--'))throw new Error(`Missing ${flag}`);options[flag.slice(2)]=value;}else throw new Error(`Unknown option ${flag}`);}
    const result=await installFromLink(options);console.log(json(result));if(result.status==='partial')process.exitCode=1;
  }catch(error){console.error(json({status:'blocked',error:error.message}));process.exitCode=2;}
}
