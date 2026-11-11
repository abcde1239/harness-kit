import { test, setDefaultTimeout } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture, write } from './helpers.mjs';
import { packageDistribution } from '../scripts/package-distribution.mjs';
import { hash, safePath } from '../src/fs.mjs';
import { version } from '../package.json';
setDefaultTimeout(30000);

function extract(archive,destination) {
  const result=process.platform==='win32'
    ? Bun.spawnSync(['powershell.exe','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:HARNESS_TEST_ARCHIVE, $env:HARNESS_TEST_DESTINATION)"],{stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_TEST_ARCHIVE:archive,HARNESS_TEST_DESTINATION:destination}})
    : Bun.spawnSync(['unzip','-q',archive,'-d',destination],{stdout:'pipe',stderr:'pipe'});
  assert.equal(result.exitCode,0,Buffer.from(result.stderr).toString());
}
function call(entry,root,...args) {
  const result=Bun.spawnSync([process.execPath,entry,...args,'--root',root,'--json'],{cwd:root,stdout:'pipe',stderr:'pipe',env:{...process.env,HARNESS_ACTIVE:''}});
  const data=JSON.parse(Buffer.from(result.stdout.length?result.stdout:result.stderr).toString());
  assert.equal(result.exitCode,0,JSON.stringify(data));return data;
}

test('skill and plugin ZIPs work after native extraction and relocation with no setup or global launcher',async()=>{
  const base=fixture(),destination=path.join(base,'output with spaces');
  const result=await packageDistribution(destination);
  assert.equal(result.requiresSetup,false);assert.equal(result.published,false);
  assert.equal(result.archives.length,3);
  const manifest=JSON.parse(fs.readFileSync(path.join(destination,'distribution.json'),'utf8'));
  for(const entry of manifest.entries)assert.equal(hash(fs.readFileSync(safePath(destination,entry.path))),entry.sha256,entry.path);
  const extracted=path.join(base,'relocated marketplace');
  extract(path.join(destination,`harness-kit-marketplace-${version}.zip`),extracted);
  const marketplace=path.join(extracted,'marketplace');
  const codex=JSON.parse(fs.readFileSync(path.join(marketplace,'.agents/plugins/marketplace.json'),'utf8'));
  const claude=JSON.parse(fs.readFileSync(path.join(marketplace,'.claude-plugin/marketplace.json'),'utf8'));
  assert.equal(codex.plugins[0].name,claude.plugins[0].name);
  const plugin=safePath(marketplace,codex.plugins[0].source.path);
  assert.equal(safePath(marketplace,claude.plugins[0].source),plugin);
  assert.equal(JSON.parse(fs.readFileSync(path.join(plugin,'plugin.json'),'utf8')).version,version);
  assert.equal(JSON.parse(fs.readFileSync(path.join(plugin,'.claude-plugin/plugin.json'),'utf8')).name,'harness-kit');
  const project=fixture({'package.json':{packageManager:'bun@1.3.4',scripts:{test:'bun test ./tests'}},'tests/result.test.ts':"import {test,expect} from 'bun:test'; test('result',()=>expect(6*7).toBe(42));"});
  // Models use the script path from the installed skill. No install.mjs or PATH shim.
  const entry=path.join(plugin,'skills/harness-kit/scripts/harness.mjs');
  assert.equal(call(entry,project,'init','--hosts','claude,dsh','--private','--yes').readiness.status,'ready');
  assert.equal(fs.existsSync(path.join(base,'bin')),false);
  const skillExtracted=path.join(base,'agent skills');
  extract(path.join(destination,`harness-kit-skill-${version}.zip`),skillExtracted);
  const skillEntry=path.join(skillExtracted,'harness-kit/scripts/harness.mjs');
  assert.equal(call(skillEntry,project,'doctor').status,'ready');
  const nativeExtracted=path.join(base,'dsh plugins');
  extract(path.join(destination,`harness-kit-dsh-${version}.zip`),nativeExtracted);
  assert.ok(fs.existsSync(path.join(nativeExtracted,'harness-kit/package.json')));
  assert.equal(call(path.join(nativeExtracted,'harness-kit/skills/harness-kit/scripts/harness.mjs'),project,'--version').version,version);
  assert.equal(fs.existsSync(path.join(plugin,'MEMORY.md')),false);
  assert.equal(fs.existsSync(path.join(plugin,'src')),false);
  assert.equal(fs.existsSync(path.join(plugin,'scripts/install.mjs')),false);
});

test('distribution packages are deterministic and refuse to overwrite an existing target',async()=>{
  const base=fixture(),one=await packageDistribution(path.join(base,'one')),two=await packageDistribution(path.join(base,'two'));
  assert.deepEqual(one.archives,two.archives);
  write(one.destination,'user-file.txt','keep this');
  await assert.rejects(()=>packageDistribution(one.destination),/destination exists/);
  assert.equal(fs.readFileSync(path.join(one.destination,'user-file.txt'),'utf8'),'keep this');
  assert.equal(fs.readdirSync(base).some(name=>name.includes('.staging-')),false);
});
