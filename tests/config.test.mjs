import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture,config } from './helpers.mjs';
import { validateConfig,defaults,effectiveTests } from '../src/config.mjs';
import { matches,safePath } from '../src/fs.mjs';
import { classify } from '../src/policy.mjs';

test('strict schema rejects versions, typos, duplicate IDs and invalid argv',()=>{
  const root = fixture();
  for (const change of [{schemaVersion:2},{taks:[]},{tasks:[{id:'x',argv:[]}]},{workspaces:[{id:'a',root:'.'},{id:'a',root:'.'}]},{rules:{'publication.internal':'off'}},{tasks:[{id:'a',argv:['bun'],dependsOn:['missing']}]},{repository:{visibility:'guess'}}]) assert.throws(()=>validateConfig({...defaults(),...change},root));
});
test('paths reject traversal, absolute paths and symlink ancestors',()=>{
  const root=fixture(),outside=fixture();
  for(const p of ['../escape','a/../../escape','C:/escape','a\\..\\escape']) assert.throws(()=>safePath(root,p));
  fs.symlinkSync(outside,path.join(root,'link'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>safePath(root,'link/new/file'));
});
test('portable glob handles root files and nested matches',()=>{
  assert.equal(matches('MEMORY.md','**/MEMORY.md'),true);
  assert.equal(matches('src/a/foo.test.ts','**/*.test.*'),true);
  assert.equal(matches('src/a/foo.ts','src/*.ts'),false);
});
test('workspace public overrides cannot weaken root internal policy',()=>{
  const root=fixture({'packages/a/secret.md':'x'});
  const c=config(root,{documents:{internalRoots:['packages/a'],publicRoots:[]},workspaces:[{id:'a',root:'packages/a',documents:{publicRoots:['.']},tests:{include:['**/*.spec.ts']}}]});
  assert.equal(classify(c,'packages/a/secret.md').audience,'internal');
  assert.equal(classify(c,'packages/a/secret.md').conflict,true);
  assert.deepEqual(effectiveTests(c,c.workspaces[0]).include,['**/*.spec.ts']);
});
test('memory and decisions stay protected even under broad public roots',()=>{
  const root=fixture(),c=config(root,{documents:{publicRoots:['.'],internalRoots:[]}});
  for(const name of ['MEMORY.md','a/memory.md','custom/decision/ADR.md','.git/config']) assert.equal(classify(c,name).audience,'internal');
  assert.equal(classify(c,'src/main.rs').audience,'public');
});
test('partial document policy retains internal defaults and Windows aliases are rejected',()=>{
  const root=fixture(),c=config(root,{documents:{publicRoots:['.']}});
  assert.equal(classify(c,'docs/./prd/secret.md').audience,'internal');
  for(const name of ['MEMORY.md.','docs/a ','NUL','con.txt']) assert.throws(()=>safePath(root,name));
  assert.throws(()=>config(root,{documents:null}));
});
