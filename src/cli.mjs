import fs from 'node:fs';
import path from 'node:path';
import { version } from '../package.json';
import { inspect } from './discovery.mjs';
import { loadConfig } from './config.mjs';
import { makePlan, applyPlan } from './planner.mjs';
import { lint } from './lint.mjs';
import { verifyProject } from './workflow.mjs';
import { diagnose } from './readiness.mjs';
import { hookEvent } from './hooks.mjs';
import { normalizeHosts } from './host.mjs';
import { createTask, getTask, resumeTask, updateTask, completeTask, recordTaskVerification } from './tasks.mjs';
import { publicationCheck, exportSnapshot } from './publication.mjs';
import { auditHistory, reviewTemplate } from './git.mjs';
import { atomicWrite, json, readJson } from './fs.mjs';
import { locateProject } from './project.mjs';
import { terminalUI, choose, collectAnswers, commandArgv, setup } from './interaction.mjs';

const HELP = `Harness Kit ${version} — Agent 项目接入与验证

在项目中运行 harness 打开中文菜单，或使用：
  harness init       初始化/调整配置，接通 Agent 指令并执行首次验证
  harness run        检查项目约定并运行已配置验证
  harness check      只检查约定，不执行项目命令
  harness doctor     诊断接入状态与验证证据，不执行项目命令

一次接入示例：harness init --private --test "bun test" --yes
已有测试脚本可自动发现；空项目可明确选择 --no-tests。
跳过首次执行：--skip-verify；完整机器输出：--json；指定项目：--root 路径。
高级命令与兼容入口：harness help --all
`;
const ADVANCED_HELP = `${HELP}
高级用法（所有文件路径均相对目标项目，--root 除外）：
init / setup [--private | --public] [--test command | --no-tests]
             [--hosts codex,claude,gemini,cursor,opencode,dsh]
             [--answers file] [--yes] [--skip-verify] [--hooks] [--out .harness/plan.json]
             --hooks 可选接入 Codex SessionStart/Stop；需审阅并信任宿主配置
run / verify [--task id] [--work id]
                                --task 选择验证任务；--work 关联持久开发任务
check / lint                    只读约定检查
task start <id> [--title "..."] --accept "..." [--accept "..."] [--scope "..."]
                                创建可恢复任务与验收项，scope 可重复
task status [id] / resume [id]   查看/恢复任务；省略 ID 使用当前任务，不执行项目命令
task note [id] --note "..." [--next "..."]
task accept [id] --criterion c1 --evidence "..."
task finish [id]                 依据当前验证证据与验收项完成任务
inspect                         Static discovery, evidence and missing questions
configure [--answers file]       Ask missing questions and emit a plan (no apply)
plan [--answers file]            Emit a reviewable plan and full proposed content
apply --plan file                Apply an unchanged reviewed plan; preserve conflicts
baseline                        Emit ordinary findings as baseline fingerprints
publication-check [--target id | --manifest file]
                                Check actual output tree and reviewed source provenance
export --destination path [--manifest-out file]
                                Export public snapshot to NEW local directory, no history
audit-history [--evidence file]  Reachable Git history and reviewer-attested platform scope
review-template                 Emit evidence template bound to current refs and policy
hook --root project             宿主事件接口：stdin/stdout JSON，不执行业务命令

Shared: --root project, --json (machine output), --out relative-file.
init --out 指定计划文件，其他命令 --out 保存结果。No upload or push.
`;
function parse(args) {
  const command = args[0]?.startsWith('--') ? 'menu' : args.shift() ?? 'menu', options = {};
  const action=command==='task'?(args[0]&&!args[0].startsWith('--')?args.shift():'status'):undefined;
  const taskId=command==='task'&&args[0]&&!args[0].startsWith('--')?args.shift():undefined;
  const switches = new Set(['json','help','version','yes','all','private','public','no-tests','skip-verify','hooks']);
  const allowed = new Set(['root','answers','out','plan','task','work','target','manifest','destination','manifest-out','evidence','test','hosts','title','accept','scope','note','next','criterion',...switches]);
  const repeatable=new Set(['accept','scope']);
  while (args.length) {
    const arg = args.shift(); if (!arg.startsWith('--') || !allowed.has(arg.slice(2))) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2); if (Object.hasOwn(options,key)&&!repeatable.has(key)) throw new Error(`Duplicate option: ${arg}`);
    if (switches.has(key)) options[key] = true;
    else {
      const value = args.shift(); if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      if(repeatable.has(key))(options[key]??=[]).push(value);else options[key]=value;
    }
  }
  const initOptions=['answers','yes','private','public','test','no-tests','skip-verify','hooks','hosts'];
  const taskOptions={start:['title','accept','scope'],status:[],resume:[],note:['note','next'],accept:['criterion','evidence'],finish:[]};
  if(command==='task'&&!Object.hasOwn(taskOptions,action))throw new Error(`Unknown task action: ${action}`);
  const perCommand = {menu:[],init:initOptions,setup:initOptions,check:[],run:['task','work'],doctor:[],hook:[],task:taskOptions[action]??[],inspect:[],configure:['answers'],plan:['answers'],apply:['plan'],lint:[],verify:['task','work'],baseline:[], 'publication-check':['target','manifest'],export:['destination','manifest-out'],'audit-history':['evidence'],'review-template':[],help:['all']};
  if (!Object.hasOwn(perCommand,command)) throw new Error(`Unknown command: ${command}`);
  const commandOptions=command==='hook'?['root']:['root','out','json','help','version',...(options.help?['all']:[]),...perCommand[command]];
  for (const key of Object.keys(options)) if (!commandOptions.includes(key)) throw new Error(`Option --${key} is not valid for ${command}`);
  if(options.private&&options.public)throw new Error('--private 与 --public 不能同时使用。');
  if(options.test&&options['no-tests'])throw new Error('--test 与 --no-tests 不能同时使用。');
  return {command,options,action,taskId};
}
function initAnswers(root, options) {
  const answers=options.answers?readJson(root,options.answers):{};
  if(options.hosts)answers.hosts=normalizeHosts(options.hosts.split(','));
  if(options.private||options.public)answers.visibility=options.public?'public':'private';
  if(options.test||options['no-tests']) {
    const workspaces=(answers.config??inspect(root).suggestedConfig).workspaces;
    if(options.test&&workspaces.length!==1)throw new Error('多工作区请使用交互初始化或 --answers 分别声明测试命令；--test 仅用于单工作区。');
    answers.testCommands={...answers.testCommands};
    for(const w of workspaces)answers.testCommands[w.id]=options['no-tests']?null:commandArgv(options.test);
  }
  return answers;
}
async function cancellable(operation) {
  const controller=new AbortController(),abort=()=>controller.abort();
  process.once('SIGINT',abort);process.once('SIGTERM',abort);
  try{return await operation(controller.signal);}
  finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
}
async function hookInput() {
  const reader=Bun.stdin.stream().getReader(),chunks=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>1024*1024) {await reader.cancel();throw new Error('Hook input exceeds 1 MiB.');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Hook input must be a JSON object.');
  return input;
}
async function ask(root,answers) {
  if (!makePlan(root,answers).unanswered.length) return answers;
  const ui=terminalUI();
  try {return await collectAnswers(root,answers,ui);} finally {ui.close();}
}
function printResult(command,result,options) {
  if(options.json){console.log(json(result));return;}
  const status=command==='init'&&result.status==='applied'
    ? result.verification?.exitCode ? '配置已应用；首次验证失败'
      : result.readiness?.status==='ready'?'配置已应用；本地验证就绪'
      : '配置已应用；接入尚未就绪'
    : result.status??'ready';
  console.log(`${command}: ${status}${options.out?`（已保存 ${options.out}）`:''}`);
  if(result.root)console.log(`项目：${result.root}`);
  if(result.plan)console.log(`计划：${result.plan}`);
  for(const name of result.changed??[])console.log(`已更新：${name}`);
  for(const name of result.conflicts??[])console.log(`保留冲突：${name}`);
  if(result.suggestedConfig) {
    console.log(`工作区：${result.suggestedConfig.workspaces.map(w=>w.id).join('、')}`);
    for(const f of result.facts??[])console.log(`发现：${f.source} → ${f.capability}`);
    for(const q of result.questions??[])console.log(`待明确：${q.message}`);
  }
  if(result.task) {
    console.log(`任务 ${result.task.id}：${result.task.title}（${result.task.state}）`);
    console.log(`范围：${result.task.scope.join('、')}`);
    for(const note of result.task.notes.slice(-3))console.log(`记录：${note.text}`);
    for(const criterion of result.criteria??[]) {
      console.log(`  ${criterion.status} ${criterion.id}: ${criterion.text}`);
      if(criterion.evidence)console.log(`    依据：${criterion.evidence}`);
    }
    if(result.verification)console.log(`任务验证：${result.verification.status}`);
    if(result.task.next)console.log(`接续：${result.task.next}`);
  }
  if(result.work?.task)console.log(`验证已关联任务：${result.work.task.id}（${result.work.status}）`);
  for(const f of [...(result.findings??[]),...(result.governance?.findings??[])])console.log(`[${f.severity}] ${f.path}: ${f.message}`);
  for(const t of result.verification?.tasks??[]) {
    console.log(`${t.status} ${t.id}${t.reason?` (${t.reason})`:''}`);
    if(t.status!=='passed'&&t.output)console.log(t.output);
  }
  for(const w of result.workspaces??result.verification?.workspaces??[])console.log(`工作区 ${w.id}：${w.tests??w.status}`);
  const readiness=result.readiness??(command==='doctor'?result:null);
  if(readiness) {
    console.log(`接入状态：${readiness.status}`);
    for(const check of readiness.checks??[]) {
      if(check.status!=='passed')console.log(`  ${check.status} ${check.message}`);
      if(check.entry?.notice)console.log(`  ${check.entry.notice}`);
    }
  }
  if(result.next)console.log(`下一步：${result.next}`);
  if(result.hooks?.notice)console.log(result.hooks.notice);
  if(['plan','configure','baseline','review-template','export','publication-check','audit-history'].includes(command))console.log(json(result));
}
export async function main(argv) {
  let options = {};
  try {
    const parsed = parse([...argv]); options = parsed.options; let {command} = parsed;
    if(options.version){console.log(options.json?json({name:'harness-kit',version}):version);return 0;}
    if (command === 'help' || options.help) { console.log(options.all?ADVANCED_HELP:HELP); return 0; }
    if(command==='menu'&&!process.stdin.isTTY){console.log(options.json?json({status:'ready',interactive:false,message:'使用 harness init 接入项目，harness run 验证，harness doctor 诊断。'}):HELP);return 0;}
    const project=locateProject(process.cwd(),options.root),root=project.root;
    if(command==='hook') {
      const output=process.env.HARNESS_ACTIVE?{}:hookEvent(root,await hookInput());
      console.log(json(output));return 0;
    }
    if(!options.json)console.log(`项目：${root}（${project.source}）`);
    if(command==='menu') {
      const ui=terminalUI();
      try {command=await choose(ui,'想做什么？',[
        {label:fs.existsSync(path.join(root,'harness.config.json'))?'调整项目接入':'初始化项目接入',value:'init'},
        {label:'运行验证',value:'run'},
        {label:'诊断接入状态',value:'doctor'},
        {label:'退出',value:'exit'}
      ]);}finally{ui.close();}
      if(command==='exit')return 0;
    }
    command=({setup:'init',lint:'check',verify:'run'})[command]??command;
    if (process.env.HARNESS_ACTIVE && ['run','check','init'].includes(command)) throw new Error('Recursive harness invocation refused');
    const requireOption = key => { if (!options[key]) throw new Error(`--${key} is required`); return options[key]; };
    let result;
    if(command==='init') {
      if((options.json||!process.stdin.isTTY)&&!options.yes)throw new Error('非交互初始化需要 --yes；例如 harness init --private --test "bun test" --yes。交互使用 harness init。');
      const answers=initAnswers(root,options);
      const ui=options.yes?null:terminalUI();
      try {result=await cancellable(signal=>setup(root,{answers,yes:options.yes,ui,out:options.out??'.harness/plan.json',skipVerify:options['skip-verify'],hooks:options.hooks,signal}));}finally{ui?.close();}
    }
    else if(command==='task') {
      const {action,taskId}=parsed;
      if(action==='start') {
        if(!taskId)throw new Error('task start 需要任务 ID。');
        requireOption('accept');
        result=createTask(root,{id:taskId,title:options.title,criteria:options.accept,scope:options.scope});
      }
      else if(action==='status')result=getTask(root,taskId);
      else if(action==='resume')result=resumeTask(root,taskId);
      else if(action==='note') {
        if(!options.note&&!options.next)throw new Error('task note 需要 --note 或 --next。');
        result=updateTask(root,taskId,{note:options.note,next:options.next});
      }
      else if(action==='accept')result=updateTask(root,taskId,{criterion:requireOption('criterion'),evidence:requireOption('evidence')});
      else result=completeTask(root,taskId);
    }
    else if(command==='doctor')result=diagnose(root);
    else if (command === 'inspect') result = {...inspect(root),root};
    else if (command === 'plan' || command === 'configure') {
      let answers = options.answers ? readJson(root,options.answers) : {};
      if (command === 'configure') answers = await ask(root,answers);
      result = makePlan(root,answers);
    } else if (command === 'apply') result = applyPlan(root,readJson(root,requireOption('plan')));
    else {
      const config = loadConfig(root);
      if (command === 'check') result = lint(root,config);
      else if (command === 'baseline') {
        const check = lint(root,config,{useBaseline:false});
        result = {baseline:check.findings.filter(f=>!f.protected).map(f=>f.fingerprint),excludedProtected:check.findings.filter(f=>f.protected).length,notice:'Review and merge baseline into harness.config.json; nothing changed automatically.'};
      } else if (command === 'run') {
        if(options.work) {
          const task=getTask(root,options.work);
          if(task.exitCode) {printResult('task',task,options);return task.exitCode;}
          if(task.task.state==='completed')throw new Error(`任务 ${options.work} 已完成；先运行 harness task resume ${options.work} 确认恢复状态，再关联验证。`);
        }
        result=await cancellable(signal=>verifyProject(root,config,{selected:options.task?[options.task]:undefined,signal,record:true}));
        if(options.work) {
          result.work=recordTaskVerification(root,options.work,result);
          result.exitCode=Math.max(result.exitCode,result.work.exitCode??0);
        }
        result.readiness=diagnose(root,{verification:result.verification,governance:result.governance});
      } else if (command === 'publication-check') result = publicationCheck(root,config,{target:options.target,manifestPath:options.manifest});
      else if (command === 'export') {
        result = exportSnapshot(root,config,requireOption('destination'));
        if (result.manifest && options['manifest-out']) atomicWrite(root,options['manifest-out'],json(result.manifest));
      } else if (command === 'review-template') result = reviewTemplate(root,config);
      else if (command === 'audit-history') result = auditHistory(root,config,{evidence:options.evidence ? readJson(root,options.evidence) : undefined,onProgress: options.json ? undefined : p => { if (p.current === 1 || p.current % 20 === 0 || p.current === p.total) process.stderr.write(`history ${p.current}/${p.total}\n`); }});
    }
    if (options.out&&command!=='init') atomicWrite(root,options.out,json(result));
    printResult(command,result,options);
    return result.exitCode ?? 0;
  } catch (error) {
    console.error(json({status:'error',exitCode:2,message:error.message})); return 2;
  }
}
