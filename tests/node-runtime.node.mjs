import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {packageDistribution} from '../scripts/package-distribution.mjs';
import {install} from '../scripts/install.mjs';
import {runProcess} from '../src/subprocess.mjs';
import {installFromLink,runCommand,packageRuntime} from '../scripts/install-plugin.mjs';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'harness-node-'));
const nodeOnly={...process.env,PATH:[path.dirname(process.execPath),...(process.platform==='win32'?[path.join(process.env.SystemRoot??'C:/Windows','System32')]:['/usr/bin','/bin'])].join(path.delimiter),HARNESS_ACTIVE:''};
let distribution,entry;
function fixture(name,files={}){const root=path.join(base,name);fs.mkdirSync(root,{recursive:true});for(const [relative,data]of Object.entries(files)){const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof data==='string'?data:JSON.stringify(data));}return root;}
function call(script,root,args=[],{input,expected=0,env=nodeOnly}={}){
 const child=spawnSync(process.execPath,[script,...args,'--root',root,...(args[0]==='hook'?[]:['--json'])],{cwd:root,env,input,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.ifError(child.error);assert.equal(child.status,expected,child.stderr||child.stdout);return JSON.parse(child.stdout||child.stderr);
}
function project(name){return fixture(name,{'package.json':{packageManager:'npm@10.9.0',scripts:{test:'node --test tests/check.test.mjs'}},'tests/check.test.mjs':"import{test}from'node:test';import assert from'node:assert/strict';test('result',()=>assert.equal(2+3,5));",'AGENTS.md':'# 用户约定\n保留现有中文内容。\n'});}
function init(script,root,extra=[]){return call(script,root,['init','--private','--test','node --test tests/check.test.mjs','--yes',...extra]);}
before(async()=>{
 assert.equal(process.versions.bun,undefined,'Run this suite with Node.js');
 distribution=await packageDistribution(path.join(base,'distribution with spaces'));
 entry=path.join(distribution.destination,'skill/harness-kit/scripts/harness.mjs');
});
after(()=>{assert.equal(path.dirname(base),os.tmpdir());assert.ok(path.basename(base).startsWith('harness-node-'));fs.rmSync(base,{recursive:true,force:true});});

test('source and all three portable formats run under Node without Bun on PATH',()=>{
 const root=project('portable');
 assert.equal(init(path.join(repository,'bin/harness.mjs'),root,['--hosts','codex,claude,gemini,cursor,opencode,dsh','--hooks']).readiness.status,'ready');
 for(const relative of ['skill/harness-kit','marketplace/plugins/harness-kit/skills/harness-kit','native-dsh/harness-kit/skills/harness-kit']){
  const relocated=path.join(base,'relocated '+relative.replaceAll('/','_'));fs.cpSync(path.join(distribution.destination,relative),relocated,{recursive:true});
  assert.equal(call(path.join(relocated,'scripts/harness.mjs'),root,['doctor']).status,'ready');
  assert.ok(fs.existsSync(path.join(relocated,'licenses/yaml.txt')));
 }
 assert.ok(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8').startsWith('# 用户约定\n保留现有中文内容。\n'));
 const record=JSON.parse(fs.readFileSync(path.join(root,'.harness/verification.json'),'utf8'));
 assert.equal(record.environment.node,process.versions.node);assert.equal(record.environment.bun,undefined);
});

test('Node verification, durable acceptance and source freshness retain their gates',()=>{
 const root=project('acceptance');init(entry,root);
 call(entry,root,['task','start','sum','--accept','Two plus three is five']);
 call(entry,root,['run','--work','sum']);
 call(entry,root,['task','finish','sum'],{expected:1});
 call(entry,root,['task','accept','sum','--criterion','c1','--evidence','Node test checks 2+3=5']);
 assert.equal(call(entry,root,['task','finish','sum']).task.state,'completed');
 fs.writeFileSync(path.join(root,'changed.mjs'),'export const changed=true;');
 assert.notEqual(call(entry,root,['doctor'],{expected:1}).status,'ready');
 call(entry,root,['task','finish','sum'],{expected:1});
});

test('Node hooks are standalone after relocation and respect local TOML disable',()=>{
 const root=project('hooks');assert.equal(init(entry,root,['--hooks']).hooks.status,'configured');
 const runtime=path.join(root,'.harness/hooks/runtime.mjs'),event={session_id:'node-session',hook_event_name:'SessionStart'};
 assert.ok(call(runtime,root,['hook'],{input:JSON.stringify(event)}).hookSpecificOutput);
 fs.writeFileSync(path.join(root,'change.txt'),'changed');
 const stop=call(runtime,root,['hook'],{input:JSON.stringify({...event,hook_event_name:'Stop'})});assert.equal(stop.decision,'block');
 const bounded=call(runtime,root,['hook'],{input:JSON.stringify({...event,hook_event_name:'Stop',stop_hook_active:true})});assert.equal(bounded.decision,undefined);assert.ok(bounded.systemMessage);
 const disabled=project('disabled');fixture('disabled/.codex',{'config.toml':'[features]\nhooks = false\n'});
 assert.equal(call(entry,disabled,['init','--private','--test','node --test tests/check.test.mjs','--yes','--hooks'],{expected:1}).hooks.status,'disabled');
 assert.equal(fs.existsSync(path.join(disabled,'.codex/hooks.json')),false);
});

test('Node runner preserves configured Bun commands and reports missing tools',()=>{
 const root=project('runtime-not-substituted');
 // Bun is intentionally absent; running a Node process in its place would pass incorrectly.
 const result=call(entry,root,['init','--private','--test','bun -e process.exit(0)','--yes'],{expected:2});
 assert.equal(result.verification.tasks[0].status,'blocked');assert.notEqual(result.readiness.status,'ready');
});

test('Node subprocess timeouts, cancellation, missing commands and output bounds are observable',async()=>{
 const timeout=await runProcess([process.execPath,'-e','setInterval(()=>{},1000)'],{timeoutMs:100,env:nodeOnly});assert.equal(timeout.reason,'timeout');
 const controller=new AbortController();setTimeout(()=>controller.abort(),100);
 const cancelled=await runProcess([process.execPath,'-e','setInterval(()=>{},1000)'],{signal:controller.signal,env:nodeOnly});assert.equal(cancelled.reason,'cancelled');
 await assert.rejects(()=>runProcess(['harness-intentionally-missing-command'],{env:nodeOnly}),/ENOENT/);
 const output=await runProcess([process.execPath,'-e',"process.stdout.write('x'.repeat(100000))"],{maxOutput:1024,env:nodeOnly});assert.equal(output.exitCode,0);assert.equal(output.stdout.length,1024);
 const native=await runCommand([process.execPath,'--version']);assert.equal(native.exitCode,0);assert.match(native.stdout,/^v\d+/);
});

test('Node source setup writes reusable launchers and protects modified installed resources',async()=>{
 const skillDir=path.join(base,'installed skill'),binDir=path.join(base,'short commands');
 assert.equal((await install({skillDir,binDir})).status,'installed');assert.deepEqual((await install({skillDir,binDir,dryRun:true})).changed,[]);
 const root=project('installed');assert.equal(init(path.join(skillDir,'scripts/harness.mjs'),root).readiness.status,'ready');
 fs.appendFileSync(path.join(skillDir,'SKILL.md'),'\nUser customization\n');await assert.rejects(()=>install({skillDir,binDir}),/modified/);
});

test('Node standalone installer asks for location and installs complete local Skill resources',async()=>{
 const installer=path.join(distribution.destination,'install-plugin.mjs');
 const response=spawnSync(process.execPath,[installer,'--source','https://github.com/abcde1239/harness-kit','--host','skill'],{env:nodeOnly,encoding:'utf8',timeout:10000});
 assert.equal(response.status,0,response.stderr);assert.equal(JSON.parse(response.stdout).status,'needs-location');
 const location=path.join(base,'link installed skill');const result=await installFromLink({source:distribution.destination,host:'skill',location});assert.equal(result.status,'installed');
 assert.equal(init(path.join(location,'scripts/harness.mjs'),project('link installed')).readiness.status,'ready');
 assert.equal((await installFromLink({source:distribution.destination,host:'skill',location})).directory,location);
 assert.throws(()=>packageRuntime({kind:'skill',files:new Map()}),/existing v0.5.0 archives require Bun/);
});

test('Windows Node runner supports guarded .cmd shims and rejects shell metacharacters',()=>{
 if(process.platform!=='win32')return;
 const root=project('windows shim');fixture('windows shim/tools',{'check.cmd':'@echo off\r\nexit /b 0\r\n'});
 const command='"'+path.join(root,'tools/check.cmd')+'" plain';
 assert.equal(call(entry,root,['init','--private','--test',command,'--yes']).readiness.status,'ready');
 const config=JSON.parse(fs.readFileSync(path.join(root,'harness.config.json'),'utf8'));config.tasks[0].argv.push('unsafe&arg');fs.writeFileSync(path.join(root,'harness.config.json'),JSON.stringify(config));
 assert.equal(call(entry,root,['run'],{expected:2}).verification.tasks[0].status,'blocked');
});
