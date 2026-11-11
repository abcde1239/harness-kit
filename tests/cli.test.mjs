import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture,write,config } from './helpers.mjs';
import { HOSTS } from '../src/host.mjs';

const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/harness.mjs');
function run(root,...args) {
  const r=Bun.spawnSync([process.execPath,cli,...args,'--root',root,'--json'],{stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_ACTIVE:''}});
  const text=Buffer.from(r.stdout.length?r.stdout:r.stderr).toString();
  return {code:r.exitCode,data:JSON.parse(text)};
}

test('DSH CLI selection, alias and runtime notice remain distinct from actual host loading',()=>{
  const root=fixture({'check.mjs':'console.log("validated")'});
  const result=run(root,'init','--private','--test','bun check.mjs','--hosts','deepseek-harness','--yes');
  assert.equal(result.code,0,JSON.stringify(result.data));
  assert.equal(result.data.readiness.status,'ready');
  const entry=result.data.readiness.checks.find(c=>c.entry?.host==='dsh').entry;
  assert.equal(entry.file,'AGENTS.md');assert.equal(entry.loaded,'not-confirmed');
  const human=Bun.spawnSync([process.execPath,cli,'doctor','--root',root],{stdout:'pipe',stderr:'pipe'});
  assert.equal(human.exitCode,0);assert.match(Buffer.from(human.stdout).toString(),/DSH developer preview/);
  assert.equal(fs.existsSync(path.join(root,'.dsh')),false);
  const noCodex=fixture();
  assert.equal(run(noCodex,'init','--private','--no-tests','--hosts','dsh','--hooks','--yes').code,2);
  assert.equal(fs.existsSync(path.join(noCodex,'AGENTS.md')),false);
});
test('real CLI inspect -> answered plan -> apply -> verify unknown project',()=>{
  const root=fixture({'check.mjs':"console.log('custom framework passed')",'answers.json':{visibility:'private',testCommands:{root:['bun','check.mjs']}}});
  assert.ok(run(root,'inspect').data.questions.length);
  assert.equal(run(root,'plan','--answers','answers.json','--out','plan.json').code,0);
  assert.equal(run(root,'apply','--plan','plan.json').code,0);
  const r=run(root,'verify');assert.equal(r.code,0);assert.equal(r.data.verification.tasks[0].status,'passed');
  assert.equal(run(root,'lint').code,0);
});
test('existing harness lint is reused as an external command, failed exit propagates',()=>{
  const root=fixture({'legacy-lint.mjs':'process.exit(9)'});
  write(root,'harness.config.json',config(root,{tasks:[{id:'existing-lint',kind:'lint',argv:['bun','legacy-lint.mjs']}]}));
  const r=run(root,'verify');assert.equal(r.code,1);assert.equal(r.data.verification.tasks[0].code,9);
});
test('CLI export manifest can be checked, then mutation is detected',()=>{
  const root=fixture({'docs/public/a.md':'Public'});write(root,'harness.config.json',config(root));
  const r=run(root,'export','--destination','artifacts/snapshot','--manifest-out','.harness/publication.json');assert.equal(r.code,0);
  assert.equal(run(root,'publication-check','--manifest','.harness/publication.json').code,0);
  write(root,'artifacts/snapshot/docs/public/a.md','altered');assert.equal(run(root,'publication-check','--manifest','.harness/publication.json').code,1);
});
test('invalid CLI options, missing config and unanswered apply fail distinctly',()=>{
  const root=fixture();assert.equal(run(root,'lint').code,2);
  assert.equal(run(root,'inspect','--task','wrong').code,2);
  run(root,'plan','--out','plan.json');assert.equal(run(root,'apply','--plan','plan.json').code,2);
  assert.equal(fs.existsSync(path.join(root,'harness.config.json')),false);
});
test('CLI runs setup from target cwd without tool-root argument and defaults to nonblocking help without a TTY',()=>{
  const root=fixture({'answers.json':{visibility:'private',testCommands:{root:null}}});
  const r=Bun.spawnSync([process.execPath,cli,'setup','--answers','answers.json','--yes','--json'],{cwd:root,stdout:'pipe',stderr:'pipe'});
  assert.equal(r.exitCode,0,Buffer.from(r.stderr).toString());
  assert.equal(JSON.parse(Buffer.from(r.stdout).toString()).status,'applied');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.harness/plan.json'),'utf8')).version,1);
  const noArgs=Bun.spawnSync([process.execPath,cli],{cwd:root,stdin:'ignore',stdout:'pipe',stderr:'pipe'});
  assert.equal(noArgs.exitCode,0);assert.ok(Buffer.from(noArgs.stdout).toString().includes('harness'));
});

test('simple init performs first verification and run/check retain their compatibility aliases',()=>{
  const root=fixture({'check.mjs':"import fs from 'node:fs'; fs.writeFileSync('.harness/verified.txt','ran');"});
  const initialized=run(root,'init','--private','--test','bun check.mjs','--yes');
  assert.equal(initialized.code,0,JSON.stringify(initialized.data));
  assert.equal(initialized.data.status,'applied');
  assert.equal(initialized.data.verification.tasks[0].status,'passed');
  assert.equal(initialized.data.readiness.status,'ready');
  assert.equal(fs.readFileSync(path.join(root,'.harness/verified.txt'),'utf8'),'ran');
  assert.ok(fs.existsSync(path.join(root,'AGENTS.md')));
  assert.equal(run(root,'check').code,run(root,'lint').code);
  assert.equal(run(root,'run').data.verification.tasks[0].status,'passed');
  assert.equal(run(root,'verify').data.verification.tasks[0].status,'passed');
});

test('init discovers test scripts while an explicit no-tests result is never ready',()=>{
  const root=fixture({'package.json':{packageManager:'bun@1.3.4',scripts:{test:'bun check.mjs'}},'check.mjs':'process.exit(0)'});
  const initialized=run(root,'init','--private','--yes');
  assert.equal(initialized.code,0,JSON.stringify(initialized.data));
  assert.equal(initialized.data.verification.tasks.length,1);
  assert.equal(initialized.data.readiness.status,'ready');
  const empty=fixture();
  const noTests=run(empty,'init','--private','--no-tests','--yes');
  assert.equal(noTests.code,0);
  assert.equal(noTests.data.verification.status,'not-configured');
  assert.equal(noTests.data.readiness.status,'not-configured');
});

test('init can explicitly skip execution, doctor stays read-only, and a later run validates',()=>{
  const root=fixture({'check.mjs':"import fs from 'node:fs'; fs.writeFileSync('.harness/marker.txt','executed');"});
  const skipped=run(root,'init','--private','--test','bun check.mjs','--skip-verify','--yes');
  assert.equal(skipped.code,0);
  assert.equal(skipped.data.verification,undefined);
  assert.notEqual(skipped.data.readiness.status,'ready');
  assert.equal(fs.existsSync(path.join(root,'.harness/marker.txt')),false);
  const diagnosed=run(root,'doctor');
  assert.equal(diagnosed.data.status,'needs-attention');
  assert.equal(fs.existsSync(path.join(root,'.harness/marker.txt')),false);
  assert.equal(run(root,'run').code,0);
  assert.equal(run(root,'doctor').data.status,'ready');
});

test('init reports failed first verification without discarding applied configuration',()=>{
  const root=fixture({'check.mjs':'process.exit(7)'});
  const initialized=run(root,'init','--private','--test','bun check.mjs','--yes');
  assert.equal(initialized.code,1);
  assert.equal(initialized.data.status,'applied');
  assert.equal(initialized.data.verification.tasks[0].code,7);
  assert.notEqual(initialized.data.readiness.status,'ready');
  assert.ok(fs.existsSync(path.join(root,'harness.config.json')));
});

test('simple init validates incompatible choices and does not guess missing requirements',()=>{
  for(const args of [
    ['--private','--public','--no-tests'],
    ['--private','--test','bun test','--no-tests'],
    ['--private','--test','bun test && echo unexpected'],
    ['--private'],
  ]) {
    const root=fixture(),result=run(root,'init',...args,'--yes');
    assert.equal(result.code,2,JSON.stringify(result));
    assert.equal(fs.existsSync(path.join(root,'harness.config.json')),false);
  }
  const mono=fixture({'package.json':{workspaces:['packages/*']},'packages/web/package.json':{}});
  assert.equal(run(mono,'init','--private','--test','bun test','--yes').code,2);
});

test('default help has a small command surface and advanced help retains migration commands',()=>{
  const root=fixture();
  const help=(...args)=>Bun.spawnSync([process.execPath,cli,'help',...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
  const basic=help(),advanced=help('--all');
  assert.equal(basic.exitCode,0);assert.equal(advanced.exitCode,0);
  const short=Buffer.from(basic.stdout).toString(),full=Buffer.from(advanced.stdout).toString();
  for(const command of ['harness init','harness run','harness check','harness doctor'])assert.ok(short.includes(command));
  assert.ok(!short.includes('audit-history'));
  assert.ok(full.includes('audit-history'));assert.ok(full.includes('publication-check'));assert.ok(full.includes('apply --plan'));
});

test('init optionally connects Codex hooks before recording its first verification',()=>{
  const root=fixture({'check.mjs':'process.exit(0)'});
  const initialized=run(root,'init','--private','--test','bun check.mjs','--hooks','--yes');
  assert.equal(initialized.code,0,JSON.stringify(initialized.data));
  assert.equal(initialized.data.hooks.status,'configured');
  assert.ok(fs.existsSync(path.join(root,'.codex/hooks.json')));
  assert.equal(initialized.data.verification.tasks[0].status,'passed');
  assert.equal(run(root,'doctor').data.status,'ready');
  const withoutHooks=fixture();
  assert.equal(run(withoutHooks,'init','--private','--no-tests','--yes').code,0);
  assert.equal(fs.existsSync(path.join(withoutHooks,'.codex/hooks.json')),false);
  assert.equal(run(root,'run','--hooks').code,2);
});

test('host hook CLI has a pure JSON protocol, bounded input and no generic output options',()=>{
  const root=fixture({'check.mjs':'process.exit(0)'});
  assert.equal(run(root,'init','--private','--test','bun check.mjs','--yes').code,0);
  const invoke=(input,args=[],environment={})=>Bun.spawnSync([process.execPath,cli,'hook','--root',root,...args],{
    stdin:Buffer.from(input),stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_ACTIVE:'',...environment}
  });
  const started=invoke(JSON.stringify({hook_event_name:'SessionStart',session_id:'cli-protocol-test'}));
  assert.equal(started.exitCode,0,Buffer.from(started.stderr).toString());
  const output=JSON.parse(Buffer.from(started.stdout).toString());
  assert.ok(output&&typeof output==='object');
  assert.equal(Buffer.from(started.stderr).toString(),'');
  const recursive=invoke('invalid JSON',[],{HARNESS_ACTIVE:'1'});
  assert.equal(recursive.exitCode,0);assert.deepEqual(JSON.parse(Buffer.from(recursive.stdout).toString()),{});
  for(const input of ['invalid JSON','[]','null','x'.repeat(1024*1024+1)]) {
    const invalid=invoke(input);
    assert.equal(invalid.exitCode,2);
    assert.equal(Buffer.from(invalid.stdout).toString(),'');
    assert.equal(JSON.parse(Buffer.from(invalid.stderr).toString()).status,'error');
  }
  for(const args of [['--out','hook-result.json'],['--json'],['--help']])assert.equal(invoke('{}',args).exitCode,2);
  assert.equal(fs.existsSync(path.join(root,'hook-result.json')),false);
});

test('init selects Agent hosts without creating every vendor configuration and preserves prior selections',()=>{
  const root=fixture();
  const initialized=run(root,'init','--hosts','claude-code,gemini-cli,cursor,open-code','--private','--no-tests','--yes');
  assert.equal(initialized.code,0,JSON.stringify(initialized.data));
  for(const id of ['claude','gemini','cursor','opencode'])assert.ok(fs.existsSync(path.join(root,HOSTS[id].file)));
  const firstPlan=JSON.parse(fs.readFileSync(path.join(root,'.harness/plan.json'),'utf8'));
  assert.deepEqual(firstPlan.hosts,['claude','gemini','cursor','opencode']);
  const again=run(root,'init','--hosts','codex','--yes');
  assert.equal(again.code,0,JSON.stringify(again.data));
  const nextPlan=JSON.parse(fs.readFileSync(path.join(root,'.harness/plan.json'),'utf8'));
  assert.ok(nextPlan.hosts.includes('codex'));assert.ok(nextPlan.hosts.includes('claude'));assert.ok(nextPlan.hosts.includes('opencode'));
  for(const value of ['unknown-host',',','claude,unknown']) {
    const target=fixture(),invalid=run(target,'init','--hosts',value,'--private','--no-tests','--yes');
    assert.equal(invalid.code,2);assert.equal(fs.existsSync(path.join(target,'harness.config.json')),false);
  }
  assert.equal(run(root,'run','--hosts','claude').code,2);
  const unsupportedHook=fixture();
  assert.equal(run(unsupportedHook,'init','--hosts','claude','--private','--no-tests','--hooks','--yes').code,2);
  assert.equal(fs.existsSync(path.join(unsupportedHook,'harness.config.json')),false);
});

test('task CLI persists scope, notes and acceptance, resumes without execution and finishes from linked verification',()=>{
  const root=fixture({'check.mjs':"import fs from 'node:fs'; fs.writeFileSync('.harness/ran.txt','yes');"});
  assert.equal(run(root,'init','--private','--test','bun check.mjs','--yes').code,0);
  const started=run(root,'task','start','change-one','--title','Add a checked change','--accept','Original behavior works','--accept','Failure is covered','--scope','check.mjs','--scope','docs');
  assert.equal(started.code,0,JSON.stringify(started.data));
  assert.deepEqual(started.data.task.scope,['check.mjs','docs']);
  assert.equal(started.data.task.criteria.length,2);
  assert.equal(run(root,'task','note','--note','Implementation ready','--next','Run checks and inspect output').code,0);
  const status=run(root,'task','status');
  assert.equal(status.data.task.id,'change-one');
  assert.equal(status.data.task.notes.at(-1).text,'Implementation ready');
  assert.equal(status.data.task.next,'Run checks and inspect output');
  fs.unlinkSync(path.join(root,'.harness/ran.txt'));
  const resumedHuman=Bun.spawnSync([process.execPath,cli,'task','resume','--root',root],{stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_ACTIVE:''}});
  assert.equal(resumedHuman.exitCode,0,Buffer.from(resumedHuman.stderr).toString());
  const summary=Buffer.from(resumedHuman.stdout).toString();
  for(const context of ['check.mjs','Implementation ready','Run checks and inspect output','c1'])assert.ok(summary.includes(context),context);
  assert.equal(fs.existsSync(path.join(root,'.harness/ran.txt')),false);
  assert.equal(run(root,'task','finish').code,1);
  const verified=run(root,'run','--work','change-one');
  assert.equal(verified.code,0,JSON.stringify(verified.data));
  assert.equal(verified.data.work.task.id,'change-one');
  assert.equal(verified.data.work.status,'recorded');
  for(const criterion of ['c1','c2'])assert.equal(run(root,'task','accept','--criterion',criterion,'--evidence','Current command passed; behavior reviewed').code,0);
  const finished=run(root,'task','finish');
  assert.equal(finished.code,0,JSON.stringify(finished.data));
  assert.equal(finished.data.task.state,'completed');
  fs.unlinkSync(path.join(root,'.harness/ran.txt'));
  assert.equal(run(root,'run','--work','change-one').code,2);
  assert.equal(fs.existsSync(path.join(root,'.harness/ran.txt')),false);
  write(root,'check.mjs','process.exit(0) // changed after acceptance');
  const resumed=run(root,'task','resume','change-one');
  assert.equal(resumed.data.task.state,'in-progress');
  assert.ok(resumed.data.criteria.some(c=>c.status==='stale'));
});

test('run work association validates IDs before execution and selected runner scope cannot finish a work task',()=>{
  const root=fixture({'check.mjs':"import fs from 'node:fs'; fs.writeFileSync('.harness/ran.txt','yes');"});
  assert.equal(run(root,'init','--private','--test','bun check.mjs','--yes').code,0);
  fs.unlinkSync(path.join(root,'.harness/ran.txt'));
  assert.equal(run(root,'run','--work','missing').code,2);
  assert.equal(fs.existsSync(path.join(root,'.harness/ran.txt')),false);
  const created=run(root,'task','start','selected','--accept','Whole project verified');
  assert.equal(created.code,0);assert.equal(created.data.task.title,'selected');
  const selected=run(root,'run','--task','root:test','--work','selected');
  assert.equal(selected.code,0,JSON.stringify(selected.data));
  assert.equal(selected.data.verification.scope,'selected-tasks');
  assert.equal(selected.data.work.status,'recorded');
  assert.equal(run(root,'task','finish','selected').code,1);
});

test('task CLI rejects missing fields, unknown actions and mismatched options',()=>{
  const root=fixture();
  for(const args of [
    ['start','x','--title','Missing acceptance'],['start','--title','No ID','--accept','Requirement'],
    ['unknown'],['note','--title','Wrong field'],['note'],['accept','--criterion','c1'],['status','--scope','.'],
    ['start','x','--title','Duplicate','--title','Other','--accept','Requirement']
  ])assert.equal(run(root,'task',...args).code,2,JSON.stringify(args));
});
