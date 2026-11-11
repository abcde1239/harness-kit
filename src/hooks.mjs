import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite, digest, fileHash, hash, json, readJson, safePath } from './fs.mjs';
import { loadConfig } from './config.mjs';
import { inputSnapshot, verificationEvidence } from './workflow.mjs';

const CONFIG='.codex/hooks.json', STATE='.harness/hooks/state.json', RUNTIME='.harness/hooks/runtime.mjs';
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const psQuote = value => `'${value.replaceAll("'", "''")}'`;

function localHooksEnabled(root) {
  const config=safePath(root,'.codex/config.toml');
  if(!fs.existsSync(config))return true;
  return Bun.TOML.parse(fs.readFileSync(config,'utf8')).features?.hooks!==false;
}

export function inspectHooks(root) {
  if(!fs.existsSync(safePath(root,STATE)))return {status:'not-configured',trust:'not-confirmed',message:'未选择可选 Codex Hooks'};
  try {
    if(!localHooksEnabled(root))return {status:'disabled',trust:'not-confirmed',message:'项目 .codex/config.toml 已关闭 hooks；保留该选择，请按需要自行启用'};
    const state=readJson(root,STATE),config=readJson(root,CONFIG);
    if(state.owner!=='harness-kit'||state.version!==1||fileHash(root,RUNTIME)!==state.runtimeHash)throw new Error('Hook runtime or ownership changed');
    for(const event of ['SessionStart','Stop'])if(!(config.hooks?.[event]??[]).some(group=>digest(group)===digest(state.groups?.[event])))throw new Error('Managed hook was modified or removed');
    const command=state.groups.Stop.hooks[0].command;
    if(!command.includes(quote(fs.realpathSync(root)))||!command.includes(quote(process.execPath)))throw new Error('Project or Bun path changed; rerun init --hooks');
    return {status:'configured',trust:'not-confirmed',message:'本地 Hooks 配置与运行器一致；仍需宿主 /hooks 审阅信任，不代表会话已加载'};
  }catch(error){return {status:'conflict',trust:'not-confirmed',message:`Hooks 不可用：${error.message}`};}
}

export async function connectHooks(root) {
  if(!localHooksEnabled(root))return {status:'disabled',exitCode:1,changed:[],conflicts:[],notice:'项目 .codex/config.toml 明确设置 features.hooks=false，已保留禁用选择；如需自动接入，请先自行启用后重新 init --hooks。'};
  const state=fs.existsSync(safePath(root,STATE))?readJson(root,STATE):null;
  if(state && (state.version!==1 || state.owner!=='harness-kit' || !state.groups))throw new Error('Unknown hook ownership state');
  const before=fileHash(root,CONFIG),runtimeBefore=fileHash(root,RUNTIME),stateBefore=fileHash(root,STATE);
  const config=before?readJson(root,CONFIG):{};
  if(!config || Array.isArray(config) || typeof config!=='object' || (config.hooks && (typeof config.hooks!=='object'||Array.isArray(config.hooks))))throw new Error('Invalid existing Codex hooks configuration');
  const conflicts=[];
  if(runtimeBefore && runtimeBefore!==state?.runtimeHash)conflicts.push(RUNTIME);
  const hooks=config.hooks??{};
  for(const event of ['SessionStart','Stop']) {
    if(hooks[event]!==undefined&&!Array.isArray(hooks[event]))throw new Error(`Invalid ${event} hook list`);
    if(state?.groups[event] && !(hooks[event]??[]).some(group=>digest(group)===digest(state.groups[event])))conflicts.push(CONFIG);
  }
  if(conflicts.length)return {status:'conflicts',exitCode:1,changed:[],conflicts:[...new Set(conflicts)],notice:'保留已修改或删除的 Hook；请先比较 .harness/hooks/state.json 中的旧定义。'};
  // An installed Skill supplies the current bundled entry; source tests use bin/.
  const sourceEntry=fileURLToPath(new URL('../bin/harness.mjs',import.meta.url));
  const entry=fs.existsSync(sourceEntry)?sourceEntry:path.resolve(process.argv[1]);
  const build=await Bun.build({entrypoints:[entry],target:'bun',format:'esm',minify:false});
  if(!build.success)throw new Error(`Cannot build project hook runtime: ${build.logs.join('\n')}`);
  const runtime=await build.outputs[0].text(),runtimeFile=safePath(root,RUNTIME);
  const command=`${quote(process.execPath)} ${quote(runtimeFile)} hook --root ${quote(fs.realpathSync(root))}`;
  const commandWindows=`& ${psQuote(process.execPath)} ${psQuote(runtimeFile)} hook --root ${psQuote(fs.realpathSync(root))}`;
  const handler={type:'command',command,commandWindows,timeout:15};
  const groups={SessionStart:{matcher:'startup|resume|clear|compact',hooks:[{...handler,statusMessage:'加载项目验证状态'}]},Stop:{hooks:[{...handler,statusMessage:'检查本次修改的验证证据'}]}};
  for(const event of ['SessionStart','Stop']) {
    const previous=state?.groups[event];
    hooks[event]=(hooks[event]??[]).filter(group=>!previous || digest(group)!==digest(previous));
    hooks[event].push(groups[event]);
  }
  const next={...config,hooks};
  const contents={[RUNTIME]:runtime,[CONFIG]:json(next),[STATE]:json({version:1,owner:'harness-kit',runtimeHash:hash(runtime),groups})};
  const expected={[RUNTIME]:runtimeBefore,[CONFIG]:before,[STATE]:stateBefore},backups=[],changed=[];
  try {
    for(const [name,content] of Object.entries(contents)) {
      if(fileHash(root,name)!==expected[name])throw new Error(`Hook destination changed during setup: ${name}`);
      if(fileHash(root,name)===hash(content))continue;
      const bytes=expected[name]?fs.readFileSync(safePath(root,name)):null;
      atomicWrite(root,name,content);backups.push({name,bytes,written:hash(content)});changed.push(name);
    }
  }catch(error){
    for(const {name,bytes,written} of backups.reverse())if(fileHash(root,name)===written) {
      if(bytes===null)fs.unlinkSync(safePath(root,name));else atomicWrite(root,name,bytes);
    }
    throw error;
  }
  return {status:'configured',exitCode:0,changed,conflicts:[],notice:'Codex 本地 Hook 已配置；在新会话 /hooks 中审阅并信任后生效。移动项目、更换机器或升级后重新 init --hooks；未修改宿主权限。'};
}

// Host events only inspect digests. They never run arbitrary project commands.
export function hookEvent(root,input) {
  if(process.env.HARNESS_ACTIVE)return {};
  if(!input || typeof input!=='object'||Array.isArray(input))throw new Error('Expected hook input object');
  const event=input.hook_event_name;
  if(!['SessionStart','Stop'].includes(event))return {};
  const config=loadConfig(root);
  if(!config.tasks.some(t=>t.enabled))return {systemMessage:'Harness Kit：尚未配置验证任务，不能将配置完成报告为工程验证通过。'};
  if(typeof input.session_id!=='string'||!input.session_id.trim())throw new Error('Hook requires session_id');
  const session=`.harness/hooks/sessions/${hash(input.session_id)}.json`;
  if(event==='SessionStart') {
    // Resume/compaction must not erase the session's unverified source changes.
    if(!fs.existsSync(safePath(root,session)))atomicWrite(root,session,json({version:1,inputDigest:inputSnapshot(root,config).digest}));
    return {hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:'此项目使用 Harness Kit。按 AGENTS.md 和相关 Skill 开发；修改完成后运行 harness run，以当前验证证据报告结果。harness doctor 可恢复检查状态。'}};
  }
  if(!fs.existsSync(safePath(root,session)))return {systemMessage:'Harness Kit：本次会话没有启动快照，无法自动判断修改范围；按项目指令运行 harness run。'};
  const start=readJson(root,session),current=inputSnapshot(root,config);
  if(start.inputDigest===current.digest)return {};
  const evidence=verificationEvidence(root,config);
  if(evidence.status==='passed')return {};
  const reason=`本次项目文件有修改，但当前完整验证证据为 ${evidence.status}。运行 harness run 并检查实际结果；仅修复本任务范围内的问题，环境缺失或失败无法解决时明确报告阻塞。不要将未运行或失败说成通过。`;
  // Continue at most once; never override other hooks with continue:false.
  if(input.stop_hook_active===true)return {systemMessage:`Harness Kit：已提醒一次，自动继续已停止。${reason}`};
  return {decision:'block',reason};
}
