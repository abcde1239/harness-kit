import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, json, safePath, walk } from '../src/fs.mjs';
import {isMain} from '../src/runtime.mjs';
import {buildCLI} from './build.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function skillFiles() {
  const source=path.join(repo,'skills/harness-kit'), result=new Map();
  for(const file of walk(source,{ignore:[]})) {
    if(file.type!=='file')throw new Error(`Unexpected skill resource: ${file.path}`);
    if(file.path==='scripts/harness.mjs')continue;
    result.set(file.path,fs.readFileSync(safePath(source,file.path)));
  }
  result.set('scripts/harness.mjs',await buildCLI(path.join(repo,'bin/harness.mjs')));
  result.set('scripts/install-plugin.mjs',fs.readFileSync(path.join(repo,'scripts/install-plugin.mjs')));
  result.set('runtime.json',Buffer.from(json({version:1,anyOf:[{name:'node',minimum:'22.12.0'},{name:'bun',minimum:'1.3.4'}]})));
  for(const name of ['yaml','smol-toml'])result.set(`licenses/${name}.txt`,fs.readFileSync(path.join(repo,'node_modules',name,'LICENSE')));
  return result;
}
export async function packageSkill(destination) {
  const files=await skillFiles();
  if(fs.existsSync(destination))throw new Error(`Package destination exists: ${destination}`);
  fs.mkdirSync(destination,{recursive:true});
  for(const [name,bytes] of files){const target=safePath(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  return {destination,files:[...files].map(([name,bytes])=>({path:name,sha256:hash(bytes)}))};
}
if(isMain(import.meta.url)) {
  const destination=path.resolve(process.argv[2]??path.join(repo,'artifacts/skill/harness-kit'));
  try{console.log(json(await packageSkill(destination)));}catch(error){console.error(error.message);process.exitCode=2;}
}
