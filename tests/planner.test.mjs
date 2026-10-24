import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture,write,repo,git } from './helpers.mjs';
import { makePlan,applyPlan } from '../src/planner.mjs';
import { classify } from '../src/policy.mjs';

const answers={visibility:'private',testCommands:{root:null}};
test('empty project plan asks missing questions; answered plan applies idempotently',()=>{
  const root=fixture();
  assert.equal(makePlan(root).unanswered.length,2);
  const first=makePlan(root,answers); assert.equal(first.unanswered.length,0);
  assert.equal(applyPlan(root,first).status,'applied');
  const second=makePlan(root,answers); assert.ok(second.files.every(f=>f.action==='unchanged'));
  assert.deepEqual(applyPlan(root,second).changed,[]);
});
test('gen-new guide and verify shell are preserved; conflicts are explicit',()=>{
  const root=fixture({'docs/agent_guide.md':'custom guide','scripts/verify.sh':'custom checks'});
  const result=applyPlan(root,makePlan(root,answers));
  assert.ok(result.conflicts.includes('docs/agent_guide.md'));
  assert.equal(fs.readFileSync(path.join(root,'docs/agent_guide.md'),'utf8'),'custom guide');
  assert.equal(fs.readFileSync(path.join(root,'scripts/verify.sh'),'utf8'),'custom checks');
});
test('stale and modified plan are rejected before writes',()=>{
  const root=fixture(), plan=makePlan(root,answers);
  write(root,'docs/agent_guide.md','user intervened');
  assert.throws(()=>applyPlan(root,plan),/Stale/);
  assert.equal(fs.existsSync(path.join(root,'harness.config.json')),false);
  const fresh=makePlan(root,answers); fresh.files[0].content='tampered';
  assert.throws(()=>applyPlan(root,fresh),/Invalid/);
});
test('unknown framework argv and layout can be explicitly declared',()=>{
  const root=fixture({'check.custom':'x'});
  const plan=makePlan(root,{visibility:'private',testCommands:{root:['custom-runner','check','check.custom']}});
  const config=JSON.parse(plan.files.find(f=>f.path==='harness.config.json').content);
  assert.deepEqual(config.tasks[0].argv,['custom-runner','check','check.custom']);
});
test('changed managed guide is never overwritten on regeneration',()=>{
  const root=fixture(); applyPlan(root,makePlan(root,answers));
  write(root,'docs/agent_guide.md','user modified');
  const result=applyPlan(root,makePlan(root,answers));
  assert.equal(result.status,'conflicts');
  assert.equal(fs.readFileSync(path.join(root,'docs/agent_guide.md'),'utf8'),'user modified');
});
test('application failure restores written files and leaves user files intact',()=>{
  const root=fixture({'scripts':'a user file'}),plan=makePlan(root,answers);
  assert.throws(()=>applyPlan(root,plan));
  assert.equal(fs.existsSync(path.join(root,'harness.config.json')),false);
  assert.equal(fs.existsSync(path.join(root,'docs/agent_guide.md')),false);
  assert.equal(fs.readFileSync(path.join(root,'scripts'),'utf8'),'a user file');
});
test('explicit unknown visibility is allowed for initialization but not publication',()=>{
  const root=fixture();assert.equal(makePlan(root,{visibility:'unknown',testCommands:{root:null}}).unanswered.length,0);
});

test('default layout provides a public root introduction, categorized docs and an internal directory guide',()=>{
  const root=fixture(),plan=makePlan(root,answers);applyPlan(root,plan);
  const c=JSON.parse(fs.readFileSync(path.join(root,'harness.config.json'),'utf8'));
  assert.equal(classify(c,'README.md').audience,'public');
  assert.equal(classify(c,'docs/structure.md').audience,'internal');
  assert.equal(classify(c,'.harness/plan.json').audience,'internal');
  for(const name of ['guides','reference','examples']) {
    assert.ok(fs.statSync(path.join(root,'docs/public',name)).isDirectory());
    assert.equal(classify(c,`docs/public/${name}/page.md`).audience,'public');
  }
  assert.ok(fs.existsSync(path.join(root,'README.md')));
  assert.ok(fs.existsSync(path.join(root,'docs/structure.md')));
  assert.equal(fs.existsSync(path.join(root,'docs/public/README.md')),false);
});

test('generated gitignore ignores output and secrets while retaining private development docs and env examples',()=>{
  for(const visibility of ['private','public']) {
    const root=repo({'docs/prd/feature.md':'private','MEMORY.md':'private','artifacts/report.txt':'output','.env':'secret','.env.example':'template'});
    applyPlan(root,makePlan(root,{...answers,visibility}));
    const trackedCandidates=git(root,'ls-files','--others','--exclude-standard').split('\n');
    assert.ok(trackedCandidates.includes('README.md'));
    assert.ok(trackedCandidates.includes('harness.config.json'));
    assert.ok(trackedCandidates.includes('.gitignore'));
    assert.ok(trackedCandidates.includes('.env.example'));
    assert.ok(!trackedCandidates.includes('artifacts/report.txt'));
    assert.ok(!trackedCandidates.includes('.env'));
    for(const internal of ['docs/prd/feature.md','MEMORY.md','docs/structure.md','.harness/managed.json'])assert.equal(trackedCandidates.includes(internal),visibility==='private',internal);
  }
});

test('existing README is preserved and existing gitignore receives a conflict proposal',()=>{
  const root=fixture({'README.md':'Real project introduction','.gitignore':'custom-output/\n','docs/structure.md':'User directory guide'});
  const result=applyPlan(root,makePlan(root,answers));
  assert.ok(!result.conflicts.includes('README.md'));
  assert.ok(result.conflicts.includes('.gitignore'));
  assert.ok(result.conflicts.includes('docs/structure.md'));
  for(const [file,text] of [['README.md','Real project introduction'],['.gitignore','custom-output/\n'],['docs/structure.md','User directory guide']])assert.equal(fs.readFileSync(path.join(root,file),'utf8'),text);
});
