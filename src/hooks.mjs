import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {parse as parseToml} from 'smol-toml';
import { atomicWrite, digest, fileHash, hash, json, readJson, safePath } from './fs.mjs';
import { loadConfig } from './config.mjs';
import { inputSnapshot, verificationEvidence } from './workflow.mjs';
import { setHookStopRequested, touchHookSession } from './hook-state.mjs';

const hookFiles = {
  codex: { config: '.codex/hooks.json', directory: '.harness/hooks' },
  claude: { config: '.claude/settings.local.json', directory: '.harness/hooks/claude' },
  dsh: { config: '.harness/hooks/dsh/hooks.json', directory: '.harness/hooks/dsh' },
};
export const hookHosts = Object.keys(hookFiles);
const events = ['SessionStart', 'Stop'];
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const psQuote = value => `'${value.replaceAll("'", "''")}'`;

function paths(host) {
  if (!Object.hasOwn(hookFiles, host)) throw new Error(`Unsupported Hook host: ${host}`);
  const { config, directory } = hookFiles[host];
  return { config, state: `${directory}/state.json`, runtime: `${directory}/runtime.mjs` };
}

function localHooksEnabled(root, host) {
  if (host === 'dsh') return true;
  if (host === 'claude') {
    for (const name of ['.claude/settings.local.json', '.claude/settings.json']) {
      if (!fs.existsSync(safePath(root, name))) continue;
      const disabled = readJson(root, name)?.disableAllHooks;
      if (typeof disabled === 'boolean') return !disabled;
    }
    return true;
  }
  const config = safePath(root, '.codex/config.toml');
  return !fs.existsSync(config) || parseToml(fs.readFileSync(config, 'utf8')).features?.hooks !== false;
}

function handlers(root, host, runtimeFile) {
  const args = [runtimeFile, 'hook', '--root', fs.realpathSync(root)];
  if (host !== 'codex') args.push('--host', host);
  const argv = [process.execPath, ...args];
  const shell = argv.map(quote).join(' ');
  const powershell = `& ${argv.map(psQuote).join(' ')}`;
  const common = { type: 'command', timeout: 15 };
  if (host === 'codex') return { ...common, command: shell, commandWindows: powershell };
  if (host === 'claude' && process.platform === 'win32') return { ...common, command: powershell, shell: 'powershell' };
  return { ...common, command: process.platform === 'win32' ? powershell : shell };
}

function bridgeDetails(root, config) {
  return { name: '@deepseek-ai/dsh-hooks-claude-code', configPath: safePath(root, config) };
}

export function inspectHooks(root, host = 'codex') {
  const { config, state, runtime } = paths(host);
  const trust = 'not-confirmed';
  try {
    if (!fs.existsSync(safePath(root, state))) return { host, status: 'not-configured', trust };
    if (!localHooksEnabled(root, host)) return { host, status: 'disabled', trust, message: `${host} 的项目设置已关闭 Hooks。` };
    const saved = readJson(root, state), registration = readJson(root, config);
    if (saved.owner !== 'harness-kit' || saved.version !== 1 || fileHash(root, runtime) !== saved.runtimeHash) throw new Error('Hook runtime or ownership changed');
    for (const event of events) {
      if (!(registration.hooks?.[event] ?? []).some(group => digest(group) === digest(saved.groups?.[event]))) throw new Error('Managed hook was modified or removed');
    }
    const actual = saved.groups.Stop.hooks[0];
    const expected = handlers(root, host, safePath(root, runtime));
    if (actual.command !== expected.command || actual.commandWindows !== expected.commandWindows || actual.shell !== expected.shell) throw new Error('Project or runtime path changed; rerun init --hooks');
    if (host === 'dsh') return { host, status: 'profile-required', trust, bridge: bridgeDetails(root, config), message: 'DSH 项目 Hook 配置有效。将桥接器指向该配置并重启所用 profile；宿主加载尚未确认。' };
    return { host, status: 'configured', trust, message: `${host} 本地 Hook 配置与运行器一致；需在宿主中审阅并确认加载。` };
  } catch (error) {
    return { host, status: 'conflict', trust, message: `Hooks 不可用：${error.message}` };
  }
}

export async function connectHooks(root, host = 'codex') {
  const { config: CONFIG, state: STATE, runtime: RUNTIME } = paths(host);
  if (!localHooksEnabled(root, host)) return { host, status: 'disabled', exitCode: 1, changed: [], conflicts: [], notice: `${host} 的项目设置已关闭 Hooks。保留该选择。` };
  const state=fs.existsSync(safePath(root,STATE))?readJson(root,STATE):null;
  if(state && (state.version!==1 || state.owner!=='harness-kit' || !state.groups))throw new Error('Unknown hook ownership state');
  const before=fileHash(root,CONFIG),runtimeBefore=fileHash(root,RUNTIME),stateBefore=fileHash(root,STATE);
  const config=before?readJson(root,CONFIG):{};
  if(!config || Array.isArray(config) || typeof config!=='object' || (config.hooks && (typeof config.hooks!=='object'||Array.isArray(config.hooks))))throw new Error('Invalid existing hooks configuration');
  const conflicts=[];
  if(runtimeBefore && runtimeBefore!==state?.runtimeHash)conflicts.push(RUNTIME);
  const hooks=config.hooks??{};
  for(const event of events) {
    if(hooks[event]!==undefined&&!Array.isArray(hooks[event]))throw new Error(`Invalid ${event} hook list`);
    if(state?.groups[event] && !(hooks[event]??[]).some(group=>digest(group)===digest(state.groups[event])))conflicts.push(CONFIG);
  }
  if(conflicts.length)return {host,status:'conflicts',exitCode:1,changed:[],conflicts:[...new Set(conflicts)],notice:`保留已修改或删除的 Hook；请先比较 ${STATE} 中的旧定义。`};
  // Packaged runtimes copy themselves; only source development needs a builder.
  const bundled=typeof HARNESS_BUNDLED!=='undefined'&&HARNESS_BUNDLED;
  const runtime=bundled?fs.readFileSync(fileURLToPath(import.meta.url),'utf8'):(await (await import('../scripts/build.mjs')).buildCLI()).toString('utf8');
  const handler = handlers(root, host, safePath(root, RUNTIME));
  const groups = {
    SessionStart: { matcher: host === 'claude' ? 'startup|resume|clear|compact|fork' : 'startup|resume|clear|compact', hooks: [handler] },
    Stop: { hooks: [{ ...handler }] },
  };
  if (host === 'codex') {
    groups.SessionStart.hooks[0].statusMessage = '加载项目验证状态';
    groups.Stop.hooks[0].statusMessage = '检查本次修改的验证证据';
  }
  for(const event of events) {
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
  if (host === 'dsh') return {host,status:'profile-required',exitCode:0,changed,conflicts:[],bridge:bridgeDetails(root, CONFIG),notice:'DSH 的项目 Hook 文件已就绪。将当前 profile 的官方 Claude Hook 桥接器指向该文件并重启。'};
  return {host,status:'configured',exitCode:0,changed,conflicts:[],notice:host === 'codex'
    ? 'Codex 本地 Hook 已配置；在新会话 /hooks 中审阅并信任。移动项目、更换机器或升级后重新 init --hooks。'
    : 'Claude Code 本地 Hook 已配置；在受信任的项目中新开会话并通过 /hooks 确认加载。'};
}

export function hookEvent(root,input,host = 'codex') {
  if(process.env.HARNESS_ACTIVE)return {};
  if(!input || typeof input!=='object'||Array.isArray(input))throw new Error('Expected hook input object');
  const event=input.hook_event_name;
  if(!events.includes(event))return {};
  paths(host);
  // DSH mounts the bridge per profile, which may open multiple projects.
  if (host === 'dsh') {
    if (typeof input.cwd !== 'string' || !path.isAbsolute(input.cwd) || !fs.existsSync(input.cwd)) return {};
    const relative = path.relative(fs.realpathSync(root), fs.realpathSync(input.cwd));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return {};
  }
  const config=loadConfig(root);
  if(!config.tasks.some(t=>t.enabled))return {systemMessage:'Harness Kit: no verification tasks are configured. Configuration completion is not engineering verification.'};
  if(typeof input.session_id!=='string'||!input.session_id.trim())throw new Error('Hook requires session_id');
  // Codex keeps its existing session keys. Other hosts namespace theirs.
  const key = host === 'codex' ? input.session_id : `${host}\0${input.session_id}`;
  const session = touchHookSession(root, key, event === 'SessionStart' ? () => inputSnapshot(root, config).digest : undefined);
  if(session.status === 'missing')return {systemMessage:'Harness Kit: this session has no initial snapshot, so its change scope cannot be determined automatically. Run harness run as required by project instructions.'};
  if (session.status !== 'recorded') return {};
  if (event === 'SessionStart') {
    return { hookSpecificOutput: {
      hookEventName: event,
      additionalContext: 'Harness Kit: follow the project instructions. After changing project files, run harness run and check the actual verification results before reporting completion.',
    } };
  }
  const current=inputSnapshot(root,config);
  if(session.inputDigest===current.digest)return {};
  const evidence=verificationEvidence(root,config);
  if(evidence.status==='passed') {
    if (host === 'dsh' && session.stopRequested) setHookStopRequested(root, key, false);
    return {};
  }
  const reason=`Project files changed in this session, but current complete verification evidence is ${evidence.status}. Run harness run and inspect actual results. Fix only issues within this task's scope; report unresolved failures or missing environment requirements. Never report unrun or failed checks as passed.`;
  // Continue at most once; never override other hooks with continue:false.
  if(input.stop_hook_active===true)return {systemMessage:`Harness Kit: verification was already requested once; automatic continuation has stopped. ${reason}`};
  // DSH's compatibility bridge always reports stop_hook_active as false.
  if (host === 'dsh' && !setHookStopRequested(root, key, true)) return {};
  return {decision:'block',reason};
}
