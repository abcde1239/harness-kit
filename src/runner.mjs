import fs from 'node:fs';
import path from 'node:path';
import { safePath } from './fs.mjs';
import { effectiveTests } from './config.mjs';
import {isBun} from './runtime.mjs';
import {runProcess} from './subprocess.mjs';

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
  if (command === (isBun?'bun':'node')) return { command: process.execPath, args };
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
  const start=Date.now();
  // Keep nested calls on the selected runtime without rewriting project commands.
  const taskEnv={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH??''),HARNESS_ACTIVE:'1'};
  const result=await runProcess([launch.command,...launch.args],{cwd,env:taskEnv,timeoutMs:task.timeoutMs,signal,windowsVerbatimArguments:launch.windowsVerbatimArguments});
  return {id:task.id,workspace:task.workspace,required:task.required,status:result.reason?'blocked':result.exitCode===0?'passed':'failed',code:result.exitCode,reason:result.reason,durationMs:Date.now()-start,output:result.output};
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
