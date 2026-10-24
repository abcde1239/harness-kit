import { test, setDefaultTimeout } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo,fixture,config,write,git,commit } from './helpers.mjs';
import { auditHistory,auditIndex,reviewTemplate } from '../src/git.mjs';
setDefaultTimeout(15000);

function evidence(root,c) {
  const e=reviewTemplate(root,c);e.reviewer='Fixture reviewer';e.reference='Reviewed local test fixture';e.remoteRefs=[];
  for(const section of Object.values(e.platform)){section.status='not-applicable';section.reference='No hosted counterpart in this fixture';}
  return e;
}
test('history includes deleted memory and renamed public copies',()=>{
  const root=repo({'MEMORY.md':'private record'});commit(root);
  fs.unlinkSync(path.join(root,'MEMORY.md'));write(root,'docs/public/readme.md','private record');commit(root);
  const c=config(root),r=auditHistory(root,c,{evidence:evidence(root,c)});
  assert.ok(r.findings.some(f=>f.path==='MEMORY.md'));
  assert.ok(r.findings.some(f=>f.path==='docs/public/readme.md'&&f.ruleId==='publication.internal-history'));
});
test('non-default branches and tags are included',()=>{
  const root=repo({'docs/public/a.md':'public'});commit(root);git(root,'checkout','-b','private-notes');write(root,'docs/decision/ADR.md','private branch');commit(root);git(root,'tag','internal-tag');git(root,'checkout','main');
  const c=config(root),r=auditHistory(root,c,{evidence:evidence(root,c)});
  assert.ok(r.findings.some(f=>f.path==='docs/decision/ADR.md'));assert.ok(r.scope.refs.some(r=>r.name==='refs/tags/internal-tag'));
});
test('clean history needs complete scope-bound review; stale or missing evidence fails',()=>{
  const root=repo({'docs/public/a.md':'public'});commit(root);const c=config(root),e=evidence(root,c);
  assert.notEqual(auditHistory(root,c).exitCode,0);
  assert.equal(auditHistory(root,c,{evidence:e}).exitCode,0);
  e.remoteRefs=[{name:'refs/heads/missing',oid:'0'.repeat(40)}];assert.notEqual(auditHistory(root,c,{evidence:e}).exitCode,0);
  e.remoteRefs=[];write(root,'docs/public/b.md','more');commit(root);
  assert.ok(auditHistory(root,c,{evidence:e}).findings.some(f=>f.ruleId==='publication.review'));
});
test('public index blocks staged internal files; private lint uses no such restriction',()=>{
  const root=repo({'docs/public/a.md':'public'});commit(root);write(root,'MEMORY.md','private');git(root,'add','MEMORY.md');
  assert.ok(auditIndex(root,config(root,{repository:{visibility:'public'}})).findings.some(f=>f.path==='MEMORY.md'));
});
test('shallow history cannot pass full publication gate',()=>{
  const root=repo({'docs/public/a.md':'public'});commit(root);write(root,'docs/public/b.md','b');commit(root);
  const head=git(root,'rev-parse','HEAD');write(root,'.git/shallow',`${head}\n`);
  const c=config(root);assert.ok(auditHistory(root,c,{evidence:evidence(root,c)}).findings.some(f=>f.ruleId==='publication.shallow'));
});
test('LFS pointer and missing Git repository are blocked',()=>{
  const root=repo({'docs/public/a.bin':'version https://git-lfs.github.com/spec/v1\noid sha256:123\nsize 3\n'});commit(root);const c=config(root);
  assert.ok(auditHistory(root,c,{evidence:evidence(root,c)}).findings.some(f=>f.ruleId==='publication.lfs'));
  const empty=fixture();assert.equal(auditHistory(empty,config(empty)).exitCode,2);
});
