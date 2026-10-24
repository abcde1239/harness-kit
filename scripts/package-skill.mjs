import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, json, safePath, walk } from '../src/fs.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function skillFiles() {
  if(!globalThis.Bun)throw new Error('Use Bun to package the skill');
  const source=path.join(repo,'skills/harness-kit'), result=new Map();
  for(const file of walk(source,{ignore:[]})) {
    if(file.type!=='file')throw new Error(`Unexpected skill resource: ${file.path}`);
    if(file.path==='scripts/harness.mjs')continue;
    result.set(file.path,fs.readFileSync(safePath(source,file.path)));
  }
  const build=await Bun.build({entrypoints:[path.join(repo,'bin/harness.mjs')],target:'bun',format:'esm',minify:false});
  if(!build.success)throw new Error(build.logs.join('\n'));
  result.set('scripts/harness.mjs',Buffer.from(await build.outputs[0].text()));
  return result;
}
export async function packageSkill(destination) {
  const files=await skillFiles();
  if(fs.existsSync(destination))throw new Error(`Package destination exists: ${destination}`);
  fs.mkdirSync(destination,{recursive:true});
  for(const [name,bytes] of files){const target=safePath(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  return {destination,files:[...files].map(([name,bytes])=>({path:name,sha256:hash(bytes)}))};
}
if(import.meta.main) {
  const destination=path.resolve(process.argv[2]??path.join(repo,'artifacts/skill/harness-kit'));
  try{console.log(json(await packageSkill(destination)));}catch(error){console.error(error.message);process.exitCode=2;}
}
