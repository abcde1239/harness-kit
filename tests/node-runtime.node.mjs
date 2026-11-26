import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parse as parseToml} from 'smol-toml';
import {parse as parseYaml} from 'yaml';
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

test('bundled CLI checks public document placement in check and run', () => {
 const root = project('public document layout');
 init(entry, root);
 const configPath = path.join(root, 'harness.config.json');
 const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
 config.documents.layout = [{ id: 'public-pages', match: ['docs/public/**/*.md'], allow: ['docs/public/guides/**'] }];
 fs.writeFileSync(configPath, JSON.stringify(config));
 const publicRoot = path.join(root, 'docs/public');
 const loose = path.join(publicRoot, 'setup.md');
 fs.writeFileSync(loose, '# Setup');
 const check = call(entry, root, ['check'], { expected: 1 });
 assert.equal(check.findings.find(f => f.ruleId === 'documents.layout').path, 'docs/public/setup.md');
 const run = call(entry, root, ['run'], { expected: 1 });
 assert.deepEqual(run.governance.findings, check.findings);
 assert.equal(run.verification.tasks[0].status, 'passed');
 assert.equal(run.evidence.status, 'failed');
 fs.renameSync(loose, path.join(publicRoot, 'guides/setup.md'));
 assert.equal(call(entry, root, ['run']).evidence.status, 'passed');
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

test('portable Node CLI discovers and validates a project-owned stack without language-specific runtime',()=>{
 const root=fixture('custom stack',{'project.custom':'','suite/result.check':'','harness.adapters.json':{schemaVersion:1,recipes:[{id:'custom-stack',markers:['**/project.custom'],tests:{detect:['**/*.check'],include:['suite/**']},tasks:[{id:'test',argv:[process.execPath,'-e','if (2+3!==5) process.exit(1)']}]}]}});
 assert.equal(call(entry,root,['init','--private','--yes']).readiness.status,'ready');
 const config=JSON.parse(fs.readFileSync(path.join(root,'harness.config.json'),'utf8'));
 assert.equal(config.tasks[0].id,'root:custom-stack:test');assert.deepEqual(config.tests.detect.includes('**/test_*.py'),true);
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/misplaced.check'),'');
 const result=call(entry,root,['check'],{expected:1});assert.ok(result.findings.some(f=>f.ruleId==='tests.layout'&&f.path==='src/misplaced.check'));
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

test('packaged Node CLI allocates, pins and previews artifact runs without project setup', () => {
  const root = project('artifacts');
  const run = call(entry, root, ['artifacts', 'create', 'checkout-e2e']);
  assert.match(run.path, /^artifacts\/runs\/\d{8}-checkout-e2e-[a-f0-9]{8}$/);
  assert.ok(fs.existsSync(path.join(root, run.path, 'run.json')));
  assert.equal(call(entry, root, ['artifacts', 'finish', run.id]).status, 'finished');
  assert.equal(call(entry, root, ['artifacts', 'keep', run.id]).status, 'kept');
  const preview = call(entry, root, ['artifacts', 'clean']);
  assert.equal(preview.retentionDays, 14);
  assert.equal(preview.items[0].status, 'kept');
});

test('packaged Node CLI previews Hook session retention separately from artifact retention', () => {
  const root = project('hook-cleanup');
  assert.equal(call(entry, root, ['hooks', 'clean']).retentionDays, 30);
  assert.ok(!fs.existsSync(path.join(root, '.harness')));
  init(entry, root, ['--hooks']);
  const runtime = path.join(root, '.harness/hooks/runtime.mjs');
  call(runtime, root, ['hook'], { input: JSON.stringify({ session_id: 'node session', hook_event_name: 'SessionStart' }) });
  assert.deepEqual(call(entry, root, ['hooks', 'clean', '--yes']).items.map(item => item.status), ['recent']);
  assert.equal(call(entry, root, ['doctor']).checks.find(check => check.id === 'hooks').hooks.status, 'configured');
});


test('portable roles use native formats and only configure the selected host and specialists',()=>{
 const root=fixture('native roles');
 const cli=path.join(base,'standalone role cli.mjs');
 fs.copyFileSync(entry,cli);
 const catalog=call(cli,root,['roles']);
 assert.equal(catalog.roles.length,9);
 assert.equal(catalog.roles.find(role=>role.id==='qa').name,'tester');
 const nativeDirectories={codex:'.codex',claude:'.claude',gemini:'.gemini',cursor:'.cursor',opencode:'.opencode'};
 for(const [host,directory] of Object.entries(nativeDirectories)){
  const args=['roles','--host',host,'--role','frontend,code-reviewer,agent-expert'];
  const preview=call(cli,root,args);
  assert.equal(preview.status,'preview');
  assert.equal(fs.existsSync(path.join(root,directory)),false);
  assert.equal(call(cli,root,[...args,'--yes']).changed.length,3);
  for(const role of preview.roles){
   const content=fs.readFileSync(path.join(root,role.path),'utf8');
   const metadata=host==='codex'?parseToml(content):parseYaml(content.split('---\n')[1]);
   assert.equal(role.name,role.id);
   assert.equal(path.basename(role.path,path.extname(role.path)),role.name);
   if(host==='opencode') assert.equal(metadata.mode,'subagent');
   else assert.equal(metadata.name,role.name);
   assert.equal(metadata.model,undefined);
   assert.equal(metadata.model_reasoning_effort,undefined);
   const prompt=host==='codex'?metadata.developer_instructions:content.split('---\n')[2];
   const focus={frontend:'Act as frontend expert.', 'code-reviewer':'Independently inspect implementation', 'agent-expert':'Locate the cause'};
   assert.ok(prompt.includes(focus[role.id]));
   if(role.id==='code-reviewer'){
    if(host==='cursor') assert.equal(metadata.readonly,true);
    if(host==='claude') assert.equal(metadata.tools,'Read, Glob, Grep');
    if(host==='opencode') assert.deepEqual(metadata.permissions.map(p=>p.effect),['deny','deny']);
   }
  }
  assert.deepEqual(call(cli,root,[...args,'--yes']).changed,[]);
 }
 const dsh=call(cli,root,['roles','--host','dsh','--role','qa','--yes']);
 assert.equal(dsh.status,'manual');
 assert.equal(dsh.roles[0].name,'tester');
 assert.equal(fs.existsSync(path.join(root,'.dsh')),false);
 assert.equal(fs.existsSync(path.join(root,'.harness')),false);
});

test('role configuration preserves custom edits and refuses other writers before applying',()=>{
 const root=fixture('role ownership',{'.codex/agents/frontend.toml':'# User-owned role\n'});
 const source=path.join(repository,'bin/harness.mjs');
 const result=call(source,root,['roles','--host','codex','--role','frontend,qa','--yes'],{expected:1});
 assert.deepEqual(result.conflicts,['.codex/agents/frontend.toml']);
 assert.equal(fs.readFileSync(path.join(root,result.conflicts[0]),'utf8'),'# User-owned role\n');
 assert.equal(fs.existsSync(path.join(root,'.codex/agents/tester.toml')),false);
 const args=['roles','--host','codex','--role','qa','--yes'];
 const [changed]=call(source,root,args).changed;
 const target=path.join(root,changed);
 fs.appendFileSync(target,'# User change\n');
 assert.deepEqual(call(source,root,args,{expected:1}).conflicts,[changed]);
 assert.match(fs.readFileSync(target,'utf8'),/User change/);
 const directory=path.join(root,'.gemini/agents/tester.md');
 fs.mkdirSync(directory,{recursive:true});
 const conflict=call(source,root,['roles','--host','gemini','--role','qa','--yes'],{expected:1});
 assert.deepEqual(conflict.conflicts,['.gemini/agents/tester.md']);
});


test('portable init connects selected hooks and runs Claude and DSH event protocols',()=>{
 const root=project('multi-host hooks');
 const claudeFile=path.join(root,'.claude/settings.local.json');
 const thirdParty={hooks:[{type:'command',command:'existing-hook'}]};
 fixture('multi-host hooks/.claude',{'settings.local.json':{permissions:{deny:['Write']},hooks:{Stop:[thirdParty]}}});
 const ready=init(entry,root,['--hosts','codex,claude,dsh','--hooks']);
 assert.equal(ready.hooks.status,'profile-required');
 assert.deepEqual(ready.hooks.entries.map(item=>[item.host,item.status]),[['codex','configured'],['claude','configured'],['dsh','profile-required']]);
 const bridge=ready.hooks.entries[2].bridge;
 assert.equal(bridge.configPath,path.join(root,'.harness/hooks/dsh/hooks.json'));
 const doctor = call(entry,root,['doctor']);
 assert.equal(doctor.hostRuntime,'not-confirmed');
 assert.equal(doctor.checks.find(item=>item.id==='hooks:dsh').hooks.status,'profile-required');
 const humanDoctor = spawnSync(process.execPath,[entry,'doctor','--root',root],{cwd:root,env:nodeOnly,encoding:'utf8',windowsHide:true,timeout:15000});
 assert.ifError(humanDoctor.error);
 assert.equal(humanDoctor.status,0,humanDoctor.stderr);
 assert.ok(humanDoctor.stdout.includes(`${bridge.name} configPath: ${bridge.configPath}`));
 const local=JSON.parse(fs.readFileSync(claudeFile,'utf8'));
 assert.deepEqual(local.permissions,{deny:['Write']});
 assert.deepEqual(local.hooks.Stop[0],thirdParty);
 assert.match(local.hooks.Stop[1].hooks[0].command,/--host.*claude/);
 const dshConfig=JSON.parse(fs.readFileSync(bridge.configPath,'utf8'));
 assert.match(dshConfig.hooks.Stop[0].hooks[0].command,/--host.*dsh/);
 const baseEvent={session_id:'shared-id',cwd:root};
 const event=(host,name,extra={})=>call(path.join(root,'.harness/hooks',host,'runtime.mjs'),root,['hook','--host',host],{input:JSON.stringify({...baseEvent,hook_event_name:name,...extra})});
 const launch = (handler, eventName) => {
  const shell = process.platform === 'win32'
   ? [path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), '-NoProfile', '-NonInteractive', '-Command']
   : ['/bin/sh', '-c'];
  const child = spawnSync(shell[0], [...shell.slice(1), handler.command], {
   cwd: root, env: nodeOnly, input: JSON.stringify({...baseEvent, hook_event_name:eventName, source:'startup'}),
   encoding:'utf8', windowsHide:true, timeout:15000,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
 };
 const claudeStart = local.hooks.SessionStart[0].hooks[0];
 if (process.platform === 'win32') assert.equal(claudeStart.shell, 'powershell');
 assert.ok(launch(claudeStart, 'SessionStart').hookSpecificOutput.additionalContext);
 assert.deepEqual(event('dsh','Stop'),{systemMessage:'Harness Kit: this session has no initial snapshot, so its change scope cannot be determined automatically. Run harness run as required by project instructions.'});
 assert.ok(launch(dshConfig.hooks.SessionStart[0].hooks[0], 'SessionStart').hookSpecificOutput.additionalContext);
 fs.writeFileSync(path.join(root,'changed.mjs'),'export const updated = true;');
 assert.equal(event('claude','Stop').decision,'block');
 assert.equal(event('claude','Stop',{stop_hook_active:true}).decision,undefined);
 assert.equal(event('dsh','Stop',{cwd:base}).decision,undefined);
 assert.equal(event('dsh','Stop',{stop_hook_active:false}).decision,'block');
 assert.deepEqual(event('dsh','Stop',{stop_hook_active:false}),{});
 call(entry,root,['run']);
 assert.deepEqual(event('dsh','Stop'),{});
 fs.appendFileSync(path.join(root,'changed.mjs'),'\nexport const changedAgain = true;');
 assert.equal(event('dsh','Stop').decision,'block');
 call(path.join(root,'.harness/hooks/claude/runtime.mjs'),root,['hook','--host','claude'],{input:'invalid JSON',expected:1});
 assert.equal(call(entry,root,['check']).status,'passed');
 assert.deepEqual(init(entry,root,['--hosts','claude','--hooks']).hooks.changed,[]);
 const changed=JSON.parse(fs.readFileSync(claudeFile,'utf8'));
 changed.hooks.Stop.pop();
 fs.writeFileSync(claudeFile,JSON.stringify(changed));
 const conflict=call(entry,root,['init','--private','--yes','--hosts','claude','--hooks'],{expected:1});
 assert.deepEqual(conflict.hooks.conflicts,['.claude/settings.local.json']);
 assert.deepEqual(JSON.parse(fs.readFileSync(claudeFile,'utf8')).hooks.Stop,[thirdParty]);
});
