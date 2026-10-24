import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { fixture,write,config } from './helpers.mjs';
import { inspect } from '../src/discovery.mjs';
import { makePlan } from '../src/planner.mjs';
import { lint } from '../src/lint.mjs';

test('pnpm monorepo discovers package scripts without executing them',()=>{
  const root=fixture({'package.json':{private:true,packageManager:'pnpm@11',scripts:{test:'pnpm -r test'}},'pnpm-workspace.yaml':"packages:\n  - 'packages/*'\n",'pnpm-lock.yaml':'lockfileVersion: 9','packages/ui/package.json':{scripts:{test:'do-not-execute'},devDependencies:{vite:'*',vitest:'*'}}});
  const scan=inspect(root);
  assert.deepEqual(scan.suggestedConfig.workspaces.map(w=>w.root),['.','packages/ui']);
  assert.deepEqual(scan.suggestedConfig.tasks.map(t=>t.argv),[['pnpm','run','test']]);
  assert.ok(scan.questions.some(q=>q.id.startsWith('aggregate:')));
});
test('Bun workspaces use Bun while Vite alone never supplies a test task',()=>{
  const root=fixture({'package.json':{packageManager:'bun@1.3.4',workspaces:['apps/*']},'bun.lock':'{}','apps/web/package.json':{devDependencies:{vite:'*'}},'apps/tool/package.json':{scripts:{test:'bun test'}}});
  const scan=inspect(root);
  assert.ok(scan.questions.some(q=>q.id==='tests:apps-web'));
  assert.deepEqual(scan.suggestedConfig.tasks[0].argv,['bun','run','test']);
});
test('mixed Go modules and JS packages have module-local tasks',()=>{
  const root=fixture({'go.work':'go 1.24\nuse (\n ./services/a\n ./services/b\n)\n','services/a/go.mod':'module example/a','services/b/go.mod':'module example/b','package.json':{packageManager:'bun@1.3.4',scripts:{test:'bun test'}}});
  const scan=inspect(root);
  assert.equal(scan.suggestedConfig.workspaces.length,3);
  assert.equal(scan.suggestedConfig.tasks.filter(t=>t.argv[0]==='go').length,2);
  for(const w of scan.suggestedConfig.workspaces.filter(w=>w.root.startsWith('services/')))assert.deepEqual(w.tests.include,['**/*_test.go']);
});

test('co-located stacks retain both tasks without narrowing another framework test layout',()=>{
  const root=fixture({'package.json':{packageManager:'bun@1.3.4',scripts:{test:'bun test'}},'go.mod':'module example/mixed','main_test.go':'package main','src/unit.test.ts':'','artifacts/stray.test.ts':''});
  const plan=makePlan(root,{visibility:'private'});
  assert.equal(plan.unanswered.length,0);
  const proposed=JSON.parse(plan.files.find(f=>f.path==='harness.config.json').content);
  assert.equal(proposed.workspaces.length,1);
  assert.deepEqual(proposed.tasks.map(t=>t.argv),[['bun','run','test'],['go','test','./...']]);
  const result=lint(root,proposed);
  assert.equal(result.findings.filter(f=>f.ruleId==='tests.layout').length,0);
  assert.equal(result.findings.filter(f=>f.ruleId==='tests.artifacts').length,1);
});
test('conflicting locks ask rather than choose; explicit config wins',()=>{
  const root=fixture({'package.json':{scripts:{test:'bun test'}},'pnpm-lock.yaml':'','bun.lock':''});
  assert.ok(inspect(root).questions.some(q=>q.type==='manager'));
  write(root,'harness.config.json',config(root));
  assert.equal(inspect(root).facts[0].capability,'explicit-config');
});
test('unknown stack remains a configurable root workspace',()=>{
  const scan=inspect(fixture({'build.custom':'unknown'}));
  assert.equal(scan.suggestedConfig.workspaces[0].root,'.');
  assert.ok(scan.questions.some(q=>q.type==='test-command'));
});
