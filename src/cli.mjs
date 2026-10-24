import fs from 'node:fs';
import path from 'node:path';
import { inspect } from './discovery.mjs';
import { loadConfig } from './config.mjs';
import { makePlan, applyPlan } from './planner.mjs';
import { lint } from './lint.mjs';
import { verify } from './runner.mjs';
import { publicationCheck, exportSnapshot } from './publication.mjs';
import { auditHistory, reviewTemplate } from './git.mjs';
import { atomicWrite, json, readJson } from './fs.mjs';
import { locateProject } from './project.mjs';
import { terminalUI, choose, collectAnswers, setup } from './interaction.mjs';

const HELP = `Harness Kit (Bun) — project conventions and publication governance

Usage: harness [command] [options]
直接在项目中运行 harness 打开中文菜单；自动识别项目根目录，无需填写工具路径。
setup [--answers file --yes]     交互初始化/调整配置、预览并应用（默认保存 .harness/plan.json）

inspect                         Static discovery, evidence and missing questions
configure [--answers file]       Ask missing questions and emit a plan (no apply)
plan [--answers file]            Emit a reviewable plan and full proposed content
apply --plan file                Apply an unchanged reviewed plan; preserve conflicts
lint                            Read-only governance checks, including public Git index
verify [--task id]               Lint plus configured task DAG, one execution per task
baseline                        Emit ordinary findings as baseline fingerprints
publication-check [--target id | --manifest file]
                                Check actual output tree and reviewed source provenance
export --destination path [--manifest-out file]
                                Export public snapshot to NEW local directory, no history
audit-history [--evidence file]  Reachable Git history and reviewer-attested platform scope
review-template                 Emit evidence template bound to current refs and policy

Shared: --root project (optional override), --json (machine output), --out relative-file.
All file options except --root are relative to the project. No install, upload or push.
`;
function parse(args) {
  const command = args[0]?.startsWith('--') ? 'menu' : args.shift() ?? 'menu', options = {};
  const switches = new Set(['json','help','yes']);
  const allowed = new Set(['root','answers','out','plan','task','target','manifest','destination','manifest-out','evidence',...switches]);
  while (args.length) {
    const arg = args.shift(); if (!arg.startsWith('--') || !allowed.has(arg.slice(2))) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2); if (Object.hasOwn(options,key)) throw new Error(`Duplicate option: ${arg}`);
    if (switches.has(key)) options[key] = true;
    else { const value = args.shift(); if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`); options[key] = value; }
  }
  const perCommand = {menu:[],setup:['answers','yes'],inspect:[],configure:['answers'],plan:['answers'],apply:['plan'],lint:[],verify:['task'],baseline:[], 'publication-check':['target','manifest'],export:['destination','manifest-out'],'audit-history':['evidence'],'review-template':[],help:[]};
  if (!Object.hasOwn(perCommand,command)) throw new Error(`Unknown command: ${command}`);
  for (const key of Object.keys(options)) if (!['root','out','json','help',...perCommand[command]].includes(key)) throw new Error(`Option --${key} is not valid for ${command}`);
  return {command,options};
}
async function ask(root,answers) {
  if (!makePlan(root,answers).unanswered.length) return answers;
  const ui=terminalUI();
  try {return await collectAnswers(root,answers,ui);} finally {ui.close();}
}
function printResult(command,result,options) {
  if(options.json){console.log(json(result));return;}
  console.log(`${command}: ${result.status??'ready'}${options.out?`（已保存 ${options.out}）`:''}`);
  if(result.root)console.log(`项目：${result.root}`);
  if(result.plan)console.log(`计划：${result.plan}`);
  for(const name of result.changed??[])console.log(`已更新：${name}`);
  for(const name of result.conflicts??[])console.log(`保留冲突：${name}`);
  if(result.suggestedConfig) {
    console.log(`工作区：${result.suggestedConfig.workspaces.map(w=>w.id).join('、')}`);
    for(const f of result.facts??[])console.log(`发现：${f.source} → ${f.capability}`);
    for(const q of result.questions??[])console.log(`待明确：${q.message}`);
  }
  for(const f of [...(result.findings??[]),...(result.governance?.findings??[])])console.log(`[${f.severity}] ${f.path}: ${f.message}`);
  for(const t of result.verification?.tasks??[]) {
    console.log(`${t.status} ${t.id}${t.reason?` (${t.reason})`:''}`);
    if(t.status!=='passed'&&t.output)console.log(t.output);
  }
  for(const w of result.workspaces??result.verification?.workspaces??[])console.log(`工作区 ${w.id}：${w.tests??w.status}`);
  if(['plan','configure','baseline','review-template','export','publication-check','audit-history'].includes(command))console.log(json(result));
}
export async function main(argv) {
  let options = {};
  try {
    const parsed = parse([...argv]); options = parsed.options; let {command} = parsed;
    if (command === 'help' || options.help) { console.log(HELP); return 0; }
    if(command==='menu'&&!process.stdin.isTTY){console.log(options.json?json({status:'ready',interactive:false,message:'在交互终端运行 harness，或使用 inspect / setup --answers answers.json --yes / lint / verify。'}):HELP);return 0;}
    const project=locateProject(process.cwd(),options.root),root=project.root;
    if(!options.json)console.log(`项目：${root}（${project.source}）`);
    if(command==='menu') {
      const ui=terminalUI();
      try {command=await choose(ui,'想做什么？',[
        {label:fs.existsSync(path.join(root,'harness.config.json'))?'检查或调整项目配置':'初始化项目约束',value:'setup'},
        {label:'查看扫描结果，不修改文件',value:'inspect'},
        {label:'检查项目约定（lint）',value:'lint'},
        {label:'运行约定检查和测试（verify）',value:'verify'},
        {label:'退出',value:'exit'}
      ]);}finally{ui.close();}
      if(command==='exit')return 0;
    }
    if (process.env.HARNESS_ACTIVE && ['verify','lint','setup'].includes(command)) throw new Error('Recursive harness invocation refused');
    const requireOption = key => { if (!options[key]) throw new Error(`--${key} is required`); return options[key]; };
    let result;
    if(command==='setup') {
      if(options.json&&!options.yes)throw new Error('机器模式 setup 需要 --answers 文件与 --yes；交互使用 harness 或 harness setup。');
      const answers=options.answers?readJson(root,options.answers):{};
      const ui=options.yes?null:terminalUI();
      try {result=await setup(root,{answers,yes:options.yes,ui,out:options.out??'.harness/plan.json'});}finally{ui?.close();}
    }
    else if (command === 'inspect') result = {...inspect(root),root};
    else if (command === 'plan' || command === 'configure') {
      let answers = options.answers ? readJson(root,options.answers) : {};
      if (command === 'configure') answers = await ask(root,answers);
      result = makePlan(root,answers);
    } else if (command === 'apply') result = applyPlan(root,readJson(root,requireOption('plan')));
    else {
      const config = loadConfig(root);
      if (command === 'lint') result = lint(root,config);
      else if (command === 'baseline') {
        const check = lint(root,config,{useBaseline:false});
        result = {baseline:check.findings.filter(f=>!f.protected).map(f=>f.fingerprint),excludedProtected:check.findings.filter(f=>f.protected).length,notice:'Review and merge baseline into harness.config.json; nothing changed automatically.'};
      } else if (command === 'verify') {
        const governance = lint(root,config), controller = new AbortController();
        const abort = () => controller.abort(); process.once('SIGINT',abort); process.once('SIGTERM',abort);
        try {
          const verification = await verify(root,config,{selected:options.task ? [options.task] : undefined,signal:controller.signal});
          const exitCode = Math.max(governance.exitCode,verification.exitCode);
          result = {status:exitCode ? 'failed' : verification.status,exitCode,governance,verification};
        } finally {process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
      } else if (command === 'publication-check') result = publicationCheck(root,config,{target:options.target,manifestPath:options.manifest});
      else if (command === 'export') {
        result = exportSnapshot(root,config,requireOption('destination'));
        if (result.manifest && options['manifest-out']) atomicWrite(root,options['manifest-out'],json(result.manifest));
      } else if (command === 'review-template') result = reviewTemplate(root,config);
      else if (command === 'audit-history') result = auditHistory(root,config,{evidence:options.evidence ? readJson(root,options.evidence) : undefined,onProgress: options.json ? undefined : p => { if (p.current === 1 || p.current % 20 === 0 || p.current === p.total) process.stderr.write(`history ${p.current}/${p.total}\n`); }});
    }
    if (options.out&&command!=='setup') atomicWrite(root,options.out,json(result));
    printResult(command,result,options);
    return result.exitCode ?? 0;
  } catch (error) {
    console.error(json({status:'error',exitCode:2,message:error.message})); return 2;
  }
}
