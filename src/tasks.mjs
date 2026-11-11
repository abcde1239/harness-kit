import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { atomicWrite, digest, json, readJson, relativePath, safePath } from './fs.mjs';
import { EVIDENCE, inputSnapshot, verificationEvidence } from './workflow.mjs';

const ACTIVE = '.harness/active-task.json';
const LOCK = '.harness/tasks.lock';
const now = () => new Date().toISOString();
function taskId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) throw new Error('Task ID must be 1–64 lowercase letters, digits, hyphens or underscores');
  relativePath(id);
  return id;
}
const taskPath = id => `.harness/tasks/${taskId(id)}.json`;
function text(value, label, max = 8000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error(`${label} must be non-empty text (up to ${max} characters)`);
  return value.trim();
}
function resolveId(root, id) {
  if (id !== undefined) return taskId(id);
  if (!fs.existsSync(safePath(root, ACTIVE))) throw new Error('No active task; use harness task start <id> --accept "..." or specify an ID');
  return taskId(readJson(root, ACTIVE).id);
}
function readTask(root, id) {
  const task = readJson(root, taskPath(id));
  if (task.version !== 1 || task.id !== id || !['in-progress','completed'].includes(task.state) || !Number.isSafeInteger(task.revision) || task.revision < 1 || !Array.isArray(task.criteria) || !task.criteria.length || !Array.isArray(task.notes) || !Array.isArray(task.scope)) throw new Error(`Invalid task record: ${id}`);
  text(task.title, 'title');
  task.scope.forEach(p => relativePath(p));
  for (const [i, criterion] of task.criteria.entries()) {
    if (criterion.id !== `c${i + 1}`) throw new Error(`Invalid criterion in task: ${id}`);
    text(criterion.text, 'criterion');
    if (criterion.acceptance !== null && (!criterion.acceptance || typeof criterion.acceptance.inputDigest !== 'string' || typeof criterion.acceptance.configDigest !== 'string')) throw new Error(`Invalid acceptance in task: ${id}`);
    if (criterion.acceptance) text(criterion.acceptance.evidence, 'evidence');
  }
  return task;
}
// A short, exclusive write transaction. Never reclaim another process's lock.
function mutate(root, action) {
  const lock = safePath(root, LOCK);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Task state is locked (.harness/tasks.lock). Retry; after a crash, confirm no writer is running before removing the lock');
    throw error;
  }
  try { return action(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function save(root, task) {
  task.updatedAt = now();
  task.revision++;
  atomicWrite(root, taskPath(task.id), json(task));
}
function context(root) {
  const config = loadConfig(root);
  return { input: inputSnapshot(root, config), configDigest: digest(config), evidence: verificationEvidence(root, config) };
}
const definitionDigest = task => digest({ id: task.id, title: task.title, scope: task.scope, criteria: task.criteria.map(({id, text}) => ({id, text})) });
function report(root, task, ctx = context(root)) {
  const criteria = task.criteria.map(c => ({ id: c.id, text: c.text,
    status: !c.acceptance ? 'pending' : !ctx.input.unsupported.length && c.acceptance.inputDigest === ctx.input.digest && c.acceptance.configDigest === ctx.configDigest && c.acceptance.definitionDigest === definitionDigest(task) ? 'accepted' : 'stale',
    ...(c.acceptance ? { evidence: c.acceptance.evidence } : {}) }));
  const linked = task.verification && ctx.evidence.record && task.verification.digest === digest(ctx.evidence.record);
  const verification = { status: !task.verification ? 'missing' : !linked ? 'stale' : ctx.evidence.status,
    message: !task.verification ? `运行 harness run --work ${task.id} 关联验证` : !linked ? '关联的验证记录已被替换或不可用，请重新关联验证' : ctx.evidence.message };
  const ready = criteria.every(c => c.status === 'accepted') && verification.status === 'passed';
  const status = task.state === 'completed' ? ready ? 'completed' : 'needs-attention' : ready ? 'ready-to-complete' : 'in-progress';
  const next = task.next || (criteria.some(c => c.status !== 'accepted') ? '核对验收项，使用 harness task accept 记录当前证据' : verification.status !== 'passed' ? verification.message : task.state === 'completed' ? '任务已完成；新改动请建立任务或恢复后重新验收' : `运行 harness task finish ${task.id}`);
  return { status, exitCode: 0, task, criteria, verification, next, execution: 'manual', scopeEnforcement: 'advisory' };
}
function editable(task) {
  if (task.state === 'completed') throw new Error('Task is completed; use task resume after changes or start a new task');
}

export function createTask(root, { id, title = id, criteria, scope = ['.'] } = {}) {
  taskId(id); title = text(title, 'title', 500);
  if (!Array.isArray(criteria) || !criteria.length || criteria.length > 100) throw new Error('Provide 1–100 acceptance criteria with --accept');
  criteria = criteria.map((value, i) => ({ id: `c${i + 1}`, text: text(value, 'criterion'), acceptance: null }));
  if (!Array.isArray(scope) || !scope.length) throw new Error('scope must be a non-empty relative path array');
  scope = [...new Set(scope.map(p => relativePath(p)))];
  const ctx = context(root);
  return mutate(root, () => {
    if (fs.existsSync(safePath(root, taskPath(id)))) throw new Error(`Task already exists: ${id}; use task resume`);
    const task = { version: 1, id, title, state: 'in-progress', scope, criteria, notes: [], next: '', verification: null, createdAt: now(), updatedAt: now(), revision: 1 };
    atomicWrite(root, taskPath(id), json(task));
    atomicWrite(root, ACTIVE, json({ version: 1, id }));
    return report(root, task, ctx);
  });
}

export function getTask(root, id) { return report(root, readTask(root, resolveId(root, id))); }

export function resumeTask(root, id) {
  return mutate(root, () => {
    const task = readTask(root, resolveId(root, id)), ctx = context(root);
    if (task.state === 'completed' && report(root, task, ctx).status !== 'completed') {
      task.state = 'in-progress';
      delete task.completedAt;
      save(root, task);
    }
    atomicWrite(root, ACTIVE, json({ version: 1, id: task.id }));
    return report(root, task, ctx);
  });
}

export function updateTask(root, id, { note, next, criterion, evidence } = {}) {
  if (note === undefined && next === undefined && criterion === undefined) throw new Error('Provide a note, next action or criterion with evidence');
  if ((criterion === undefined) !== (evidence === undefined)) throw new Error('criterion and evidence must be provided together');
  if (note !== undefined) note = text(note, 'note');
  if (next !== undefined && next !== '') next = text(next, 'next');
  if (evidence !== undefined) evidence = text(evidence, 'evidence');
  return mutate(root, () => {
    const task = readTask(root, resolveId(root, id)); editable(task);
    const ctx = context(root);
    if (criterion !== undefined) {
      const item = task.criteria.find(c => c.id === criterion);
      if (!item) throw new Error(`Unknown criterion: ${criterion}`);
      if (ctx.input.unsupported.length) throw new Error('Cannot bind acceptance to unsupported project inputs');
      item.acceptance = { evidence, acceptedAt: now(), inputDigest: ctx.input.digest, configDigest: ctx.configDigest, definitionDigest: definitionDigest(task) };
    }
    if (note !== undefined) task.notes.push({ text: note, at: now() });
    if (next !== undefined) task.next = next;
    save(root, task);
    return report(root, task, ctx);
  });
}

export function recordTaskVerification(root, id, result) {
  return mutate(root, () => {
    const task = readTask(root, resolveId(root, id)); editable(task);
    const record = readJson(root, EVIDENCE);
    if (!result?.evidence?.digest || result.evidence.digest !== digest(record)) throw new Error('Verification was not recorded by this run or was replaced; rerun with --work');
    task.verification = { digest: digest(record), completedAt: record.completedAt, status: result.evidence.status };
    save(root, task);
    return { ...report(root, task), status: 'recorded', exitCode: 0 };
  });
}

export function completeTask(root, id) {
  return mutate(root, () => {
    const task = readTask(root, resolveId(root, id)), result = report(root, task);
    if (!result.criteria.every(c => c.status === 'accepted') || result.verification.status !== 'passed') return { ...result, status: 'blocked', exitCode: 1 };
    if (task.state !== 'completed') {
      task.state = 'completed'; task.completedAt = now(); task.next = '';
      save(root, task);
    }
    return { ...result, status: 'completed', task, next: '任务已完成；新改动请建立任务或恢复后重新验收' };
  });
}
