import { test, setDefaultTimeout } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture,config,write,manifest,repo,commit } from './helpers.mjs';
import { checkManifest,exportSnapshot } from '../src/publication.mjs';
import { hash } from '../src/fs.mjs';
import { makePlan,applyPlan } from '../src/planner.mjs';
setDefaultTimeout(15000);

test('public file with exact source and output hashes passes',()=>{
  const root=fixture({'docs/public/hello.md':'# Hello'}),c=config(root),m=manifest(root,'hello.md','docs/public/hello.md');
  assert.equal(checkManifest(root,c,m).exitCode,0);
});

test('fresh project exports its default root README and public sections without internal directory documentation',()=>{
  const root=fixture();applyPlan(root,makePlan(root,{visibility:'private',testCommands:{root:null}}));
  write(root,'docs/public/guides/start.md','Public guide');
  const c=JSON.parse(fs.readFileSync(path.join(root,'harness.config.json'),'utf8'));
  const result=exportSnapshot(root,c,'artifacts/public');
  assert.equal(result.exitCode,0,JSON.stringify(result));
  assert.deepEqual(result.manifest.entries.map(e=>e.path).sort(),['README.md','docs/public/guides/start.md']);
  assert.equal(fs.existsSync(path.join(root,'artifacts/public/docs/structure.md')),false);
  assert.equal(checkManifest(root,c,result.manifest).exitCode,0);
});
test('internal source, missing provenance, additional output and stale hash block',()=>{
  const root=fixture({'docs/decision/ADR.md':'Internal architecture'}),c=config(root),m=manifest(root,'public.html','docs/decision/ADR.md');
  assert.ok(checkManifest(root,c,m).findings.some(f=>f.ruleId==='publication.internal-source'));
  m.entries[0].sources=[];assert.ok(checkManifest(root,c,m).findings.some(f=>f.ruleId==='publication.unknown-source'));
  write(root,'out/unlisted.txt','extra');assert.ok(checkManifest(root,c,m).findings.some(f=>f.ruleId==='publication.unlisted'));
  write(root,'out/public.html','changed');assert.ok(checkManifest(root,c,m).findings.some(f=>f.ruleId==='publication.digest'));
});
test('generated output needs explicit review and current source hashes',()=>{
  const root=fixture({'docs/public/index.md':'# Welcome'}),c=config(root),m=manifest(root,'index.html','docs/public/index.md');
  write(root,'out/index.html','<h1>Welcome</h1>');m.entries[0].sha256=hash('<h1>Welcome</h1>');
  assert.ok(checkManifest(root,c,m).findings.some(f=>f.ruleId==='publication.generated-review'));
  m.entries[0].review={reviewer:'test reviewer',reference:'build review 123'};
  assert.equal(checkManifest(root,c,m).exitCode,0);
  write(root,'docs/public/index.md','# changed');assert.notEqual(checkManifest(root,c,m).exitCode,0);
});
test('unsafe paths, symlink output, archives and private links fail closed',()=>{
  const root=fixture({'docs/public/index.md':'[internal](../decision/ADR.md)','docs/decision/ADR.md':'internal'}),c=config(root),m=manifest(root,'index.md','docs/public/index.md');
  assert.ok(checkManifest(root,c,m).findings.some(f=>f.ruleId==='publication.link'));
  m.entries[0].path='../escape';assert.equal(checkManifest(root,c,m).exitCode,2);
  const clean=fixture({'docs/public/a.zip':'not really zip'}),cm=manifest(clean,'a.zip','docs/public/a.zip');
  assert.ok(checkManifest(clean,config(clean),cm).findings.some(f=>f.ruleId==='publication.archive'));
  const outside=fixture({'x':'secret'});fs.symlinkSync(outside,path.join(clean,'out','link'),process.platform==='win32'?'junction':'dir');
  assert.notEqual(checkManifest(clean,config(clean),cm).exitCode,0);
});
test('snapshot is new, has no .git/internal docs and can be rechecked',()=>{
  const root=repo({'docs/public/readme.md':'Public','MEMORY.md':'Private'});commit(root);
  const c=config(root),r=exportSnapshot(root,c,'artifacts/snapshot');
  assert.equal(r.exitCode,0);assert.equal(fs.existsSync(path.join(root,'artifacts/snapshot/.git')),false);
  assert.equal(fs.existsSync(path.join(root,'artifacts/snapshot/MEMORY.md')),false);
  assert.equal(checkManifest(root,c,r.manifest).exitCode,0);
  assert.throws(()=>exportSnapshot(root,c,'artifacts/snapshot'),/must not exist/);
});
test('renamed exact internal history content cannot be exported',()=>{
  const root=repo({'MEMORY.md':'secret memory content'});commit(root);
  fs.unlinkSync(path.join(root,'MEMORY.md'));write(root,'docs/public/innocent.md','secret memory content');commit(root);
  const r=exportSnapshot(root,config(root),'artifacts/snapshot');
  assert.ok(r.findings.some(f=>f.ruleId==='publication.internal-copy'));
  assert.equal(fs.existsSync(path.join(root,'artifacts/snapshot')),false);
});
