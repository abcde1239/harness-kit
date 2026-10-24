import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { makePlan, applyPlan } from './planner.mjs';
import { atomicWrite, json, relativePath, safePath } from './fs.mjs';
import { CONFIG } from './config.mjs';
import { managedPaths } from './templates.mjs';

export function terminalUI() {
  if(!process.stdin.isTTY)throw new Error('需要交互终端；自动化请使用 plan --answers 或 setup --answers answers.json --yes。');
  const rl=createInterface({input:process.stdin,output:process.stderr});
  return {ask:prompt=>rl.question(prompt),write:line=>process.stderr.write(`${line}\n`),close:()=>rl.close()};
}
export async function choose(ui,prompt,choices,defaultIndex=0) {
  ui.write(prompt);
  choices.forEach((c,i)=>ui.write(`  ${i+1}. ${c.label}${i===defaultIndex?'（默认）':''}`));
  while(true) {
    const raw=(await ui.ask('请选择序号，回车采用默认：')).trim();
    const index=raw===''?defaultIndex:Number(raw)-1;
    if(Number.isInteger(index)&&index>=0&&index<choices.length)return choices[index].value;
    ui.write('请输入有效序号。');
  }
}
export async function confirm(ui,prompt,{defaultYes=false}={}) {
  while(true) {
    const value=(await ui.ask(`${prompt} ${defaultYes?'[Y/n]':'[y/N]'} `)).trim().toLowerCase();
    if(!value)return defaultYes;
    if(['y','yes','是'].includes(value))return true;
    if(['n','no','否'].includes(value))return false;
    ui.write('请输入 y 或 n。');
  }
}
// Tokenize only: no shell, expansion or evaluation. JSON argv remains available for advanced cases.
export function commandArgv(input) {
  input=input.trim();
  if(input.startsWith('[')) {
    const argv=JSON.parse(input);
    if(!Array.isArray(argv)||!argv.length||argv.some(v=>typeof v!=='string'||!v||v.includes('\0')))throw new Error('命令数组必须包含非空字符串。');
    return argv;
  }
  const argv=[];let token='',quote=null,started=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(quote) {
      if(c===quote)quote=null;
      else if(c==='\\'&&input[i+1]===quote) {token+=quote;i++;}
      else token+=c;
    } else if(c==='"'||c==="'") {quote=c;started=true;}
    else if(/\s/.test(c)) {if(started){argv.push(token);token='';started=false;}}
    else if(/[|&;<>`]/.test(c)||c==='$')throw new Error('这里不执行 shell 管道或变量展开，请填写单个程序命令或已有 package script。');
    else {token+=c;started=true;}
  }
  if(quote)throw new Error('命令引号未闭合。');
  if(started)argv.push(token);
  if(!argv.length||argv.some(v=>!v||v.includes('\0')))throw new Error('请输入可执行命令。');
  return argv;
}
async function testCommand(ui,workspace) {
  const mode=await choose(ui,`工作区 ${workspace} 的测试如何执行？`,[
    {label:'输入已有测试命令（如 bun test 或 pnpm run test）',value:'custom'},
    {label:'暂不配置测试，明确标记未配置',value:'none'}
  ]);
  if(mode==='none')return null;
  while(true) {try {return commandArgv(await ui.ask('测试命令：'));}catch(error){ui.write(error.message);}}
}
export async function collectAnswers(root,answers={},ui,{edit=false}={}) {
  answers=structuredClone(answers);
  if(edit) {
    const plan=makePlan(root,answers), config=JSON.parse(plan.files.find(f=>f.path===CONFIG).content);
    answers.visibility=await choose(ui,'仓库可见性（公开仓库会检查内部文件是否已跟踪）：',[
      {label:'私有仓库',value:'private'},{label:'公开仓库',value:'public'},{label:'暂不确定，发布门禁保持阻断',value:'unknown'}
    ],Math.max(0,['private','public','unknown'].indexOf(config.repository.visibility)));
    for(const w of config.workspaces) {
      const existing=config.tasks.filter(t=>t.workspace===w.id&&t.kind==='test');
      ui.write(`${w.id} 当前测试：${existing.map(t=>t.argv.join(' ')).join('；')||'未配置'}`);
      if(await confirm(ui,`调整 ${w.id} 的测试命令？`))(answers.testCommands??={})[w.id]=await testCommand(ui,w.id);
    }
  }
  // Recompute after each answer: selecting a manager can make the test-command question unnecessary.
  while(true) {
    const q=makePlan(root,answers).unanswered[0]; if(!q)break;
    if(q.type==='visibility')answers.visibility=await choose(ui,'项目仓库的可见性：',[
      {label:'私有仓库',value:'private'},{label:'公开仓库',value:'public'},{label:'暂不确定，发布门禁保持阻断',value:'unknown'}
    ]);
    else if(q.type==='manager')(answers.managers??={})[q.workspace]=await choose(ui,`${q.workspace} 的包管理器存在歧义，请选择：`,[
      {label:'Bun',value:'bun'},{label:'pnpm',value:'pnpm'},{label:'npm',value:'npm'},{label:'Yarn',value:'yarn'}
    ]);
    else if(q.type==='test-command')(answers.testCommands??={})[q.workspace]=await testCommand(ui,q.workspace);
    else {
      ui.write(`需明确的扫描问题：${q.message}`);
      if(!await confirm(ui,'已经解决或理解此项限制，继续生成计划？'))throw new Error('已停止。解决扫描问题或提供显式配置后重试；未应用改动。');
      (answers.acknowledge??=[]).push(q.id);
    }
  }
  return answers;
}
export function previewPlan(ui,plan) {
  ui.write('\n变更预览：');
  const labels={create:'新增',update:'更新',unchanged:'不变',conflict:'冲突，保留原文件'};
  for(const f of plan.files)ui.write(`  ${labels[f.action]}  ${f.path}`);
  const config=JSON.parse(plan.files.find(f=>f.path===CONFIG).content);
  ui.write(`  仓库：${config.repository.visibility}；工作区：${config.workspaces.map(w=>w.id).join('、')}`);
  for(const task of config.tasks)ui.write(`  ${task.workspace}/${task.id}: ${task.argv.join(' ')}`);
  ui.write('  内部 memory / decision 不公开；保留测试框架原有布局。');
}
export async function setup(root,{answers={},yes=false,ui,out='.harness/plan.json'}={}) {
  if(!yes&&!ui)throw new Error('交互输入不可用；请提供答案文件并显式使用 --yes。');
  if(ui) {
    const existing=fs.existsSync(safePath(root,CONFIG));
    const edit=existing && await choose(ui,'项目已有配置：',[
      {label:'保留已有设置，检查生成差异',value:false},
      {label:'调整仓库可见性和测试命令',value:true}
    ]);
    answers=await collectAnswers(root,answers,ui,{edit});
  }
  const plan=makePlan(root,answers);
  if(plan.unanswered.length)throw new Error('还有未回答的问题。请运行 harness 交互配置，或补全 --answers 文件。');
  if([...managedPaths,'.harness/managed.json'].includes(relativePath(out)))throw new Error('计划输出不能覆盖项目受管理文件或生成状态。');
  atomicWrite(root,out,json(plan));
  ui?.write(`完整计划已保存：${safePath(root,out)}`);
  if(ui)previewPlan(ui,plan);
  const action=yes?'apply':await choose(ui,'下一步：',[
    {label:'应用安全变更，冲突文件保留',value:'apply'},
    {label:'只保存计划，稍后应用',value:'save'},
    {label:'先查看完整建议文件内容',value:'view'}
  ],1);
  let apply=action==='apply';
  if(action==='view') {
    for(const file of plan.files)if(file.action!=='unchanged')ui.write(`\n--- ${file.path} (${file.action}) ---\n${file.content}`);
    apply=await confirm(ui,'应用上述安全变更？');
  }
  if(!apply)return {status:'planned',exitCode:0,plan:out,root};
  const result=applyPlan(root,plan);
  ui?.write(result.conflicts.length?'已应用安全变更。冲突文件原样保留，请对照计划合并。':'配置已完成。下一次可直接运行 harness lint 或 harness verify。');
  return {...result,plan:out,root};
}
