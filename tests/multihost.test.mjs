import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture, write, repo, git } from './helpers.mjs';
import { makePlan, applyPlan } from '../src/planner.mjs';
import { HOSTS, normalizeHosts, selectedHosts, inspectAgentEntry, inspectHostEntries } from '../src/host.mjs';
import { digest, hash } from '../src/fs.mjs';
import { diagnose } from '../src/readiness.mjs';
import { classify } from '../src/policy.mjs';
import { lint } from '../src/lint.mjs';

const answers = { visibility: 'private', testCommands: { root: null } };
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const resign = plan => { const { digest: ignored, ...body } = plan; plan.digest = digest(body); return plan; };

test('all six hosts use native files and shared AGENTS is written only once', () => {
  const root = fixture(), plan = makePlan(root, { ...answers, hosts: Object.keys(HOSTS) });
  assert.equal(plan.files.filter(f => f.path === 'AGENTS.md').length, 1);
  assert.equal(applyPlan(root, plan).status, 'applied');
  for (const entry of inspectHostEntries(root).entries) {
    assert.equal(entry.status, 'configured'); assert.equal(entry.loaded, 'not-confirmed');
  }
  assert.ok(read(root, HOSTS.cursor.file).startsWith('---\nalwaysApply: true\n---\n'));
  assert.deepEqual(applyPlan(root, makePlan(root, answers)).changed, []);
});

test('explicit host-only init and doctor do not require Codex and later init accumulates selections', () => {
  const root = fixture();
  applyPlan(root, makePlan(root, { ...answers, hosts: ['claude'] }));
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.deepEqual(selectedHosts(root), ['claude']);
  assert.equal(diagnose(root).checks.find(c => c.id === 'agent-entry').status, 'passed');
  const next = makePlan(root, { ...answers, hosts: ['gemini', 'claude'] });
  assert.deepEqual(next.hosts, ['claude', 'gemini']); applyPlan(root, next);
  assert.deepEqual(selectedHosts(root), ['claude', 'gemini']);
});

test('legacy managed state preserves Codex and host aliases validate without guessing', () => {
  const root = fixture();
  assert.deepEqual(selectedHosts(root), ['codex']);
  assert.deepEqual(selectedHosts(root, ['gemini']), ['gemini']);
  applyPlan(root, makePlan(root, answers));
  const state = JSON.parse(read(root, '.harness/managed.json')); delete state.hosts;
  write(root, '.harness/managed.json', state);
  assert.deepEqual(selectedHosts(root, ['claude-code']), ['codex', 'claude']);
  assert.deepEqual(normalizeHosts([' Claude-Code ', 'CLAUDE', 'gemini-cli', 'open-code']), ['claude', 'gemini', 'opencode']);
  assert.deepEqual(normalizeHosts([' DSH ', 'deepseek-harness']), ['dsh']);
  for (const value of [[], ['unknown-host'], ['toString'], [3], 'claude']) assert.throws(() => normalizeHosts(value));
});

test('DSH shares AGENTS, preserves local overlays and does not inherit Codex override semantics', () => {
  const prefix='# Existing project instructions\r\nKeep team conventions.\r\n';
  const overlays={'AGENTS.override.md':'Codex-only override','AGENTS.local.md':'Local DSH guidance','CLAUDE.md':'Other applicable instructions','CLAUDE.local.md':'Local overlay'};
  const root=fixture({'AGENTS.md':prefix,...overlays});
  applyPlan(root,makePlan(root,{...answers,hosts:['deepseek-harness']}));
  assert.deepEqual(selectedHosts(root),['dsh']);
  assert.ok(read(root,'AGENTS.md').startsWith(prefix));
  for(const [file,content] of Object.entries(overlays))assert.equal(read(root,file),content);
  const entry=inspectAgentEntry(root,'dsh');
  assert.equal(entry.status,'configured');assert.equal(entry.loaded,'not-confirmed');
  assert.match(entry.notice,/agent-instructions/);
  assert.equal(inspectAgentEntry(root,'codex').status,'overridden');
  assert.equal(diagnose(root).checks.find(c=>c.entry?.host==='dsh').status,'passed');
  assert.equal(fs.existsSync(path.join(root,'.dsh')),false);
  assert.deepEqual(applyPlan(root,makePlan(root,{...answers,hosts:['codex','opencode']})).changed,[]);
  assert.deepEqual(selectedHosts(root),['dsh','codex','opencode']);
  const edited=read(root,'AGENTS.md').replace('harness doctor','team doctor');write(root,'AGENTS.md',edited);
  assert.deepEqual(applyPlan(root,makePlan(root,answers)).conflicts,['AGENTS.md']);
  assert.equal(read(root,'AGENTS.md'),edited);
});

test('all additional host files preserve user text, CRLF, and modified blocks', () => {
  for (const host of ['claude', 'gemini', 'cursor']) {
    const file = HOSTS[host].file, prefix = (host === 'cursor' ? '---\r\nalwaysApply: true\r\ndescription: Team rules\r\n---\r\n' : '') + '# Team instructions\r\nKeep stable APIs.\r\n';
    const root = fixture({ [file]: prefix });
    applyPlan(root, makePlan(root, { ...answers, hosts: [host] }));
    assert.ok(read(root, file).startsWith(prefix));
    write(root, file, read(root, file) + '\r\nUser footer\r\n');
    assert.equal(makePlan(root, answers).files.find(f => f.path === file).action, 'unchanged');
    const edited = read(root, file).replace('harness doctor', 'custom doctor'); write(root, file, edited);
    assert.ok(applyPlan(root, makePlan(root, answers)).conflicts.includes(file));
    assert.equal(read(root, file), edited);
  }
});

test('Cursor invalid or manual frontmatter is preserved as a conflict', () => {
  const file = HOSTS.cursor.file;
  for (const content of ['# Existing manual rule\n', '---\nalwaysApply: false\n---\n# Scoped rule\n', '---\nalwaysApply: [\n---\n', '---\nalwaysApply: true\nalwaysApply: false\n---\n']) {
    const root = fixture({ [file]: content }), plan = makePlan(root, { ...answers, hosts: ['cursor'] });
    assert.equal(plan.files.find(f => f.path === file).action, 'conflict');
    applyPlan(root, plan); assert.equal(read(root, file), content);
    assert.equal(inspectAgentEntry(root, 'cursor').status, 'conflict');
  }
});

test('Cursor header changes invalidate diagnosis and cannot bypass plan preflight', () => {
  const root = fixture(), file = HOSTS.cursor.file;
  const plan = makePlan(root, { ...answers, hosts: ['cursor'] });
  const entry = plan.files.find(f => f.path === file);
  entry.content = entry.content.replace('alwaysApply: true', 'alwaysApply: false'); entry.after = hash(entry.content); resign(plan);
  assert.throws(() => applyPlan(root, plan), /Invalid Cursor frontmatter/);
  assert.equal(fs.existsSync(path.join(root, 'harness.config.json')), false);
  applyPlan(root, makePlan(root, { ...answers, hosts: ['cursor'] }));
  const edited = read(root, file).replace('alwaysApply: true', 'alwaysApply: false'); write(root, file, edited);
  assert.equal(inspectAgentEntry(root, 'cursor').status, 'conflict');
  assert.equal(makePlan(root, answers).files.find(f => f.path === file).action, 'conflict');
});

test('host selection and matching file integrity are validated before writes', () => {
  const root = fixture(), plan = makePlan(root, { ...answers, hosts: ['claude'] });
  plan.hosts = ['gemini']; resign(plan);
  assert.throws(() => applyPlan(root, plan), /host entries/);
  assert.equal(fs.existsSync(path.join(root, 'harness.config.json')), false);
  applyPlan(root, makePlan(root, { ...answers, hosts: ['claude', 'gemini'] }));
  const fresh = makePlan(root, answers); fresh.hosts = ['claude']; resign(fresh);
  assert.throws(() => applyPlan(root, fresh), /host selection/);
});

test('additional host entry changes after planning abort all writes', () => {
  const root = fixture(), plan = makePlan(root, { ...answers, hosts: ['gemini'] });
  write(root, 'GEMINI.md', '# Concurrent user edit\n');
  assert.throws(() => applyPlan(root, plan), /Stale plan: GEMINI.md/);
  assert.equal(fs.existsSync(path.join(root, 'harness.config.json')), false);
});

test('Codex override does not override the OpenCode entry sharing AGENTS', () => {
  const root = fixture({ 'AGENTS.override.md': '# Codex only\n' });
  applyPlan(root, makePlan(root, { ...answers, hosts: ['opencode'] }));
  assert.equal(inspectAgentEntry(root, 'codex').status, 'overridden');
  assert.equal(inspectAgentEntry(root, 'opencode').status, 'configured');
  assert.equal(diagnose(root).checks.find(c => c.id === 'agent-entry').status, 'passed');
});

test('initialization never makes preexisting private host instructions public', () => {
  const root = fixture({ 'CLAUDE.md': '# Internal deployment details\n', 'GEMINI.md': '# Private service architecture\n' });
  applyPlan(root, makePlan(root, { ...answers, hosts: ['claude', 'gemini'] }));
  const config = JSON.parse(read(root, 'harness.config.json'));
  for (const file of ['CLAUDE.md', 'GEMINI.md']) assert.notEqual(classify(config, file).audience, 'public');
  const checks=diagnose(root).checks.filter(check=>check.entry);
  assert.ok(checks.every(check=>check.status==='passed'&&check.publicationReview===true&&check.message.includes('资料分类')));
});

test('new generic host files can be staged in public projects while existing and explicit policies stay private', () => {
  const root = repo(), hosts = ['claude', 'gemini', 'cursor'];
  applyPlan(root, makePlan(root, { ...answers, visibility: 'public', hosts }));
  const config = JSON.parse(read(root, 'harness.config.json'));
  for (const id of hosts) { assert.equal(classify(config, HOSTS[id].file).audience, 'public'); git(root, 'add', HOSTS[id].file); }
  assert.equal(lint(root, config).exitCode, 0);
  const existing = fixture({ 'harness.config.json': config });
  const plan = makePlan(existing, { ...answers, hosts: ['codex', 'opencode'] });
  const preserved = JSON.parse(plan.files.find(f => f.path === 'harness.config.json').content);
  assert.deepEqual(preserved.documents.publicPatterns, config.documents.publicPatterns);
  const custom = structuredClone(config); custom.documents.publicPatterns = ['README.md'];
  const explicit = makePlan(fixture(), { config: custom, hosts: ['gemini'] });
  assert.deepEqual(JSON.parse(explicit.files.find(f => f.path === 'harness.config.json').content).documents.publicPatterns, ['README.md']);
});

test('valid user Cursor frontmatter edits remain intact and scoped changes require review', () => {
  const root = fixture(), file = HOSTS.cursor.file;
  applyPlan(root, makePlan(root, { ...answers, hosts: ['cursor'] }));
  const edited = read(root, file).replace('alwaysApply: true', 'description: Updated team guidance\nglobs: "src/**"\nalwaysApply: true'); write(root, file, edited);
  assert.equal(makePlan(root, answers).files.find(f => f.path === file).action, 'unchanged');
  assert.equal(inspectAgentEntry(root, 'cursor').status, 'configured');
  applyPlan(root, makePlan(root, answers)); assert.equal(read(root, file), edited);
});
