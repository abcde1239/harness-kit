import fs from 'node:fs';
import { atomicWrite, digest, fileHash, json, readJson, safePath, walk } from './fs.mjs';
import { effectiveTests } from './config.mjs';
import { lint } from './lint.mjs';
import { verify } from './runner.mjs';
import {runtimeEnvironment} from './runtime.mjs';

export const EVIDENCE = '.harness/verification.json';

// Store only digests and statuses, never command stdout or source contents.
export function inputSnapshot(root, config) {
  const excluded = [...new Set(config.workspaces.flatMap(w=>effectiveTests(config,w).artifacts.map(p=>w.root==='.'?p:`${w.root}/${p}`)))].sort();
  // Source folders called src/build remain source. Only declared output roots
  // are pruned; discovery's broad directory-name ignores cannot prove freshness.
  const ignored=['.git','node_modules','.harness'];
  const entries = walk(root,{ignore:ignored,prune:excluded});
  const files = entries.map(e=>({path:e.path,type:e.type,sha256:e.type==='file'?fileHash(root,e.path):null}));
  return {digest:digest(files),files:files.length,unsupported:[...entries.filter(e=>e.type!=='file').map(e=>e.path),...(excluded.includes('.')?['excluded-project-root']:[])],excluded:[...ignored,...excluded]};
}
const environment = runtimeEnvironment;

export function verificationEvidence(root, config) {
  if(!fs.existsSync(safePath(root,EVIDENCE))) return {status:'missing',path:EVIDENCE,message:'尚未运行验证：harness run'};
  try {
    const record=readJson(root,EVIDENCE), snapshot=inputSnapshot(root,config);
    if(record.version!==1 || !Array.isArray(record.tasks) || !Array.isArray(record.workspaces) || !record.input?.digest || !record.environment) throw new Error('Invalid verification record');
    if(record.configDigest!==digest(config) || digest(record.environment)!==digest(environment()) || record.input.digest!==snapshot.digest || record.stable!==true || snapshot.unsupported.length) return {status:'stale',path:EVIDENCE,message:'文件、配置或环境已变化，请运行 harness run',record};
    if(record.scope!=='all-tasks') return {status:'partial',path:EVIDENCE,message:'上次只验证了所选任务，尚无完整验证证据',record};
    // A truncated but syntactically valid JSON record must not look complete.
    const taskIds = new Set(record.tasks.map(t => t.id));
    if(record.tasks.length !== config.tasks.length || taskIds.size !== record.tasks.length || config.tasks.some(t => !record.tasks.some(r => r.id === t.id && r.workspace === t.workspace && r.required === t.required))) throw new Error('Verification task coverage does not match configuration');
    const workspaceIds = new Set(record.workspaces.map(w => w.id));
    if(record.workspaces.length !== config.workspaces.length || workspaceIds.size !== record.workspaces.length || config.workspaces.some(w => {
      const item=record.workspaces.find(r => r.id === w.id), tests=config.tasks.filter(t => t.kind==='test' && t.covers.includes(w.id));
      const status=!tests.length?'not-configured':tests.every(t => record.tasks.find(r => r.id===t.id)?.status==='passed')?'passed':'incomplete';
      return !item || item.required!==effectiveTests(config,w).requireConfiguredTask || item.status!==status;
    })) throw new Error('Verification workspace coverage does not match configuration');
    if(!record.tasks.length && record.verificationStatus!=='not-configured' && record.verificationStatus!=='failed') throw new Error('Empty validation cannot be passed');
    if(record.verificationStatus==='not-configured') return {status:'not-configured',path:EVIDENCE,message:'尚未配置验证任务',record};
    if(record.exitCode!==0 || record.governanceStatus!=='passed' || record.verificationStatus!=='passed' || record.tasks.some(t=>t.status!=='passed')) return {status:'failed',path:EVIDENCE,message:'上次验证未全部通过，请修复后运行 harness run',record};
    return {status:'passed',path:EVIDENCE,message:'完整验证通过，输入摘要仍匹配',record};
  } catch(error) {return {status:'invalid',path:EVIDENCE,message:`验证记录不可用：${error.message}`};}
}

export async function verifyProject(root, config, {selected,signal,record=true}={}) {
  const before=inputSnapshot(root,config), governance=lint(root,config);
  const verification=await verify(root,config,{selected,signal});
  const exitCode=Math.max(governance.exitCode,verification.exitCode);
  const result={status:exitCode?'failed':verification.status,exitCode,governance,verification};
  if(record) {
    const after=inputSnapshot(root,config);
    const evidence={version:1,completedAt:new Date().toISOString(),configDigest:digest(config),environment:environment(),input:before,stable:before.digest===after.digest && !before.unsupported.length && !after.unsupported.length,scope:verification.scope,selected:selected??null,exitCode,governanceStatus:governance.status,verificationStatus:verification.status,tasks:verification.tasks.map(({output,...task})=>task),workspaces:verification.workspaces};
    atomicWrite(root,EVIDENCE,json(evidence));
    result.evidence={path:EVIDENCE,status:verificationEvidence(root,config).status,stable:evidence.stable,digest:digest(evidence)};
  }
  return result;
}
