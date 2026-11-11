import {test} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,config,write} from './helpers.mjs';
import {makePlan,applyPlan} from '../src/planner.mjs';
import {loadConfig} from '../src/config.mjs';
import {verifyProject,verificationEvidence,EVIDENCE} from '../src/workflow.mjs';
import {diagnose} from '../src/readiness.mjs';

function project(argv=['bun','test.mjs']) {
  const root=fixture({'test.mjs':'console.log("private-program-output");'});
  applyPlan(root,makePlan(root,{visibility:'private',testCommands:{root:argv}}));
  return root;
}

test('first real verification makes local integration ready; diagnosis is read-only and evidence has no stdout',async()=>{
  const root=project(),c=loadConfig(root);
  assert.equal(diagnose(root).status,'needs-attention');
  assert.equal(fs.existsSync(path.join(root,EVIDENCE)),false);
  const result=await verifyProject(root,c);
  assert.equal(result.verification.tasks[0].status,'passed');
  const text=fs.readFileSync(path.join(root,EVIDENCE),'utf8');
  assert.ok(!text.includes('private-program-output'));
  const ready=diagnose(root);
  assert.equal(ready.status,'ready',JSON.stringify(ready));
  assert.equal(ready.hostRuntime,'not-confirmed');
  assert.equal(fs.readFileSync(path.join(root,EVIDENCE),'utf8'),text);
});

test('changed source invalidates old pass and rerun recovers; generated artifacts do not change evidence',async()=>{
  const root=project(),c=loadConfig(root);
  await verifyProject(root,c);
  write(root,'coverage/report.txt','new output');
  assert.equal(verificationEvidence(root,c).status,'passed');
  write(root,'src/new.mjs','export const changed=true;');
  assert.equal(verificationEvidence(root,c).status,'stale');
  assert.equal(diagnose(root).status,'needs-attention');
  await verifyProject(root,c);
  assert.equal(verificationEvidence(root,c).status,'passed');
  write(root,'.harness/notes.md','internal task notes');
  assert.equal(verificationEvidence(root,c).status,'passed');
});

test('failed verification replaces old evidence and a fixed project can recover',async()=>{
  const root=project(),c=loadConfig(root);
  await verifyProject(root,c);
  write(root,'test.mjs','process.exit(7);');
  const failed=await verifyProject(root,c);
  assert.equal(failed.exitCode,1);
  assert.equal(verificationEvidence(root,c).status,'failed');
  write(root,'test.mjs','console.log("fixed");');
  assert.equal(verificationEvidence(root,c).status,'stale');
  assert.equal((await verifyProject(root,c)).status,'passed');
  assert.equal(diagnose(root).status,'ready');
});

test('source folders called build or dist are fingerprinted instead of silently ignored',async()=>{
  const root=project(),c=loadConfig(root);
  write(root,'src/build/input.txt','good');write(root,'lib/dist/code.mjs','export const value=1;');
  await verifyProject(root,c);
  write(root,'src/build/input.txt','bad');
  assert.equal(verificationEvidence(root,c).status,'stale');
  await verifyProject(root,c);
  write(root,'lib/dist/code.mjs','export const value=2;');
  assert.equal(verificationEvidence(root,c).status,'stale');
});

test('selected tasks do not establish full readiness and source-changing tasks invalidate their own record',async()=>{
  const root=project(),c=loadConfig(root);
  await verifyProject(root,c,{selected:['root:test']});
  assert.equal(verificationEvidence(root,c).status,'partial');
  assert.equal(diagnose(root).status,'needs-attention');
  write(root,'test.mjs','await Bun.write("source-created.txt","changed during run");');
  const changed=await verifyProject(root,c);
  assert.equal(changed.verification.status,'passed');
  assert.equal(changed.evidence.stable,false);
  assert.equal(verificationEvidence(root,c).status,'stale');
});

test('empty configuration, invalid records and missing tools have distinct readiness',async()=>{
  const empty=fixture();
  assert.equal(diagnose(empty).status,'not-configured');
  applyPlan(empty,makePlan(empty,{visibility:'private',testCommands:{root:null}}));
  await verifyProject(empty,loadConfig(empty));
  assert.equal(diagnose(empty).status,'not-configured');
  const missing=project(['missing-harness-program-123']);
  assert.ok(diagnose(missing).checks.some(c=>c.id==='tools'&&c.status==='blocked'));
  const root=project();write(root,EVIDENCE,'not JSON');
  assert.equal(verificationEvidence(root,loadConfig(root)).status,'invalid');
});

test('discovery drift warns without changing explicit config and override prevents readiness',async()=>{
  const root=project(),c=loadConfig(root);
  await verifyProject(root,c);
  const before=fs.readFileSync(path.join(root,'harness.config.json'),'utf8');
  write(root,'packages/new/package.json',{packageManager:'bun@1.3.4',scripts:{test:'bun test'}});
  const result=diagnose(root);
  const discovery=result.checks.find(c=>c.id==='discovery');
  assert.equal(discovery.status,'warning');
  assert.equal(discovery.drift.workspaces[0].root,'packages/new');
  assert.equal(fs.readFileSync(path.join(root,'harness.config.json'),'utf8'),before);
  write(root,'AGENTS.override.md','Use different instructions.');
  assert.ok(diagnose(root).checks.some(c=>c.id==='agent-entry'&&c.status==='blocked'));
});

test('optional failures remain visible in readiness even when command exit contract allows them',async()=>{
  const root=project();
  const c=loadConfig(root);c.tasks[0].required=false;
  write(root,'harness.config.json',c);write(root,'test.mjs','process.exit(4);');
  const result=await verifyProject(root,loadConfig(root));
  assert.equal(result.exitCode,0);
  assert.equal(verificationEvidence(root,loadConfig(root)).status,'failed');
  assert.equal(diagnose(root).status,'needs-attention');
});

test('disabled required tasks are blocked instead of reported as an unconfigured empty project',async()=>{
  const root=project(),c=loadConfig(root);c.tasks[0].enabled=false;
  write(root,'harness.config.json',c);
  const diagnosed=diagnose(root);
  assert.equal(diagnosed.status,'needs-attention');
  assert.equal(diagnosed.checks.find(c=>c.id==='verification').status,'blocked');
});

test('truncated verification records cannot claim full task or workspace coverage',async()=>{
  const root=project(),c=loadConfig(root);
  await verifyProject(root,c);
  const record=JSON.parse(fs.readFileSync(path.join(root,EVIDENCE),'utf8'));
  write(root,EVIDENCE,{...record,tasks:[]});
  assert.equal(verificationEvidence(root,c).status,'invalid');
  write(root,EVIDENCE,{...record,workspaces:[]});
  assert.equal(verificationEvidence(root,c).status,'invalid');
  write(root,EVIDENCE,{...record,tasks:[...record.tasks,...record.tasks]});
  assert.equal(verificationEvidence(root,c).status,'invalid');
});
