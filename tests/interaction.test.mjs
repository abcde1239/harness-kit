import {test} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,write,config} from './helpers.mjs';
import {locateProject} from '../src/project.mjs';
import {collectAnswers,commandArgv,setup} from '../src/interaction.mjs';
const uiFor=values=>{const log=[];return {log,write:text=>log.push(text),ask:async prompt=>{log.push(prompt);if(!values.length)throw new Error('Unexpected extra question');return values.shift();}};};

test('root discovery prefers ancestor config, supports monorepo and respects nested Git boundary',()=>{
  const root=fixture({'packages/web/src/a.ts':'','harness.config.json':'{}'});
  assert.equal(locateProject(path.join(root,'packages/web/src')).root,fs.realpathSync(root));
  fs.mkdirSync(path.join(root,'packages/web/.git'));
  assert.equal(locateProject(path.join(root,'packages/web/src')).root,fs.realpathSync(path.join(root,'packages/web')));
  const mono=fixture({'package.json':{workspaces:['apps/*']},'apps/ui/package.json':{},'apps/ui/src/a.ts':''});
  assert.equal(locateProject(path.join(mono,'apps/ui/src')).root,fs.realpathSync(mono));
  assert.equal(locateProject(root,'packages/web').source,'explicit');
});
test('normal commands preserve quotes and Windows paths but do not evaluate shell syntax',()=>{
  assert.deepEqual(commandArgv('pnpm run test -- --run'),['pnpm','run','test','--','--run']);
  assert.deepEqual(commandArgv('bun "tests/a b.test.ts"'),['bun','tests/a b.test.ts']);
  assert.deepEqual(commandArgv('"C:\\Program Files\\runner.exe" test'),['C:\\Program Files\\runner.exe','test']);
  assert.deepEqual(commandArgv('["bun","test"]'),['bun','test']);
  for(const command of ['bun test && echo bad','bun "oops','echo $HOME','[]'])assert.throws(()=>commandArgv(command));
});
test('interactive setup validates answers, previews then applies without JSON input',async()=>{
  const root=fixture(),ui=uiFor(['bad','1','1','bun "oops','bun test','1']);
  const result=await setup(root,{ui});
  assert.equal(result.status,'applied');
  const c=JSON.parse(fs.readFileSync(path.join(root,'harness.config.json'),'utf8'));
  assert.deepEqual(c.tasks[0].argv,['bun','test']);
  assert.ok(ui.log.some(line=>line.includes('变更预览')));
  assert.ok(fs.existsSync(path.join(root,'.harness/plan.json')));
});
test('saving plan leaves project config untouched and conflict application preserves user guide',async()=>{
  const root=fixture(),ui=uiFor(['1','2','2']);
  assert.equal((await setup(root,{ui})).status,'planned');
  assert.equal(fs.existsSync(path.join(root,'harness.config.json')),false);
  write(root,'docs/agent_guide.md','my guide');
  const r=await setup(root,{answers:{visibility:'private',testCommands:{root:null}},yes:true});
  assert.equal(r.status,'conflicts');assert.equal(fs.readFileSync(path.join(root,'docs/agent_guide.md'),'utf8'),'my guide');
});
test('manager answer recomputes questions and reuses existing test script',async()=>{
  const root=fixture({'package.json':{scripts:{test:'bun test'}},'pnpm-lock.yaml':'','bun.lock':''}),ui=uiFor(['1','1']);
  const answers=await collectAnswers(root,{},ui);
  assert.equal(answers.managers.root,'bun');assert.equal(answers.testCommands,undefined);
});
test('existing project can opt to adjust visibility and test command',async()=>{
  const root=fixture();write(root,'harness.config.json',config(root,{tasks:[{id:'test',argv:['bun','test']}]}));
  const answers=await collectAnswers(root,{},uiFor(['2','y','1','pnpm run test']),{edit:true});
  assert.equal(answers.visibility,'public');assert.deepEqual(answers.testCommands.root,['pnpm','run','test']);
});
