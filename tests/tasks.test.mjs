import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture, write } from './helpers.mjs';
import { makePlan, applyPlan } from '../src/planner.mjs';
import { loadConfig } from '../src/config.mjs';
import { verifyProject } from '../src/workflow.mjs';
import { createTask, getTask, resumeTask, updateTask, recordTaskVerification, completeTask } from '../src/tasks.mjs';

function project(command = ['bun', 'check.mjs']) {
  const root = fixture({ 'check.mjs': 'console.log("ok")' });
  applyPlan(root, makePlan(root, { visibility: 'private', testCommands: { root: command } }));
  createTask(root, { id: 'fix', title: 'Repair calculation', criteria: ['Correct result', 'Existing callers work'], scope: ['src'] });
  return root;
}
function accept(root) {
  updateTask(root, 'fix', { criterion: 'c1', evidence: 'Checked calculation against expected value' });
  updateTask(root, 'fix', { criterion: 'c2', evidence: 'Reviewed caller compatibility and test coverage' });
}
async function run(root, options) {
  const result = await verifyProject(root, loadConfig(root), options);
  recordTaskVerification(root, 'fix', result);
  return result;
}

test('task recovery preserves notes, scope and acceptance without executing commands', () => {
  const root = project();
  updateTask(root, undefined, { note: 'Failure reproduced in input parsing', next: 'Repair parser, then rerun' });
  createTask(root, { id: 'other', criteria: ['Other outcome'] });
  assert.equal(getTask(root).task.id, 'other');
  const before = fs.readFileSync(path.join(root, '.harness/tasks/fix.json'), 'utf8');
  const result = resumeTask(root, 'fix');
  assert.equal(result.task.id, 'fix');
  assert.deepEqual(result.task.scope, ['src']);
  assert.equal(result.next, 'Repair parser, then rerun');
  assert.match(result.task.notes[0].text, /Failure reproduced/);
  assert.equal(fs.existsSync(path.join(root, '.harness/verification.json')), false);
  assert.equal(fs.readFileSync(path.join(root, '.harness/tasks/fix.json'), 'utf8'), before);
  assert.equal(completeTask(root).status, 'blocked');
});

test('completion requires both acceptance and verification bound to this work task', async () => {
  const root = project();
  await verifyProject(root, loadConfig(root));
  accept(root);
  assert.equal(completeTask(root).status, 'blocked');
  await run(root);
  assert.equal(getTask(root).status, 'ready-to-complete');
  assert.equal(completeTask(root).status, 'completed');
  assert.equal(resumeTask(root).status, 'completed');
  assert.throws(() => updateTask(root, 'fix', { note: 'silently reopen' }), /completed/);
});

test('source changes invalidate acceptance and completed state; resume retains history for rechecking', async () => {
  const root = project();
  accept(root); await run(root); completeTask(root);
  write(root, 'src/build/calculation.mjs', 'export const result = 42;');
  assert.equal(getTask(root).status, 'needs-attention');
  assert.deepEqual(getTask(root).criteria.map(c => c.status), ['stale', 'stale']);
  assert.equal(resumeTask(root).task.state, 'in-progress');
  await run(root);
  assert.equal(completeTask(root).status, 'blocked');
  accept(root);
  assert.equal(completeTask(root).status, 'completed');
});

test('partial, failed, unconfigured or replaced validation cannot complete a task', async () => {
  const root = project(); accept(root);
  await run(root, { selected: ['root:test'] });
  assert.equal(getTask(root).verification.status, 'partial');
  assert.equal(completeTask(root).status, 'blocked');
  write(root, 'check.mjs', 'process.exit(1)'); accept(root);
  await run(root);
  assert.equal(getTask(root).verification.status, 'failed');
  assert.equal(completeTask(root).status, 'blocked');
  write(root, 'check.mjs', ''); accept(root);
  const result = await run(root);
  await verifyProject(root, loadConfig(root));
  assert.throws(() => recordTaskVerification(root, 'fix', result), /replaced/);
  assert.equal(completeTask(root).status, 'blocked');
  const empty = project(null); accept(empty); await run(empty);
  assert.equal(completeTask(empty).status, 'blocked');
});

test('task mutations reject traversal, duplicates, unknown criteria and concurrent writers', () => {
  const root = project();
  for (const id of ['../escape', 'con', 'COM1', 'A', 'x/y', '.']) assert.throws(() => createTask(root, { id, criteria: ['x'] }));
  assert.throws(() => createTask(root, { id: 'fix', criteria: ['x'] }), /already exists/);
  assert.throws(() => createTask(root, { id: 'empty', criteria: [] }), /acceptance/);
  assert.throws(() => createTask(root, { id: 'bad', criteria: ['x'], scope: ['../outside'] }), /Unsafe/);
  assert.throws(() => updateTask(root, 'fix', { criterion: 'c3', evidence: 'x' }), /Unknown criterion/);
  assert.throws(() => updateTask(root, 'fix', { criterion: 'c1' }), /together/);
  write(root, '.harness/tasks.lock', 'another writer');
  assert.throws(() => updateTask(root, 'fix', { note: 'should not write' }), /locked/);
  assert.equal(getTask(root).task.notes.length, 0);
  assert.equal(fs.readFileSync(path.join(root, '.harness/tasks.lock'), 'utf8'), 'another writer');
});

test('missing and malformed task records fail explicitly without overwriting them', () => {
  const root = fixture();
  assert.throws(() => getTask(root), /No active task/);
  const configured = project();
  write(configured, '.harness/tasks/fix.json', { version: 1, id: 'fix', state: 'completed' });
  assert.throws(() => resumeTask(configured), /Invalid task record/);
  assert.throws(() => getTask(configured, 'absent'), /Cannot read/);
});

test('editing a task definition invalidates old acceptance without needing a source edit', async () => {
  const root=project(); accept(root); await run(root);
  const task=getTask(root).task;
  task.criteria[0].text='A newly requested behavior';
  write(root,'.harness/tasks/fix.json',task);
  assert.deepEqual(getTask(root).criteria.map(c=>c.status),['stale','stale']);
  assert.equal(completeTask(root).status,'blocked');
  accept(root);
  assert.equal(completeTask(root).status,'completed');
});
