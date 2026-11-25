import fs from 'node:fs';
import path from 'node:path';
import { defaultTestPatterns } from './adapters/test-patterns.mjs';
import { matches, walk } from './fs.mjs';
import { HOOK_SESSIONS, isHookSessionFile } from './hook-state.mjs';

const STATE_FILES = new Set([
  'managed.json', 'answers.json', 'plan.json', 'verification.json', 'active-task.json',
  'tasks.lock', 'artifacts.lock', 'publication.json', 'review.json', 'hooks/state.json', 'hooks/runtime.mjs',
  'hooks/claude/state.json', 'hooks/claude/runtime.mjs',
  'hooks/dsh/state.json', 'hooks/dsh/runtime.mjs', 'hooks/dsh/hooks.json'
]);
const TEST_DIRECTORIES = /(?:^|\/)(?:tests?|specs?|fixtures?|__tests__|__fixtures__|__snapshots__)(?:\/|$)/i;
const TEST_DATA = /(?:^|\/)(?:tests?|specs?|fixtures?|snapshots?)\.json$|\.(?:fixture|snapshot)\.json$/i;

function validStateFile(name) {
  // Atomic writes can briefly expose <state file>.<uuid>.tmp to concurrent checks.
  const base = name.replace(/\.[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.tmp$/, '');
  const sessions = `${HOOK_SESSIONS.slice('.harness/'.length)}/`;
  return STATE_FILES.has(base) || /^tasks\/[a-z0-9][a-z0-9_-]{0,63}\.json$/.test(base) ||
    (base.startsWith(sessions) && isHookSessionFile(base.slice(sessions.length))) || /^tmp\/(?:[^/]+\/)*[^/]+\.json$/.test(base);
}

export function checkHarnessStorage(root, config, add) {
  const directory = path.join(root, '.harness');
  const state = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!state) return;
  if (!state.isDirectory()) {
    add('storage.state', '.harness', 'Expected an ordinary directory for Harness state');
    return;
  }
  const testPatterns = [...new Set([...defaultTestPatterns, ...config.tests.detect])];
  for (const entry of walk(directory, { ignore: [] })) {
    const location = `.harness/${entry.path}`;
    // Owned files and task IDs have their own naming rules. Test heuristics are
    // needed for the scratch area because it accepts user-chosen JSON names.
    if (entry.type === 'file' && entry.path.startsWith('tmp/') &&
        (TEST_DIRECTORIES.test(entry.path) || TEST_DATA.test(entry.path) || testPatterns.some(pattern => matches(entry.path, pattern) || matches(location, pattern)))) {
      add('storage.state', location, 'Move tests, fixtures and snapshots to the framework test directories');
    } else if (entry.type !== 'file' || !validStateFile(entry.path)) {
      add('storage.state', location, 'Keep Harness state here; move source, documents or outputs to their project directories');
    }
  }
}
