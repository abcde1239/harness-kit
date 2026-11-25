import { test } from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config, fixture, git, repo, write } from './helpers.mjs';
import { cleanArtifactRuns, createArtifactRun, updateArtifactRun } from '../src/artifacts.mjs';
import { lint } from '../src/lint.mjs';
import { classify } from '../src/policy.mjs';
import { inputSnapshot } from '../src/workflow.mjs';

const old = new Date('2020-01-01T00:00:00Z');
function finished(root, label) {
  const run = createArtifactRun(root, label);
  const record = updateArtifactRun(root, run.id, 'finish').record;
  write(root, `${run.path}/report.txt`, 'evidence');
  write(root, `${run.path}/run.json`, { ...record, createdAt: old.toISOString(), finishedAt: old.toISOString() });
  for (const name of [run.path, `${run.path}/report.txt`, `${run.path}/run.json`]) fs.utimesSync(path.join(root, name), old, old);
  return run;
}

test('cleanup applies only to expired, completed and unreferenced managed runs', () => {
  const root = fixture({ 'artifacts/releases/v1/archive.zip': 'deliverable', 'artifacts/archive/old/report.log': 'historical output', 'artifacts/runs/imported/report.log': 'legacy output' });
  const expired = finished(root, 'expired');
  const updated = finished(root, 'resumed-writer');
  write(root, `${updated.path}/report.txt`, 'fresh output');
  const kept = finished(root, 'kept');
  updateArtifactRun(root, kept.id, 'keep');
  const referenced = finished(root, 'referenced');
  write(root, '.harness/tasks/checkout.json', { evidence: `${referenced.path}/report.txt` });
  const active = createArtifactRun(root, 'active');
  const settings = { retentionDays: 14 };
  const preview = cleanArtifactRuns(root, settings);
  assert.equal(preview.status, 'preview');
  assert.deepEqual(Object.fromEntries(preview.items.map(item => [item.id, item.status])), {
    [expired.id]: 'expired', [updated.id]: 'recent', [kept.id]: 'kept', [referenced.id]: 'referenced', [active.id]: 'active', imported: 'unmanaged'
  });
  assert.ok(fs.existsSync(path.join(root, expired.path)));
  assert.deepEqual(cleanArtifactRuns(root, settings, { apply: true }).items.filter(item => item.status === 'removed').map(item => item.id), [expired.id]);
  assert.ok(!fs.existsSync(path.join(root, expired.path)));
  for (const location of [updated.path, kept.path, referenced.path, active.path, 'artifacts/runs/imported', 'artifacts/releases/v1/archive.zip', 'artifacts/archive/old/report.log', '.harness/tasks/checkout.json']) assert.ok(fs.existsSync(path.join(root, location)));
  assert.equal(updateArtifactRun(root, kept.id, 'release').record.keep, false);
});

test('cleanup protects indexed paths, Git metadata and links, including inside a parent checkout', () => {
  const parent = repo({ 'project/.gitignore': '/artifacts/\n' });
  const root = path.join(parent, 'project');
  const indexed = finished(root, 'indexed');
  git(parent, 'add', '-f', `project/${indexed.path}/report.txt`);
  const nestedGit = finished(root, 'nested-git');
  fs.mkdirSync(path.join(root, nestedGit.path, '.git'));
  const linked = finished(root, 'linked');
  const outside = fixture({ 'sentinel.txt': 'preserve' });
  fs.symlinkSync(outside, path.join(root, linked.path, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const candidate = finished(root, 'valid');
  const cleaned = cleanArtifactRuns(root, { retentionDays: 14 }, { apply: true });
  assert.equal(cleaned.exitCode, 0);
  assert.deepEqual(Object.fromEntries(cleaned.items.map(item => [item.id, item.status])), {
    [indexed.id]: 'protected', [nestedGit.id]: 'protected', [linked.id]: 'protected', [candidate.id]: 'removed'
  });
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'preserve');
});

test('reserved state and managed test placement are checked independently from artifact exclusions', () => {
  const root = fixture({
    '.harness/managed.json': {}, '.harness/hooks/runtime.mjs': '', '.harness/tmp/config-plan.json': {},
    '.harness/src/retry.ts': '', 'artifacts/adhoc.log': '', 'artifacts/releases/v1/copied.test.mjs': '', 'artifacts/archive/old/output.log': ''
  });
  const run = createArtifactRun(root, 'checkout');
  write(root, `${run.path}/misplaced.test.mjs`, '');
  const settings = config(root, { tests: { artifacts: [], exclude: ['artifacts/**'] }, documents: { internalRoots: [], publicRoots: ['.'] } });
  const findings = lint(root, settings).findings;
  assert.match(findings.find(item => item.ruleId === 'artifacts.layout').message, /Found 1 uncategorized entries \(adhoc\.log\)/);
  assert.deepEqual(findings.map(({ ruleId, severity, path }) => [ruleId, severity, path]), [
    ['storage.state', 'error', '.harness/src/retry.ts'], ['artifacts.layout', 'warning', 'artifacts'], ['tests.artifacts', 'error', `${run.path}/misplaced.test.mjs`]
  ]);
  assert.equal(classify(settings, `${run.path}/misplaced.test.mjs`).audience, 'internal');
  assert.equal(classify(settings, '.harness/managed.json').audience, 'internal');
  const before = inputSnapshot(root, settings).digest;
  write(root, `${run.path}/report.json`, {});
  assert.equal(inputSnapshot(root, settings).digest, before);
  assert.throws(() => config(root, { artifacts: { retentionDays: 0 } }), /retentionDays/);
});
