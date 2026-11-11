import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixture, write } from './helpers.mjs';
import { dshPluginFiles, DSH_PLUGIN_PACKAGE, DSH_CONTRACT_SHA } from '../scripts/dsh-plugin.mjs';
import { skillFiles } from '../scripts/package-skill.mjs';
import { validateSkill } from '../scripts/validate-skill.mjs';
import { version } from '../package.json';

const smallSkill = (extra = '') => new Map([
  ['SKILL.md', Buffer.from(`---\nname: harness-kit\ndescription: Native test Skill\n${extra}---\n\nOriginal on-demand body.\n`)],
  ['scripts/harness.mjs', Buffer.from('console.log("CLI fixture");\n')],
  ['references/example.md', Buffer.from('Local supporting reference.\n')],
]);
function unpack(files) {
  const root=fixture(), directory=path.join(root,'native plugin with spaces'); fs.mkdirSync(directory);
  for(const [name,bytes] of files) write(directory,name,bytes);
  return directory;
}
async function load(directory) { return import(pathToFileURL(path.join(directory,'index.mjs')).href); }

// Contract fake for fixed-SHA SkillRegistry.registerProvider: Cordis owns the
// returned disposer and aborts the registration signal on fiber disposal.
// It deliberately does not claim real DSH profile loading or tool discovery.
function contractContext() {
  const providers=new Map(),disposers=[];
  const ctx={skills:{registerProvider(create){
    const lifecycle=new AbortController();
    const provider=create({signal:lifecycle.signal,invalidate(){}});
    assert.equal(typeof provider.name,'string');
    assert.equal(typeof provider.list,'function'); assert.equal(typeof provider.get,'function');
    if(providers.has(provider.name))throw new Error('Duplicate provider');
    providers.set(provider.name,provider);
    let active=true;
    const dispose=()=>{if(!active)return;active=false;providers.delete(provider.name);lifecycle.abort(new Error('Cordis provider disposed'));};
    disposers.push(dispose);return dispose;
  }}};
  return {ctx,providers,dispose(){for(const dispose of disposers.reverse())dispose();}};
}

test('native DSH bundle has an activatable Cordis manifest and complete unmodified Skill', async()=>{
  const input=smallSkill(),files=await dshPluginFiles(input),manifest=JSON.parse(files.get('package.json'));
  assert.equal(manifest.name,DSH_PLUGIN_PACKAGE); assert.equal(manifest.version,version);
  assert.equal(manifest.dsh.bundle.patch,'./cordis.patch.yml');
  assert.equal(manifest.exports['.'],'./index.mjs');
  assert.equal(manifest.dependencies,undefined); assert.equal(manifest.scripts,undefined);
  assert.equal(manifest.engines.dsh,'>=0.2.2-rc.1 <0.3.0');
  assert.ok(files.get('README.md').toString().includes(DSH_CONTRACT_SHA));
  assert.ok(files.get('README.md').toString().includes('dsh plugin --profile web add'));
  const patch=Bun.YAML.parse(files.get('cordis.patch.yml').toString());
  assert.equal(patch[0].insert[0].name,manifest.name);
  for(const [name,bytes] of input)assert.deepEqual(files.get(`skills/harness-kit/${name}`),bytes);
});

test('generated plugin registers natively, discovers catalog and reads the body only on demand',async()=>{
  const files=await dshPluginFiles(smallSkill()),directory=unpack(files);
  const instruction=path.join(directory,'skills/harness-kit/SKILL.md');
  const original=fs.readFileSync(instruction,'utf8');fs.unlinkSync(instruction);
  const plugin=await load(directory),context=contractContext();
  assert.deepEqual(plugin.inject,['skills']);
  plugin.apply(context.ctx); // Import/apply must work without reading the Skill.
  const provider=[...context.providers.values()][0];
  await assert.rejects(()=>provider.list({}),/ENOENT/);
  write(directory,'skills/harness-kit/SKILL.md',original);
  const [candidate]=await provider.list({cwd:fixture()});
  assert.equal(candidate.name,'harness-kit');assert.equal(candidate.content,undefined);
  assert.equal(candidate.source,'bundled'); assert.equal(candidate.rank,600);
  assert.deepEqual(candidate.invocation,{modelInvocable:true,userInvocable:true});
  const definition=await provider.get(candidate,{});
  assert.equal(definition.content,'Original on-demand body.');
  assert.equal(definition.path,instruction);
  assert.equal(definition.resourceBase.path,path.join(directory,'skills/harness-kit'));
  assert.ok(fs.readFileSync(path.join(definition.resourceBase.path,'references/example.md'),'utf8').includes('supporting'));
  write(directory,'skills/harness-kit/SKILL.md',original.replace('Original on-demand body.','Edited body for next invocation.'));
  assert.equal((await provider.get(candidate,{})).content,'Edited body for next invocation.');
  assert.equal(await provider.get({...candidate,locator:'../../outside.md'},{}),undefined);
  context.dispose();
});

test('Cordis disposal removes provider, aborts stale calls and permits clean remount',async()=>{
  const directory=unpack(await dshPluginFiles(smallSkill())),plugin=await load(directory),context=contractContext();
  plugin.apply(context.ctx);
  const provider=[...context.providers.values()][0],candidate=(await provider.list({}))[0];
  const caller=new AbortController();caller.abort(new Error('Lookup cancelled'));
  await assert.rejects(()=>provider.get(candidate,{signal:caller.signal}),/Lookup cancelled/);
  context.dispose();assert.equal(context.providers.size,0);
  await assert.rejects(()=>provider.list({}),/disposed/);
  await assert.rejects(()=>provider.get(candidate,{}),/disposed/);
  const remount=contractContext();plugin.apply(remount.ctx);
  assert.equal((await [...remount.providers.values()][0].list({})).length,1);remount.dispose();
  assert.throws(()=>plugin.apply({skills:{}}),/skills registry/);
});

test('packaged provider respects invocation metadata and rejects metadata mutations',async()=>{
  const directory=unpack(await dshPluginFiles(smallSkill('disable-model-invocation: true\nuser-invocable: false\nwhenToUse: Explicit invocation only\nmetadata:\n  kind: test\n')));
  const context=contractContext();(await load(directory)).apply(context.ctx);
  const provider=[...context.providers.values()][0],[candidate]=await provider.list({});
  assert.deepEqual(candidate.invocation,{modelInvocable:false,userInvocable:false});
  assert.equal(candidate.whenToUse,'Explicit invocation only');assert.deepEqual(candidate.metadata,{kind:'test'});
  const instruction=path.join(directory,'skills/harness-kit/SKILL.md');
  fs.writeFileSync(instruction,fs.readFileSync(instruction,'utf8').replace('Native test Skill','Changed routing'));
  await assert.rejects(()=>provider.get(candidate,{}),/metadata changed/);context.dispose();
});

test('native packager rejects missing, malformed and escaping resources',async()=>{
  await assert.rejects(()=>dshPluginFiles({}),/Map/);
  for(const resource of ['../outside.md','/absolute.md','C:/outside.md','a/../outside.md','a\\outside.md','.','a//b.md']) {
    const input=smallSkill();input.set(resource,Buffer.from('bad'));
    await assert.rejects(()=>dshPluginFiles(input));
  }
  const duplicate=smallSkill();duplicate.set('skill.md',Buffer.from('duplicate'));await assert.rejects(()=>dshPluginFiles(duplicate),/duplicate/);
  const missing=smallSkill();missing.delete('scripts/harness.mjs');await assert.rejects(()=>dshPluginFiles(missing),/bundled CLI/);
  const malformed=smallSkill();malformed.set('SKILL.md',Buffer.from('# Missing frontmatter'));await assert.rejects(()=>dshPluginFiles(malformed),/frontmatter/);
  await assert.rejects(()=>dshPluginFiles(smallSkill('user-invocable: perhaps\n')),/invocation/);
});

test('provider refuses symlinked resource roots escaping the plugin',async()=>{
  const directory=unpack(await dshPluginFiles(smallSkill())),context=contractContext();
  (await load(directory)).apply(context.ctx);
  const provider=[...context.providers.values()][0],skills=path.join(directory,'skills'),outside=fixture();
  fs.renameSync(skills,path.join(outside,'skills'));
  fs.symlinkSync(path.join(outside,'skills'),skills,process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>provider.list({}),/symlinks/);context.dispose();
});

test('complete native artifact passes Skill validation and its bundled CLI runs without setup',async()=>{
  const directory=unpack(await dshPluginFiles(await skillFiles()));
  const skill=path.join(directory,'skills/harness-kit');
  assert.equal(validateSkill(skill).status,'passed');
  const result=Bun.spawnSync([process.execPath,path.join(skill,'scripts/harness.mjs'),'--version'],{cwd:directory,timeout:15000});
  assert.equal(result.exitCode,0,result.stderr.toString());assert.equal(result.stdout.toString().trim(),version);
  const context=contractContext();(await load(directory)).apply(context.ctx);
  const provider=[...context.providers.values()][0],entry=(await provider.list({}))[0];
  const definition=await provider.get(entry,{});
  assert.ok(definition.content.includes('Harness Kit'));context.dispose();
});
