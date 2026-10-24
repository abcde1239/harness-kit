import fs from 'node:fs';
import { inspect } from './discovery.mjs';
import { CONFIG, validateConfig } from './config.mjs';
import { atomicWrite, digest, fileHash, hash, json, readJson, safePath } from './fs.mjs';
import { managedPaths, directories, readme, structure, guide, gitignore } from './templates.mjs';

const STATE = '.harness/managed.json';
export function makePlan(root, answers = {}) {
  const scan = inspect(root);
  let config = structuredClone(scan.suggestedConfig);
  const allowed = ['visibility','managers','testCommands','config','acknowledge'];
  for (const k of Object.keys(answers)) if (!allowed.includes(k)) throw new Error(`Unknown answers field: ${k}`);
  if (answers.config) config = answers.config;
  if (answers.visibility) config.repository = { visibility: answers.visibility };
  for (const [workspace, argv] of Object.entries(answers.testCommands ?? {})) {
    config.tasks = config.tasks.filter(t => !(t.workspace === workspace && t.kind === 'test'));
    if (argv !== null) config.tasks.push({ id: `${workspace}:test`, workspace, kind: 'test', argv });
  }
  if (answers.managers) for (const w of config.workspaces) {
    const manager = answers.managers[w.id]; if (!manager) continue;
    if (!['pnpm','bun','npm','yarn'].includes(manager)) throw new Error(`Unsupported manager suggestion: ${manager}; use config.tasks for custom argv`);
    const pkgPath = w.root === '.' ? 'package.json' : `${w.root}/package.json`;
    if (fs.existsSync(safePath(root, pkgPath))) {
      const pkg = readJson(root, pkgPath);
      for (const [name,kind] of [['test','test'],['lint','lint'],['typecheck','typecheck'],['harness-lint','lint']]) if (pkg.scripts?.[name] && !config.tasks.some(t => t.id === `${w.id}:${name}`) && !(kind === 'test' && Object.hasOwn(answers.testCommands ?? {}, w.id))) {
        if (/no test specified|--recursive|(?:^|\s)-r(?:\s|$)|--workspaces|turbo\s|nx\s|--filter|harness.*\s(?:verify|lint)/.test(pkg.scripts[name])) continue;
        config.tasks.push({ id: `${w.id}:${name}`, workspace: w.id, kind, argv: [manager,'run',name] });
      }
    }
  }
  config = validateConfig(config, root);
  const unanswered = scan.questions.filter(q => {
    if (q.type === 'visibility') return config.repository.visibility === 'unknown' && !Object.hasOwn(answers,'visibility') && !answers.config;
    if (q.type === 'manager') return !answers.managers?.[q.workspace] && !answers.config;
    if (q.type === 'test-command') return !config.tasks.some(t => t.workspace === q.workspace && t.kind === 'test') && !Object.hasOwn(answers.testCommands ?? {}, q.workspace) && !answers.config;
    return !(answers.acknowledge ?? []).includes(q.id) && !answers.config;
  });
  const previous = fs.existsSync(safePath(root, STATE)) ? readJson(root, STATE) : { files: {} };
  const contents = { [CONFIG]: json(config), 'docs/agent_guide.md': guide, 'docs/structure.md': structure, '.gitignore': gitignore(config.repository.visibility) };
  // An existing project introduction is never replaced with a generic template.
  if (fileHash(root,'README.md') === null || previous.files?.['README.md']) contents['README.md'] = readme;
  const files = Object.entries(contents).map(([name, content]) => {
    const before = fileHash(root, name), after = hash(content);
    // Explicit config is user-owned: adapt by proposal, never silently rewrite it.
    const action = before === after ? 'unchanged' : before === null ? 'create' : previous.files?.[name] === before ? 'update' : 'conflict';
    return { path: name, before, after, action, content };
  });
  const plan = { version: 1, root: fs.realpathSync(root), files, directories, stateBefore: fileHash(root, STATE), unanswered, facts: scan.facts };
  return { ...plan, digest: digest(plan) };
}
export function applyPlan(root, plan) {
  const { digest: expected, ...body } = plan;
  if (plan.version !== 1 || digest(body) !== expected || fs.realpathSync(root) !== plan.root) throw new Error('Invalid, altered or wrong-root plan');
  if (plan.files.some(f => !managedPaths.includes(f.path) || !['create','update','unchanged','conflict'].includes(f.action)) || new Set(plan.files.map(f=>f.path)).size !== plan.files.length) throw new Error('Plan contains unsupported managed files');
  if (plan.directories.some(p=>!directories.includes(p) && p!=='docs/public')) throw new Error('Plan contains unsupported directories');
  if (plan.unanswered.length) throw new Error('Resolve plan.unanswered using answers before apply');
  if (fileHash(root, STATE) !== plan.stateBefore) throw new Error('Managed state changed since plan');
  for (const dir of plan.directories) safePath(root, dir);
  for (const f of plan.files) {
    if (f.action === 'conflict') continue; // Preserve unowned/user-modified files and surface them in result.
    if (fileHash(root, f.path) !== f.before || hash(f.content) !== f.after) throw new Error(`Stale plan: ${f.path}`);
    if (f.path === CONFIG) validateConfig(JSON.parse(f.content), root);
  }
  const changed = [], backups = [], previous = plan.stateBefore ? readJson(root, STATE) : { files: {} };
  const state = { version: 1, files: { ...previous.files } };
  try {
    for (const f of plan.files) {
      if (f.action === 'conflict') continue;
      state.files[f.path] = f.after;
      if (f.action === 'unchanged') continue;
      backups.push({ path: f.path, before: f.before === null ? null : fs.readFileSync(safePath(root, f.path)), written: f.after });
      atomicWrite(root, f.path, f.content); changed.push(f.path);
    }
    for (const dir of plan.directories) fs.mkdirSync(safePath(root, dir), { recursive: true });
    const content = json(state);
    if (fileHash(root, STATE) !== hash(content)) atomicWrite(root, STATE, content);
  } catch (error) {
    for (const b of backups.reverse()) if (fileHash(root, b.path) === b.written) {
      if (b.before === null) fs.unlinkSync(safePath(root, b.path)); else atomicWrite(root, b.path, b.before);
    }
    throw error;
  }
  const conflicts = plan.files.filter(f => f.action === 'conflict').map(f => f.path);
  return { status: conflicts.length ? 'conflicts' : 'applied', exitCode: conflicts.length ? 1 : 0, changed, conflicts };
}
