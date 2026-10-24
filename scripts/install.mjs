import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skillFiles } from './package-skill.mjs';
import { hash,json,safePath } from '../src/fs.mjs';

const marker='.harness-kit-install.json';
const shQuote=text=>`'${text.replaceAll("'","'\\''")}'`;
export function launchers(entry,bun=process.execPath,platform=process.platform) {
  if(platform==='win32') {
    if(/["%\r\n]/.test(entry+bun))throw new Error('Windows install path contains unsupported command characters');
    return new Map(['harness','harness-kit'].map(name=>[`${name}.cmd`,Buffer.from(`@echo off\r\n"${bun}" "${entry}" %*\r\nexit /b %ERRORLEVEL%\r\n`)]));
  }
  return new Map(['harness','harness-kit'].map(name=>[name,Buffer.from(`#!/bin/sh\nexec ${shQuote(bun)} ${shQuote(entry)} "$@"\n`)]));
}
export async function install({binDir,skillDir,dryRun=false}={}) {
  if(!globalThis.Bun)throw new Error('Install using Bun');
  binDir=path.resolve(binDir??path.join(process.env.BUN_INSTALL??path.join(os.homedir(),'.bun'),'bin'));
  skillDir=path.resolve(skillDir??path.join(process.env.CODEX_HOME??path.join(os.homedir(),'.codex'),'skills/harness-kit'));
  const files=await skillFiles(), shims=launchers(path.join(skillDir,'scripts/harness.mjs'));
  const stateFile=path.join(skillDir,marker);
  // Probe every ancestor; installation must not follow an existing symlink to an unrelated destination.
  for(const directory of [binDir,skillDir]) {
    const volume=path.parse(directory).root;
    safePath(volume,path.relative(volume,directory).replaceAll(path.sep,'/'));
  }
  if(fs.existsSync(skillDir))safePath(skillDir,marker);
  const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
  if(state&&(state.owner!=='harness-kit'||state.version!==1))throw new Error('Unknown installation marker');
  const pending=[];
  for(const [dir,entries,previous] of [[skillDir,files,state?.skillFiles],[binDir,shims,state?.launchers]]) {
    for(const [name,bytes] of entries) {
      const target=path.join(dir,name);
      if(fs.existsSync(dir))safePath(dir,name);
      const current=fs.existsSync(target)?fs.readFileSync(target):null;
      if(current&&hash(current)!==hash(bytes)&&hash(current)!==previous?.[name])throw new Error(`Preserving existing/unowned or modified file: ${target}`);
      pending.push({target,bytes,before:current});
    }
  }
  const next={owner:'harness-kit',version:1,skillFiles:Object.fromEntries([...files].map(([n,b])=>[n,hash(b)])),launchers:Object.fromEntries([...shims].map(([n,b])=>[n,hash(b)]))};
  pending.push({target:stateFile,bytes:Buffer.from(json(next)),before:fs.existsSync(stateFile)?fs.readFileSync(stateFile):null});
  const changed=pending.filter(f=>!f.before||!f.before.equals(f.bytes));
  const pathPresent=(process.env.PATH??'').split(path.delimiter).some(p=>path.resolve(p).toLowerCase()===binDir.toLowerCase());
  const result={status:dryRun?'preview':'installed',binDir,skillDir,commands:[...shims.keys()],changed:changed.map(f=>f.target),pathPresent,notice:pathPresent?'在项目中运行 harness；在新会话中使用 $harness-kit。':`请把 ${binDir} 加到 PATH；本工具不会修改 shell profile 或系统 PATH。`};
  if(dryRun)return result;
  const written=[];
  try {
    for(const f of changed) {
      fs.mkdirSync(path.dirname(f.target),{recursive:true});
      const current=fs.existsSync(f.target)?fs.readFileSync(f.target):null;
      if((current===null)!==(f.before===null)||current&&!current.equals(f.before))throw new Error(`Install destination changed: ${f.target}`);
      fs.writeFileSync(f.target,f.bytes);written.push(f);
    }
    if(process.platform!=='win32')for(const name of shims.keys())fs.chmodSync(path.join(binDir,name),0o755);
  }catch(error){
    for(const f of written.reverse())if(fs.existsSync(f.target)&&hash(fs.readFileSync(f.target))===hash(f.bytes)) {
      if(f.before)fs.writeFileSync(f.target,f.before);else fs.unlinkSync(f.target);
    }
    throw error;
  }
  return result;
}
if(import.meta.main) {
  try {
    const options={},args=process.argv.slice(2);
    while(args.length){const flag=args.shift();if(flag==='--dry-run')options.dryRun=true;else if(['--bin-dir','--skill-dir'].includes(flag)){const value=args.shift();if(!value||value.startsWith('--'))throw new Error(`Missing ${flag}`);options[flag==='--bin-dir'?'binDir':'skillDir']=value;}else throw new Error(`Unknown option: ${flag}`);}
    console.log(json(await install(options)));
  }catch(error){console.error(error.message);process.exitCode=2;}
}
