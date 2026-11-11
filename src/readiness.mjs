import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, loadConfig } from './config.mjs';
import { inspect } from './discovery.mjs';
import { safePath } from './fs.mjs';
import { lint } from './lint.mjs';
import { verificationEvidence } from './workflow.mjs';
import { HOSTS, inspectHostEntries } from './host.mjs';
import { inspectHooks } from './hooks.mjs';
import { classify } from './policy.mjs';

function commandExists(command,cwd) {
  if(command==='bun')return true;
  const extensions=process.platform==='win32'?['','.exe','.cmd','.bat']:[''];
  const direct=path.isAbsolute(command)||command.includes('/')||command.includes('\\');
  const candidates=direct?extensions.map(ext=>path.resolve(cwd,command+ext)):(process.env.PATH??'').split(path.delimiter).flatMap(dir=>extensions.map(ext=>path.join(dir,command+ext)));
  return candidates.some(candidate=>{try{return fs.statSync(candidate).isFile() && (process.platform==='win32'||(fs.accessSync(candidate,fs.constants.X_OK),true));}catch{return false;}});
}

// Static inspection is distinct from a live host loading these instructions.
export function diagnose(root, {verification,governance}={}) {
  const checks=[], add=(id,status,message,extra={})=>checks.push({id,status,message,...extra});
  const finish=(status,exitCode)=>({status,exitCode,root,checks,hostRuntime:'not-confirmed',next:status==='ready'?'在所选 Agent 的新会话中确认加载后开始任务；修改后运行 harness run':status==='not-configured'?'运行 harness init 配置验证命令':'按诊断处理后运行 harness run'});
  if(!fs.existsSync(safePath(root,CONFIG))) {
    add('config','missing','尚未接入：运行 harness init');return finish('not-configured',0);
  }
  let config;
  try {config=loadConfig(root);add('config','passed','项目配置有效');}
  catch(error){add('config','failed',error.message);return finish('needs-attention',2);}
  try {
    const {hosts,entries}=inspectHostEntries(root);
    for(const entry of entries) {
      const usable=entry.status==='configured',id=entry.host==='codex'||hosts.length===1?'agent-entry':`agent-entry:${entry.host}`;
      const publication=classify(config,entry.file),publicationReview=publication.audience!=='public';
      add(id,usable?'passed':entry.overridden||entry.status==='conflict'?'blocked':'missing',usable?`${HOSTS[entry.host].label}：${entry.file} 接入区块有效；新会话加载尚未实测${publicationReview?'；公开分发前复核此入口的资料分类':''}`:entry.overridden?'AGENTS.override.md 会覆盖同层 AGENTS.md；请合并接入指令后再确认':`${HOSTS[entry.host].label}：${entry.file} 缺少有效接入区块，请运行 harness init 复核`,{entry,publication,publicationReview});
    }
  }catch(error){add('agent-entry','blocked',`指令入口不可用：${error.message}`);}
  const hooks=inspectHooks(root);
  if(hooks.status!=='not-configured')add('hooks',hooks.status==='configured'?'passed':'warning',hooks.message,{hooks});
  try { const scan=inspect(root),drift=scan.drift;
    const count=(drift?.workspaces.length??0)+(drift?.tasks.length??0);
    add('discovery',count?'warning':'passed',count?'发现尚未接入的工作区或任务，请复核配置':'未发现新增工作区或任务',{drift});
  }catch(error){add('discovery','warning',`扫描未完成：${error.message}`);}
  const missing=[];
  for(const task of config.tasks.filter(t=>t.enabled)) {
    const workspace=config.workspaces.find(w=>w.id===task.workspace);
    try {
      const cwd=safePath(root,workspace.root==='.'?task.cwd:`${workspace.root}/${task.cwd}`,{allowMissing:false});
      if(!fs.statSync(cwd).isDirectory())throw new Error('cwd is not a directory');
      if(!commandExists(task.argv[0],cwd))missing.push(task.argv[0]);
    }catch{missing.push(`${task.id}: cwd 不可用`);}
  }
  add('tools',missing.length?'blocked':'passed',missing.length?`执行条件未满足：${[...new Set(missing)].join('、')}`:'已配置任务的入口程序与目录可用');
  const check=governance??lint(root,config);
  add('governance',check.exitCode?'failed':'passed',check.exitCode?'项目约定检查未通过':'项目约定检查通过',{findings:check.findings});
  if(!config.tasks.some(t=>t.enabled)) {
    const disabledRequired=config.tasks.some(t=>t.required&&!t.enabled);
    add('verification',disabledRequired?'blocked':'not-configured',disabledRequired?'必需任务被禁用，无法判定验证通过':'尚未配置可运行任务；配置写入不代表工程验证通过');
    const errors=checks.some(c=>['failed','blocked','missing'].includes(c.status));
    return finish(errors?'needs-attention':'not-configured',errors?1:0);
  }
  const evidence=verificationEvidence(root,config);
  // record:false callers may supply a current result, but full readiness still
  // requires an input-bound record instead of trusting a detached passed object.
  add('verification',evidence.status,evidence.message,{evidence:evidence.path,completedAt:evidence.record?.completedAt,scope:verification?.scope??evidence.record?.scope});
  const attention=checks.some(c=>!['passed'].includes(c.status));
  return finish(attention?'needs-attention':'ready',attention?1:0);
}
