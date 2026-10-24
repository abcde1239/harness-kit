import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture,config } from './helpers.mjs';
import { verify,taskOrder } from '../src/runner.mjs';

test('task DAG runs shared dependency once with explicit argv',async()=>{
  const root=fixture({'record.mjs':"import fs from 'node:fs'; fs.appendFileSync('calls.txt','x');"});
  const c=config(root,{tasks:[{id:'shared',argv:['bun','record.mjs']},{id:'a',argv:['bun','-e','process.exit(0)'],dependsOn:['shared']},{id:'b',argv:['bun','-e','process.exit(0)'],dependsOn:['shared']}]});
  const result=await verify(root,c); assert.equal(result.exitCode,0);
  assert.equal(fs.readFileSync(path.join(root,'calls.txt'),'utf8'),'x');
  assert.equal(result.tasks.length,3);
});
test('dependency failure blocks downstream; cycles rejected',async()=>{
  const root=fixture(),c=config(root,{tasks:[{id:'a',argv:['bun','-e','process.exit(7)']},{id:'b',argv:['bun','-e','process.exit(0)'],dependsOn:['a']}]});
  const result=await verify(root,c);assert.notEqual(result.exitCode,0);assert.equal(result.tasks[1].status,'blocked');
  assert.throws(()=>taskOrder([{id:'a',dependsOn:['b']},{id:'b',dependsOn:['a']}]),/cycle/);
});
test('missing tools, timeout and disabled required tasks never pass',async()=>{
  const root=fixture(),c=config(root,{tasks:[{id:'missing',argv:['harness-no-such-executable']},{id:'slow',argv:['bun','-e','setTimeout(()=>{},60000)'],timeoutMs:100},{id:'off',argv:['bun','-e','process.exit(0)'],enabled:false}]});
  const r=await verify(root,c);assert.notEqual(r.exitCode,0);
  assert.deepEqual(r.tasks.map(t=>t.status),['blocked','blocked','skipped']);
  assert.equal(r.tasks[1].reason,'timeout');
});
test('required unconfigured workspace is explicit; optional missing test is not-configured',async()=>{
  const root=fixture();const a=await verify(root,config(root));assert.equal(a.status,'not-configured');
  const b=await verify(root,config(root,{tests:{requireConfiguredTask:true}}));assert.notEqual(b.exitCode,0);
});
test('workspace-local command and pre-aborted cancellation',async()=>{
  const root=fixture({'custom/ok.mjs':"if(!process.cwd().endsWith('custom'))process.exit(1)"});
  const c=config(root,{workspaces:[{id:'custom',root:'custom'}],tasks:[{id:'check',workspace:'custom',argv:['bun','ok.mjs']}]});
  assert.equal((await verify(root,c)).exitCode,0);
  const controller=new AbortController();controller.abort();assert.equal((await verify(root,c,{signal:controller.signal})).tasks[0].status,'blocked');
});
test('targeted task execution does not claim or require unselected workspace tests',async()=>{
  const root=fixture({'a/.keep':'','b/.keep':''});
  const c=config(root,{workspaces:[{id:'a',root:'a'},{id:'b',root:'b'}],tests:{requireConfiguredTask:true},tasks:[{id:'a:test',workspace:'a',argv:['bun','-e','process.exit(0)']},{id:'b:test',workspace:'b',argv:['bun','-e','process.exit(1)']}]});
  const r=await verify(root,c,{selected:['a:test']});assert.equal(r.exitCode,0);assert.equal(r.workspaces[1].status,'not-selected');
});

test('one declared aggregate task covers multiple required workspaces without duplicate execution',async()=>{
  const root=fixture({'apps/web/.keep':'','tools/custom/.keep':'','check.mjs':"import fs from 'node:fs';fs.appendFileSync('calls.txt','once');"});
  const c=config(root,{workspaces:[{id:'root',root:'.'},{id:'web',root:'apps/web'},{id:'custom',root:'tools/custom'}],tests:{requireConfiguredTask:true},tasks:[{id:'all-tests',workspace:'root',argv:['bun','check.mjs'],covers:['root','web','custom']}]});
  const result=await verify(root,c);assert.equal(result.exitCode,0);
  assert.equal(result.tasks.length,1);assert.ok(result.workspaces.every(w=>w.status==='passed'));
  assert.equal(fs.readFileSync(path.join(root,'calls.txt'),'utf8'),'once');
});
test('Windows cmd shim launches with restricted arguments',async()=>{
  if(process.platform!=='win32')return;
  const root=fixture({'with space/check.cmd':'@echo off\r\nexit /b 0\r\n'});
  const command=path.join(root,'with space/check.cmd');
  const c=config(root,{tasks:[{id:'shim',argv:[command,'simple-arg']}]});
  assert.equal((await verify(root,c)).exitCode,0);
  c.tasks[0].argv.push('unsafe&arg');assert.equal((await verify(root,c)).tasks[0].status,'blocked');
});
