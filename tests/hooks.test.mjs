import {test} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,write} from './helpers.mjs';
import {makePlan,applyPlan} from '../src/planner.mjs';
import {loadConfig} from '../src/config.mjs';
import {connectHooks,hookEvent,inspectHooks} from '../src/hooks.mjs';
import {verifyProject} from '../src/workflow.mjs';

function project(){const root=fixture({'check.mjs':'console.log("ok");'});applyPlan(root,makePlan(root,{visibility:'private',testCommands:{root:['bun','check.mjs']}}));return root;}
const input={session_id:'session with / unsafe chars',hook_event_name:'SessionStart'};

test('project hooks preserve third-party handlers, are idempotent, and protect user edits',async()=>{
  const root=project(),user={matcher:'startup',hooks:[{type:'command',command:'echo user'}]};
  write(root,'.codex/hooks.json',{description:'User config',hooks:{SessionStart:[user]}});
  const first=await connectHooks(root);assert.equal(first.status,'configured');
  const location=path.join(root,'.codex/hooks.json'),saved=JSON.parse(fs.readFileSync(location,'utf8'));
  assert.equal(saved.description,'User config');assert.deepEqual(saved.hooks.SessionStart[0],user);
  assert.equal(saved.hooks.Stop.length,1);
  assert.equal((await connectHooks(root)).changed.length,0);
  saved.hooks.Stop[0].hooks[0].command='user modified';write(root,'.codex/hooks.json',saved);
  assert.equal((await connectHooks(root)).status,'conflicts');
  assert.equal(JSON.parse(fs.readFileSync(location,'utf8')).hooks.Stop[0].hooks[0].command,'user modified');
});

test('Stop only requests verification after a session change and continuation is bounded',async()=>{
  const root=project();
  assert.ok(hookEvent(root,input).hookSpecificOutput.additionalContext);
  assert.deepEqual(hookEvent(root,{...input,hook_event_name:'Stop'}),{});
  write(root,'src/changed.mjs','export const changed=true;');
  assert.equal(hookEvent(root,{...input,hook_event_name:'Stop'}).decision,'block');
  hookEvent(root,{...input,source:'resume'});
  hookEvent(root,{...input,source:'compact'});
  assert.equal(hookEvent(root,{...input,hook_event_name:'Stop'}).decision,'block');
  const bounded=hookEvent(root,{...input,hook_event_name:'Stop',stop_hook_active:true});
  assert.equal(bounded.decision,undefined);assert.ok(bounded.systemMessage);
  await verifyProject(root,loadConfig(root));
  assert.deepEqual(hookEvent(root,{...input,hook_event_name:'Stop'}),{});
});

test('generated runtime executes from a nested cwd and never runs tests inside a hook',async()=>{
  const root=project();await connectHooks(root);
  fs.mkdirSync(path.join(root,'nested'));
  const runtime=path.join(root,'.harness/hooks/runtime.mjs');
  const call=event=>Bun.spawnSync([process.execPath,runtime,'hook','--root',root],{cwd:path.join(root,'nested'),stdin:Buffer.from(JSON.stringify(event)),stdout:'pipe',stderr:'pipe'});
  const started=call(input);assert.equal(started.exitCode,0,Buffer.from(started.stderr).toString());
  assert.ok(JSON.parse(Buffer.from(started.stdout).toString()).hookSpecificOutput);
  write(root,'check.mjs','await Bun.write("should-not-run.txt","side effect");');
  const stopped=call({...input,hook_event_name:'Stop'});assert.equal(stopped.exitCode,0);
  assert.equal(JSON.parse(Buffer.from(stopped.stdout).toString()).decision,'block');
  assert.equal(fs.existsSync(path.join(root,'should-not-run.txt')),false);
});

test('modified hook runtime is preserved and missing session does not force an unrelated conversation',async()=>{
  const root=project();await connectHooks(root);
  write(root,'.harness/hooks/runtime.mjs','user changed runtime');
  assert.deepEqual((await connectHooks(root)).conflicts,['.harness/hooks/runtime.mjs']);
  assert.equal(hookEvent(root,{...input,hook_event_name:'Stop'}).decision,undefined);
  assert.throws(()=>hookEvent(root,{hook_event_name:'SessionStart'}),/session_id/);
});

test('explicit local hook disable is preserved and diagnosed instead of reported as configured',async()=>{
  const disabled=project();write(disabled,'.codex/config.toml','[features]\nhooks = false\n');
  const result=await connectHooks(disabled);
  assert.equal(result.status,'disabled');assert.equal(result.exitCode,1);
  assert.equal(fs.existsSync(path.join(disabled,'.codex/hooks.json')),false);
  const root=project();await connectHooks(root);
  assert.equal(inspectHooks(root).status,'configured');
  write(root,'.codex/config.toml','features.hooks = false\n');
  assert.equal(inspectHooks(root).status,'disabled');
});
