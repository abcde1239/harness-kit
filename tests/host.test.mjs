import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture, write } from './helpers.mjs';
import { makePlan, applyPlan } from '../src/planner.mjs';
import { AGENT_BLOCK_START, AGENT_BLOCK_END, agentInstructions, inspectAgentEntry } from '../src/host.mjs';
import { hash, json } from '../src/fs.mjs';

const answers = { visibility: 'private', testCommands: { root: null } };
const read = (root, name) => fs.readFileSync(path.join(root, name), 'utf8');

test('new project gets an Agent entry without a private document link or false live-load claim', () => {
  const root = fixture();
  assert.equal(inspectAgentEntry(root).status, 'missing');
  applyPlan(root, makePlan(root, answers));
  const result = inspectAgentEntry(root), content = read(root, 'AGENTS.md');
  assert.equal(result.status, 'configured');
  assert.equal(result.loaded, 'not-confirmed');
  assert.ok(!/\]\([^)]*(?:MEMORY|agent_guide|decision)/i.test(content));
  assert.ok(content.includes(agentInstructions));
});

test('existing Agent instructions are retained when attaching and when users edit outside the block', () => {
  const original = '# Team conventions\r\n\r\nKeep the payment API stable.\r\n';
  const root = fixture({ 'AGENTS.md': original });
  const first = makePlan(root, answers), entry = first.files.find(f => f.path === 'AGENTS.md');
  assert.equal(entry.action, 'update');
  applyPlan(root, first);
  assert.ok(read(root, 'AGENTS.md').startsWith(original));
  assert.ok(read(root, 'AGENTS.md').includes('\r\n' + AGENT_BLOCK_START));
  const userAddition = '\r\n## Service rules\r\nKeep the legacy service entry.\r\n';
  write(root, 'AGENTS.md', read(root, 'AGENTS.md') + userAddition);
  const second = makePlan(root, answers);
  assert.equal(second.files.find(f => f.path === 'AGENTS.md').action, 'unchanged');
  assert.deepEqual(applyPlan(root, second).changed, []);
  assert.ok(read(root, 'AGENTS.md').endsWith(userAddition));
});

test('user edits to an Agent block conflict without losing surrounding content', () => {
  const root = fixture({ 'AGENTS.md': '# Custom\nNever move tests.\n' });
  applyPlan(root, makePlan(root, answers));
  const content = read(root, 'AGENTS.md').replace('harness run', 'team-verify');
  write(root, 'AGENTS.md', content);
  const plan = makePlan(root, answers), entry = plan.files.find(f => f.path === 'AGENTS.md');
  assert.equal(entry.action, 'conflict');
  assert.ok(entry.reason.includes('modified'));
  assert.ok(applyPlan(root, plan).conflicts.includes('AGENTS.md'));
  assert.equal(read(root, 'AGENTS.md'), content);
  assert.equal(inspectAgentEntry(root).status, 'conflict');
  assert.equal(inspectAgentEntry(root).managed, false);
});

test('a previously owned old block can update while retaining new user text outside it', () => {
  const root = fixture();
  applyPlan(root, makePlan(root, answers));
  const oldBlock = `${AGENT_BLOCK_START}\nUse the old commands.\n${AGENT_BLOCK_END}`;
  write(root, 'AGENTS.md', `# User header\n\n${oldBlock}\n\nUser footer\n`);
  const state = JSON.parse(read(root, '.harness/managed.json'));
  state.blocks['AGENTS.md'] = hash(oldBlock);
  write(root, '.harness/managed.json', json(state));
  const plan = makePlan(root, answers), entry = plan.files.find(f => f.path === 'AGENTS.md');
  assert.equal(entry.action, 'update');
  applyPlan(root, plan);
  assert.ok(read(root, 'AGENTS.md').startsWith('# User header\n\n'));
  assert.ok(read(root, 'AGENTS.md').endsWith('\n\nUser footer\n'));
  assert.ok(read(root, 'AGENTS.md').includes(agentInstructions));
});

test('removed managed blocks and malformed markers are preserved for review', () => {
  const root = fixture();
  applyPlan(root, makePlan(root, answers));
  write(root, 'AGENTS.md', '# Deliberately removed integration\n');
  let plan = makePlan(root, answers);
  assert.equal(plan.files.find(f => f.path === 'AGENTS.md').action, 'conflict');
  applyPlan(root, plan);
  assert.equal(read(root, 'AGENTS.md'), '# Deliberately removed integration\n');
  write(root, 'AGENTS.md', '# Team\n' + AGENT_BLOCK_START + '\nPartial block\n');
  plan = makePlan(root, answers);
  assert.equal(plan.files.find(f => f.path === 'AGENTS.md').action, 'conflict');
  applyPlan(root, plan);
  assert.equal(inspectAgentEntry(root).status, 'conflict');
});

test('Agent entry edits after planning invalidate the plan before other files are written', () => {
  const root = fixture({ 'AGENTS.md': '# User instructions\n' });
  const plan = makePlan(root, answers);
  write(root, 'AGENTS.md', '# New user instructions\n');
  assert.throws(() => applyPlan(root, plan), /Stale plan: AGENTS.md/);
  assert.equal(fs.existsSync(path.join(root, 'harness.config.json')), false);
  assert.equal(read(root, 'AGENTS.md'), '# New user instructions\n');
});

test('root override is reported as taking precedence rather than live integration success', () => {
  const root = fixture({ 'AGENTS.override.md': '# Existing override\nUse service-specific commands.\n' });
  applyPlan(root, makePlan(root, answers));
  const result = inspectAgentEntry(root);
  assert.equal(result.present, true);
  assert.equal(result.overridden, true);
  assert.equal(result.status, 'overridden');
  assert.equal(result.loaded, 'not-confirmed');
  assert.equal(read(root, 'AGENTS.override.md'), '# Existing override\nUse service-specific commands.\n');
});
