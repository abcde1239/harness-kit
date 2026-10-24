import fs from 'node:fs';
import path from 'node:path';
import { safePath } from './fs.mjs';
import { effectiveTests } from './config.mjs';

export function taskOrder(tasks, selected) {
  const byId = new Map(tasks.map(t => [t.id, t])), visiting = new Set(), visited = new Set(), result = [];
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Task dependency cycle: ${id}`);
    const task = byId.get(id); if (!task) throw new Error(`Unknown task: ${id}`);
    visiting.add(id); for (const dep of task.dependsOn ?? []) visit(dep);
    visiting.delete(id); visited.add(id); result.push(task);
  }
  for (const id of selected ?? tasks.map(t => t.id)) visit(id);
  return result;
}
function launchCommand(argv) {
  const [command, ...args] = argv;
  if (command === 'bun') return { command: process.execPath, args };
  if (process.platform !== 'win32' || /\.exe$/i.test(command)) return { command, args };
  const candidates = path.isAbsolute(command) ? [command] : (process.env.PATH ?? '').split(path.delimiter).flatMap(dir => [path.join(dir,command), ...['.exe','.cmd','.bat'].map(ext => path.join(dir,command+ext))]);
  const resolved = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!resolved || !/\.(cmd|bat)$/i.test(resolved)) return { command: resolved ?? command, args };
  // Windows package-manager shims need cmd.exe. Reject shell metacharacters rather than interpolate them.
  for (const token of [resolved,...args]) if (/["&|<>^%!\r\n]/.test(token)) throw new Error('Unsafe argument for Windows .cmd shim; use a native executable or JS entrypoint');
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d','/s','/c', `"${[resolved,...args].map(x => `"${x}"`).join(' ')}"`], windowsVerbatimArguments: true };
}
async function runTask(root, config, task, signal) {
  const w = config.workspaces.find(w => w.id === task.workspace);
  const cwd = safePath(root, w.root === '.' ? task.cwd : `${w.root}/${task.cwd}`, { allowMissing: false });
  const launch = launchCommand(task.argv);
  const start = Date.now(); let output = '', reason = null; const readers=[];
  const child = Bun.spawn([launch.command,...launch.args], { cwd, windowsHide:true, windowsVerbatimArguments:launch.windowsVerbatimArguments, detached:process.platform !== 'win32', env:{...process.env,HARNESS_ACTIVE:'1'}, stdin:'ignore',stdout:'pipe',stderr:'pipe' });
  async function capture(stream) {
    const reader=stream.getReader(); readers.push(reader);
    try { while(true) {const {done,value}=await reader.read(); if(done)break;output=(output+Buffer.from(value).toString()).slice(-32768);} }
    finally {reader.releaseLock();}
  }
  const streams = Promise.all([capture(child.stdout),capture(child.stderr)]);
  function stop(why) {
    reason = why;
    if (process.platform === 'win32') Bun.spawnSync(['taskkill','/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdout:'ignore',stderr:'ignore',timeout:2000});
    else { try { process.kill(-child.pid,'SIGKILL'); } catch {} }
    try {child.kill('SIGKILL');} catch {}
    for(const reader of readers) {try {reader.cancel().catch(()=>{});} catch {}}
  }
  const timeout=setTimeout(()=>stop('timeout'),task.timeoutMs), abort=()=>stop('cancelled');
  signal?.addEventListener('abort',abort,{once:true}); if(signal?.aborted)abort();
  try {
    const code=await child.exited; await streams;
    return {id:task.id,workspace:task.workspace,required:task.required,status:reason?'blocked':code===0?'passed':'failed',code,reason,durationMs:Date.now()-start,output};
  } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
export async function verify(root, config, { selected, signal } = {}) {
  if (process.env.HARNESS_ACTIVE) throw new Error('Recursive harness invocation refused; configure underlying commands instead');
  const ordered = taskOrder(config.tasks, selected), results = [], done = new Map();
  for (const task of ordered) {
    let result;
    if (signal?.aborted) result = { status: 'blocked', reason: 'cancelled' };
    else if (!task.enabled) result = { status: 'skipped', reason: 'disabled' };
    else if (task.dependsOn.some(id => done.get(id)?.status !== 'passed')) result = { status: 'blocked', reason: 'dependency-not-passed' };
    else {
      try { result = await runTask(root, config, task, signal); }
      catch (error) { result = { status: 'blocked', reason: error.message }; }
    }
    result = { id: task.id, workspace: task.workspace, required: task.required, ...result };
    results.push(result); done.set(task.id, result);
  }
  const workspaces = config.workspaces.map(w => {
    const tests = ordered.filter(t => t.kind === 'test' && t.covers.includes(w.id));
    if(selected && !tests.length) return {id:w.id,status:'not-selected',required:false};
    return { id: w.id, status: !tests.length ? 'not-configured' : tests.every(t => done.get(t.id)?.status === 'passed') ? 'passed' : 'incomplete', required: effectiveTests(config,w).requireConfiguredTask };
  });
  const failed = results.some(r => r.required && r.status !== 'passed') || workspaces.some(w => w.required && w.status !== 'passed');
  return { status: failed ? 'failed' : results.length ? 'passed' : 'not-configured', exitCode: failed ? (results.some(r => r.required && r.status === 'blocked') ? 2 : 1) : 0, scope: selected ? 'selected-tasks' : 'all-tasks', tasks: results, workspaces };
}
