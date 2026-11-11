import {test,setDefaultTimeout} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,write} from './helpers.mjs';
import {zipFiles} from '../scripts/archive.mjs';
import {hash} from '../src/fs.mjs';
import {defaultLocation,releaseEndpoint,unpackZip,installFromLink,loadPackage} from '../scripts/install-plugin.mjs';
setDefaultTimeout(30000);

function localRelease(kind='marketplace',entries) {
  const root=fixture();
  const skill=[['SKILL.md',Buffer.from('---\nname: harness-kit\ndescription: example\n---\n')],['scripts/harness.mjs',Buffer.from("console.log('bundle');")]];
  const files=entries??new Map(kind==='marketplace'?[
    ['marketplace/.agents/plugins/marketplace.json',Buffer.from('{}')],
    ['marketplace/.claude-plugin/marketplace.json',Buffer.from('{}')],
    ['marketplace/plugins/harness-kit/plugin.json',Buffer.from('{}')],
    ...skill.map(([n,b])=>['marketplace/plugins/harness-kit/skills/harness-kit/'+n,b]),
  ]:skill.map(([n,b])=>['harness-kit/'+n,b]));
  const name=`harness-kit-${kind}-0.5.0.zip`,bytes=zipFiles(files);
  write(root,name,bytes);write(root,'SHA256SUMS',`${hash(bytes)}  ${name}\n`);
  return {root,name,bytes};
}
test('no location choice returns an actual default and never reads source or invokes host',async()=>{
  let calls=0;
  const result=await installFromLink({source:'https://github.com/example/harness-kit',host:'codex'},{fetcher:()=>{calls++;throw Error();},preflight:()=>{calls++;}});
  assert.equal(result.status,'needs-location');assert.ok(path.isAbsolute(result.defaultLocation));assert.deepEqual(result.changed,[]);assert.equal(calls,0);
  assert.equal(defaultLocation('skill',{},'/tmp/user'),path.resolve('/tmp/user/.agents/skills/harness-kit'));
});
test('release links pin tags, repository links use latest and unsupported sources fail',()=>{
  assert.match(releaseEndpoint('https://github.com/a/b/releases/download/v0.5.0/archive.zip').api,/tags\/v0.5.0$/);
  assert.match(releaseEndpoint('https://github.com/a/b').api,/releases\/latest$/);
  assert.match(releaseEndpoint('https://github.com/a/b/blob/main/INSTALL.md').api,/latest$/);
  assert.throws(()=>releaseEndpoint('https://github.com.evil.invalid/a/b'),/GitHub/);
  assert.throws(()=>releaseEndpoint('https://user:password@github.com/a/b'),/GitHub/);
});
test('custom path preview does not write; install registers with separate argv and retries same bytes',async()=>{
  const release=localRelease(),parent=fixture(),location=path.join(parent,'chosen location');const calls=[];
  const deps={preflight:()=>{},run:async argv=>{
    if(argv.includes('marketplace')&&argv.includes('list'))return {exitCode:0,stdout:'{"marketplaces":[]}',stderr:''};
    if(argv[2]==='list')return {exitCode:0,stdout:'{"installed":[{"pluginId":"harness-kit@harness-kit-local","enabled":true,"version":"0.5.0"}]}',stderr:''};
    calls.push(argv);return {exitCode:0,stdout:'ok',stderr:''};}};
  const options={source:release.root,host:'codex',location};
  const preview=await installFromLink({...options,dryRun:true},deps);
  assert.equal(preview.status,'preview');assert.equal(fs.existsSync(location),false);assert.equal(calls.length,0);
  const installed=await installFromLink(options,deps);
  assert.equal(installed.status,'installed');assert.equal(calls.length,2);assert.equal(calls[0][4],installed.directory);
  assert.ok(fs.existsSync(path.join(installed.directory,'plugins/harness-kit/skills/harness-kit/scripts/harness.mjs')));
  assert.equal((await installFromLink(options,deps)).directory,installed.directory);
  write(installed.directory,'plugins/harness-kit/plugin.json','user modification');
  await assert.rejects(()=>installFromLink(options,deps),/modified/);
});
test('checksum and unsafe ZIP are rejected before install or host registration',async()=>{
  const release=localRelease(),location=path.join(fixture(),'out');let invoked=false;
  write(release.root,release.name,Buffer.from('bad archive'));
  await assert.rejects(()=>installFromLink({source:release.root,host:'codex',location},{preflight:()=>{},run:()=>{invoked=true;}}),/SHA-256/);
  assert.equal(fs.existsSync(location),false);assert.equal(invoked,false);
  const unsafe=zipFiles(new Map([['safe/file',Buffer.from('x')]]));
  for(let start=unsafe.indexOf(Buffer.from('safe/file'));start!==-1;start=unsafe.indexOf(Buffer.from('safe/file'),start+1))unsafe.write('../x/file',start);
  assert.throws(()=>unpackZip(unsafe),/Unsafe/);
});
test('host failure is partial and keeps package; missing host or DSH profile performs no write',async()=>{
  const release=localRelease(),location=path.join(fixture(),'out');let calls=0;
  const result=await installFromLink({source:release.root,host:'claude',location},{preflight:()=>{},run:async argv=>argv.includes('list')?{exitCode:0,stdout:'[]',stderr:''}:{exitCode:++calls===2?1:0,stdout:'',stderr:'fixture failure'}});
  assert.equal(result.status,'partial');assert.equal(calls,2);assert.ok(fs.existsSync(result.directory));
  const missing=path.join(fixture(),'missing');
  await assert.rejects(()=>installFromLink({source:release.root,host:'codex',location:missing},{preflight:()=>{throw Error('missing host');}}),/missing host/);
  assert.equal(fs.existsSync(missing),false);
  await assert.rejects(()=>installFromLink({source:release.root,host:'dsh',location:missing}),/profile/);
});
test('Skill install preserves unowned directories and rejects junction destinations',async()=>{
  const release=localRelease('skill'),parent=fixture(),location=path.join(parent,'skill');
  const result=await installFromLink({source:release.root,host:'skill',location});assert.equal(result.status,'installed');assert.deepEqual(result.commands,[]);
  const unowned=path.join(parent,'unowned');fs.mkdirSync(unowned);write(unowned,'user','keep');
  await assert.rejects(()=>installFromLink({source:release.root,host:'skill',location:unowned}),/unowned/);
  const link=path.join(parent,'linked');fs.symlinkSync(location,link,process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>installFromLink({source:release.root,host:'skill',location:link}),/symlink/);
});
test('remote Release download verifies same-release assets and archive checksum',async()=>{
  const release=localRelease('skill'),base='https://github.com/a/b/releases/download/v0.5.0/';const requested=[];
  const fetcher=async url=>{
    requested.push(url);
    if(url.startsWith('https://api.github.com/'))return new Response(JSON.stringify({tag_name:'v0.5.0',assets:[release.name,'SHA256SUMS'].map(name=>({name,browser_download_url:base+name}))}));
    return new Response(fs.readFileSync(path.join(release.root,url.slice(base.length))));
  };
  const result=await loadPackage('https://github.com/a/b/releases/tag/v0.5.0','skill',fetcher);
  assert.equal(result.checksum,hash(release.bytes));assert.equal(result.origin,'a/b@v0.5.0');assert.equal(requested.length,3);
});
test('a different existing marketplace is preserved and successful commands need enabled-state evidence',async()=>{
  const release=localRelease(),location=path.join(fixture(),'chosen');let mutations=0;
  const conflicting={preflight:()=>{},run:async argv=>{if(argv.includes('list'))return {exitCode:0,stdout:JSON.stringify({marketplaces:[{name:'harness-kit-local',root:path.join(location,'other')}]}),stderr:''};mutations++;return {exitCode:0,stdout:'',stderr:''};}};
  await assert.rejects(()=>installFromLink({source:release.root,host:'codex',location},conflicting),/points elsewhere/);
  assert.equal(mutations,0);assert.equal(fs.existsSync(location),false);
  const missingEvidence={preflight:()=>{},run:async argv=>({exitCode:0,stdout:argv.includes('marketplace')?'[]':'[]',stderr:''})};
  const result=await installFromLink({source:release.root,host:'claude',location},missingEvidence);
  assert.equal(result.status,'partial');assert.ok(fs.existsSync(result.directory));
});
test('DSH uses the chosen profile and full native package without inventing live discovery',async()=>{
  const release=localRelease('dsh',new Map([
    ['harness-kit/package.json',Buffer.from('{"name":"dsh-plugin-harness-kit"}')],
    ['harness-kit/skills/harness-kit/SKILL.md',Buffer.from('skill')],
    ['harness-kit/skills/harness-kit/scripts/harness.mjs',Buffer.from('bundle')],
  ]));
  const commands=[];
  const result=await installFromLink({source:release.root,host:'dsh',profile:'desktop',location:path.join(fixture(),'native plugin')},{preflight:()=>{},run:async argv=>{commands.push(argv);return {exitCode:0,stdout:'',stderr:''};}});
  assert.equal(result.status,'installed');assert.equal(result.hostRuntime,'not-confirmed');
  assert.deepEqual(commands,[['dsh','plugin','--profile','desktop','add',result.directory]]);
  assert.equal(result.registration,'command-succeeded-profile-restart-required');
});
