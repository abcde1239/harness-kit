import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture,write,config } from './helpers.mjs';

const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/harness.mjs');
function run(root,...args) {
  const r=Bun.spawnSync([process.execPath,cli,...args,'--root',root,'--json'],{stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_ACTIVE:''}});
  const text=Buffer.from(r.exitCode===2?r.stderr:r.stdout).toString();
  return {code:r.exitCode,data:JSON.parse(text)};
}
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
