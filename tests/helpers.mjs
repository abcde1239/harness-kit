import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, setDefaultTimeout } from 'bun:test';
import { defaults, validateConfig } from '../src/config.mjs';
import { hash, json } from '../src/fs.mjs';
const roots = [];
setDefaultTimeout(15000);
// Tests exercise nested fixture runners independently even when this suite is launched by harness verify.
delete process.env.HARNESS_ACTIVE;
export function fixture(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'harness-test-')); roots.push(root);
  for (const [name,value] of Object.entries(files)) write(root,name,value);
  return root;
}
export function write(root,name,value) {
  const target = path.join(root,name); fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,typeof value === 'string' || Buffer.isBuffer(value) ? value : json(value));
}
export function config(root,overrides = {}) { return validateConfig({...defaults(),repository:{visibility:'private'},...overrides},root); }
export function git(root,...args) {
  const r = spawnSync('git',['-C',root,'-c',`core.excludesFile=${path.join(root,'.git/info/exclude')}`,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_CONFIG_GLOBAL:path.join(root,'.git/absent-global-config'),GIT_CONFIG_NOSYSTEM:'1'}});
  if (r.error || r.status !== 0) throw new Error(`Fixture git ${args[0]} failed: ${r.error?.message ?? r.stderr}`);
  return r.stdout.trim();
}
export function repo(files = {}) { const root = fixture(files); git(root,'init','--initial-branch=main'); git(root,'config','user.name','Harness Test'); git(root,'config','user.email','harness@example.invalid'); return root; }
export function commit(root,message='fixture') { git(root,'add','--all'); git(root,'commit','-m',message); }
export function manifest(root,name,source,output=name) {
  const sourceBytes = fs.readFileSync(path.join(root,source)); write(root,`out/${output}`,sourceBytes);
  return {version:1,target:'fixture',artifactRoot:'out',entries:[{path:output,sha256:hash(sourceBytes),sources:[{path:source,sha256:hash(sourceBytes)}]}]};
}
afterAll(() => {
  const prefix = path.resolve(os.tmpdir()) + path.sep + 'harness-test-';
  for (const root of roots) {
    if (!path.resolve(root).startsWith(prefix) || path.dirname(root) !== path.resolve(os.tmpdir())) throw new Error('Unsafe fixture cleanup target');
    fs.rmSync(root,{recursive:true,force:true});
  }
});
