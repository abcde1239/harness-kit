import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {safePath} from '../src/fs.mjs';
// Bun-based fallback for environments without the official Python validator's PyYAML dependency.
export function validateSkill(directory) {
  const text=fs.readFileSync(safePath(directory,'SKILL.md',{allowMissing:false}),'utf8');
  const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if(!match)throw new Error('Missing skill YAML frontmatter');
  const front=Bun.YAML.parse(match[1]);
  if(!front||Array.isArray(front)||typeof front!=='object')throw new Error('Frontmatter must be a mapping');
  for(const key of Object.keys(front))if(!['name','description','license','allowed-tools','metadata'].includes(key))throw new Error(`Unknown frontmatter field ${key}`);
  if(typeof front.name!=='string'||front.name.length>64||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(front.name))throw new Error('Invalid skill name');
  if(typeof front.description!=='string'||!front.description.trim()||front.description.length>1024||/[<>]/.test(front.description))throw new Error('Invalid description');
  if(/\[TODO:|Structuring This Skill/.test(text))throw new Error('Unfinished skill scaffold');
  for(const m of text.matchAll(/\]\(((?:references|scripts)\/[^)]+)\)/g))safePath(directory,m[1],{allowMissing:false});
  const metadata=Bun.YAML.parse(fs.readFileSync(safePath(directory,'agents/openai.yaml',{allowMissing:false}),'utf8'));
  const ui=metadata?.interface;
  if(typeof ui?.display_name!=='string'||ui.short_description?.length<25||ui.short_description?.length>64||!ui.default_prompt?.includes(`$${front.name}`))throw new Error('Invalid UI metadata');
  safePath(directory,'scripts/harness.mjs',{allowMissing:false});
  return {status:'passed',validator:'Bun YAML + structure/reference validation (not official quick_validate.py)',name:front.name};
}
if(import.meta.main) {
  try {console.log(JSON.stringify(validateSkill(path.resolve(process.argv[2]??path.join(path.dirname(fileURLToPath(import.meta.url)),'../skills/harness-kit'))),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
