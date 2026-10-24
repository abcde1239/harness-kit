import {test,setDefaultTimeout} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,write} from './helpers.mjs';
import {install} from '../scripts/install.mjs';
import {packageSkill} from '../scripts/package-skill.mjs';
import {validateSkill} from '../scripts/validate-skill.mjs';
import {inspect} from '../src/discovery.mjs';
setDefaultTimeout(15000);

test('portable installed Skill bundle executes independently from source repository',async()=>{
  const base=fixture(),target=fixture({'README.md':'Project','package.json':{packageManager:'bun@1.3.4',scripts:{test:'bun test'}},'go.mod':'module example/mixed'}),skillDir=path.join(base,'skills/harness-kit'),binDir=path.join(base,'bin');
  const result=await install({skillDir,binDir});assert.equal(result.status,'installed');
  assert.ok(fs.existsSync(path.join(skillDir,'SKILL.md')));
  const r=Bun.spawnSync([process.execPath,path.join(skillDir,'scripts/harness.mjs'),'inspect','--json'],{cwd:target,stdout:'pipe',stderr:'pipe'});
  assert.equal(r.exitCode,0,Buffer.from(r.stderr).toString());
  const scan=JSON.parse(Buffer.from(r.stdout).toString());
  assert.equal(scan.root,fs.realpathSync(target));
  assert.equal(scan.suggestedConfig.tasks.length,2);
  assert.deepEqual(scan.suggestedConfig.workspaces[0].tests.include,[]);
  assert.equal((await install({skillDir,binDir})).changed.length,0);
});
test('short launcher preserves target cwd and quoted arguments',async()=>{
  const base=fixture(),target=fixture({'README.md':'x'}),skillDir=path.join(base,'skill with spaces'),binDir=path.join(base,'bin with spaces');
  await install({skillDir,binDir});
  const r=process.platform==='win32'
    ? Bun.spawnSync(['cmd.exe','/d','/s','/c',`""${path.join(binDir,'harness.cmd')}" inspect --json"`],{cwd:target,windowsVerbatimArguments:true,stdout:'pipe',stderr:'pipe'})
    : Bun.spawnSync([path.join(binDir,'harness'),'inspect','--json'],{cwd:target,stdout:'pipe',stderr:'pipe'});
  assert.equal(r.exitCode,0,Buffer.from(r.stderr).toString());
  assert.equal(JSON.parse(Buffer.from(r.stdout).toString()).root,fs.realpathSync(target));
});
test('installer previews only and refuses to overwrite unrelated launchers or modified skill',async()=>{
  const base=fixture(),skillDir=path.join(base,'skill'),binDir=path.join(base,'bin');
  assert.equal((await install({skillDir,binDir,dryRun:true})).status,'preview');
  assert.equal(fs.existsSync(skillDir),false);
  write(base,`bin/${process.platform==='win32'?'harness.cmd':'harness'}`,'unrelated');
  await assert.rejects(()=>install({skillDir,binDir}),/Preserving/);
  assert.equal(fs.existsSync(skillDir),false);
  const other=fixture(),dirs={skillDir:path.join(other,'skill'),binDir:path.join(other,'bin')};
  await install(dirs);write(other,'skill/SKILL.md','modified');
  await assert.rejects(()=>install(dirs),/Preserving/);
});
test('packaged skill has no unfinished resources and bundled CLI validates missing requirements',async()=>{
  const root=fixture(),destination=path.join(root,'packaged');await packageSkill(destination);
  const text=fs.readFileSync(path.join(destination,'SKILL.md'),'utf8');
  assert.match(text,/^---\r?\nname: harness-kit\r?\n/);
  for(const newline of ['\n','\r\n']) {
    fs.writeFileSync(path.join(destination,'SKILL.md'),text.replace(/\r?\n/g,newline));
    assert.equal(validateSkill(destination).status,'passed');
  }
  for(const match of text.matchAll(/\]\((references\/[^)]+)\)/g))assert.ok(fs.existsSync(path.join(destination,match[1])));
  const r=Bun.spawnSync([process.execPath,path.join(destination,'scripts/harness.mjs'),'setup','--yes','--json'],{cwd:fixture(),stdout:'pipe',stderr:'pipe'});
  assert.equal(r.exitCode,2);assert.ok(Buffer.from(r.stderr).toString().includes('未回答'));
});

test('distributed Skill adapts gen-new monorepo, runs native tests and enforces publication boundary',async()=>{
  const base=fixture(),destination=path.join(base,'skill');await packageSkill(destination);
  const root=fixture({
    'package.json':{packageManager:'bun@1.3.4',workspaces:['apps/*']},
    'apps/web/package.json':{scripts:{test:'bun test ./tests'}},
    'apps/web/src/sum.ts':'export const sum=(a:number,b:number)=>a+b;',
    'apps/web/tests/sum.test.ts':"import {test,expect} from 'bun:test'; import {sum} from '../src/sum'; test('sum',()=>expect(sum(1,2)).toBe(3));",
    'tools/custom/check.mjs':"if(!process.cwd().endsWith('custom'))process.exit(2);",
    'docs/agent_guide.md':'User gen-new guide',
    'scripts/verify.sh':'# User verification entry',
    '.agent/codex/context.md':'User agent context',
    'MEMORY.md':'Private project notes',
    'docs/decision/ADR.md':'Private architecture reasoning',
    'docs/public/usage.md':'Public usage information',
    'README.md':'# Public project'
  });
  const c=inspect(root).suggestedConfig;c.repository.visibility='private';
  c.workspaces.push({id:'custom',root:'tools/custom',tests:{requireConfiguredTask:true}});
  c.workspaces.find(w=>w.id==='apps-web').tests={include:['tests/**/*.test.ts'],requireConfiguredTask:true};
  c.tasks.push({id:'custom:test',workspace:'custom',kind:'test',argv:['bun','check.mjs']});
  c.documents.publicPatterns=['README.md'];
  write(root,'.harness/answers.json',{config:c});
  const run=(...args)=>{
    const r=Bun.spawnSync([process.execPath,path.join(destination,'scripts/harness.mjs'),...args,'--root',root,'--json'],{cwd:root,stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_ACTIVE:''}});
    return {code:r.exitCode,data:JSON.parse(Buffer.from(r.exitCode===2?r.stderr:r.stdout).toString())};
  };
  assert.equal(run('plan','--answers','.harness/answers.json','--out','.harness/plan.json').code,0);
  const applied=run('apply','--plan','.harness/plan.json');
  assert.equal(applied.code,1);assert.deepEqual(applied.data.conflicts,['docs/agent_guide.md']);
  assert.equal(fs.readFileSync(path.join(root,'docs/agent_guide.md'),'utf8'),'User gen-new guide');
  assert.equal(fs.readFileSync(path.join(root,'scripts/verify.sh'),'utf8'),'# User verification entry');
  assert.equal(fs.readFileSync(path.join(root,'.agent/codex/context.md'),'utf8'),'User agent context');
  assert.equal(run('lint').code,0);
  const checked=run('verify');assert.equal(checked.code,0,JSON.stringify(checked.data));
  assert.deepEqual(checked.data.verification.tasks.map(t=>t.status),['passed','passed']);
  assert.equal(checked.data.verification.workspaces.find(w=>w.id==='root').status,'not-configured');
  const exported=run('export','--destination','artifacts/public','--manifest-out','.harness/publication.json');
  assert.equal(exported.code,0,JSON.stringify(exported.data));
  assert.deepEqual(exported.data.manifest.entries.map(e=>e.path).sort(),['README.md','docs/public/usage.md']);
  assert.equal(fs.existsSync(path.join(root,'artifacts/public/MEMORY.md')),false);
  assert.equal(fs.existsSync(path.join(root,'artifacts/public/.git')),false);
  assert.equal(run('publication-check','--manifest','.harness/publication.json').code,0);
  write(root,'artifacts/public/MEMORY.md','Private project notes');
  const leaked=run('publication-check','--manifest','.harness/publication.json');
  assert.equal(leaked.code,1);assert.ok(leaked.data.findings.some(f=>f.protected));
});
