import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { fixture,config,write } from './helpers.mjs';
import { lint,applyBaseline } from '../src/lint.mjs';
import { finding } from '../src/report.mjs';

test('private memory is legal and missing tests stay explicit',()=>{
  const root=fixture({'MEMORY.md':'internal'}),r=lint(root,config(root));
  assert.equal(r.exitCode,0);assert.equal(r.workspaces[0].tests,'not-configured');
});
test('layout is framework-specific, nested workspace owns its tests',()=>{
  const root=fixture({'src/a.test.ts':'','pkg/service_test.go':''});
  const c=config(root,{workspaces:[{id:'root',root:'.',tests:{include:['src/**/*.test.ts']}},{id:'pkg',root:'pkg',tests:{include:['**/*_test.go']}}]});
  assert.equal(lint(root,c).exitCode,0);
  write(root,'outside.test.ts','');assert.equal(lint(root,c).findings[0].ruleId,'tests.layout');
});
test('ordinary baseline warns, new finding blocks, public rules never waived',()=>{
  const root=fixture({'docs/verification/a.md':'[test](missing.test.ts)'}),c=config(root);
  const first=lint(root,c);c.baseline=first.findings.map(f=>f.fingerprint);
  assert.equal(lint(root,c).exitCode,0);
  write(root,'docs/verification/b.md','[test](different.test.ts)');assert.equal(lint(root,c).exitCode,1);
  const protectedFinding=finding('publication.internal','MEMORY.md','no',{protectedRule:true});
  assert.equal(applyBaseline([protectedFinding],[protectedFinding.fingerprint])[0].severity,'error');
});
test('test code in artifact directory is checked instead of hidden by traversal ignores',()=>{
  const root=fixture({'artifacts/misplaced.test.ts':''});
  assert.ok(lint(root,config(root)).findings.some(f=>f.ruleId==='tests.artifacts'));
});
