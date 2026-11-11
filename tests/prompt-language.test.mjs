import {test} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {agentInstructions} from '../src/host.mjs';
import {guide} from '../src/templates.mjs';
import {hookEvent} from '../src/hooks.mjs';
import {makePlan,applyPlan} from '../src/planner.mjs';
import {fixture,write} from './helpers.mjs';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assertEnglish=(text,source)=>assert.ok(!/\p{Script=Han}/u.test(text),`Maintained instruction contains Han text: ${source}`);
function markdown(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?markdown(path.join(directory,e.name)):e.name.endsWith('.md')?[path.join(directory,e.name)]:[]);}

test('maintained Skill instructions, display metadata and default prompt follow the English policy',()=>{
  const skill=path.join(repository,'skills/harness-kit');
  for(const file of [...markdown(skill),path.join(repository,'INSTALL.md')])assertEnglish(fs.readFileSync(file,'utf8'),file);
  const metadata=Bun.YAML.parse(fs.readFileSync(path.join(skill,'agents/openai.yaml'),'utf8'));
  assertEnglish(metadata.interface.default_prompt,'default_prompt');
  assertEnglish(metadata.interface.display_name,'Skill display name');
  assertEnglish(metadata.interface.short_description,'Skill UI description');
});

test('generated rules, collaboration guide and all hook instruction branches are English',()=>{
  assertEnglish(agentInstructions,'host managed block');assertEnglish(guide,'generated agent guide');
  const root=fixture();applyPlan(root,makePlan(root,{visibility:'private',testCommands:{root:['bun','test']}}));
  const event={session_id:'language-check',hook_event_name:'SessionStart'};
  const outputs=[hookEvent(root,{...event,hook_event_name:'Stop'}),hookEvent(root,event)];
  write(root,'src/change.mjs','export const changed=true;');
  outputs.push(hookEvent(root,{...event,hook_event_name:'Stop'}),hookEvent(root,{...event,hook_event_name:'Stop',stop_hook_active:true}));
  const noTasks=fixture();applyPlan(noTasks,makePlan(noTasks,{visibility:'private',testCommands:{root:null}}));
  outputs.push(hookEvent(noTasks,event));
  for(const output of outputs)assertEnglish(JSON.stringify(output),'hook output');
});
