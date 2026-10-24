import fs from 'node:fs';
import path from 'node:path';
import { safePath, matches } from '../fs.mjs';

export function discoverJavascript(root, files) {
  const facts = [], workspaces = [], tasks = [], questions = [], packages = [];
  for (const f of files.filter(f => f === 'package.json' || f.endsWith('/package.json'))) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(safePath(root, f), 'utf8')); }
    catch { questions.push({ id: `invalid:${f}`, message: `Repair invalid JSON: ${f}`, type: 'manual' }); continue; }
    packages.push({ file: f, root: path.posix.dirname(f), pkg });
  }
  const rootPackage = packages.find(p => p.root === '.');
  let patterns = rootPackage?.pkg.workspaces?.packages ?? rootPackage?.pkg.workspaces ?? [];
  if (!Array.isArray(patterns) || patterns.some(p => typeof p !== 'string')) {
    questions.push({ id: 'workspace-patterns', message: 'Provide explicit workspaces; unsupported workspace declaration', type: 'manual' }); patterns = [];
  }
  if (files.includes('pnpm-workspace.yaml')) {
    const yaml = fs.readFileSync(safePath(root, 'pnpm-workspace.yaml'), 'utf8');
    const section = /^packages:\s*(?:#.*)?\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m.exec(yaml);
    if (section) patterns = [...section[1].matchAll(/^\s+-\s+['"]?([^'"\r\n#]+)['"]?\s*(?:#.*)?$/gm)].map(m => m[1].trim());
    else questions.push({ id: 'workspace-patterns', message: 'Provide explicit workspaces; pnpm packages declaration could not be parsed', type: 'manual' });
  }
  for (const p of packages) {
    const wId = p.root === '.' ? 'root' : p.root.replace(/[^a-zA-Z0-9._-]/g, '-');
    const declared = p.root === '.' || (patterns.some(g => !g.startsWith('!') && matches(p.root, g)) && !patterns.some(g => g.startsWith('!') && matches(p.root, g.slice(1))));
    facts.push({ source: p.file, capability: 'javascript-package', declaredWorkspace: declared, testFrameworks: Object.keys({ ...p.pkg.dependencies, ...p.pkg.devDependencies }).filter(k => ['vitest','jest','@playwright/test'].includes(k)) });
    if (!declared && patterns.length) { questions.push({ id: `workspace:${wId}`, message: `${p.root} is not declared in root workspaces; include explicitly if needed`, type: 'manual' }); continue; }
    const managerHint = p.pkg.packageManager ?? rootPackage?.pkg.packageManager;
    const localLocks = ['pnpm-lock.yaml','bun.lock','bun.lockb','package-lock.json','yarn.lock'].filter(lock => files.includes(p.root === '.' ? lock : `${p.root}/${lock}`));
    const rootLocks = ['pnpm-lock.yaml','bun.lock','bun.lockb','package-lock.json','yarn.lock'].filter(lock => files.includes(lock));
    const locks = localLocks.length ? localLocks : rootLocks;
    const inferred = [...new Set(locks.map(f => f.startsWith('pnpm') ? 'pnpm' : f.startsWith('bun') ? 'bun' : f.startsWith('yarn') ? 'yarn' : 'npm'))];
    let manager = typeof managerHint === 'string' ? managerHint.split('@')[0] : inferred.length === 1 ? inferred[0] : null;
    if (inferred.length > 1) { manager = null; questions.push({ id: `manager:${wId}`, message: `Multiple package managers at ${p.root}; choose explicitly`, type: 'manager', workspace: wId }); }
    else if (!manager && Object.keys(p.pkg.scripts ?? {}).length) questions.push({ id: `manager:${wId}`, message: `Choose package manager for ${p.root}`, type: 'manager', workspace: wId });
    workspaces.push({ id: wId, root: p.root });
    const scripts = p.pkg.scripts ?? {};
    if (manager) for (const [script, kind] of [['test','test'],['lint','lint'],['typecheck','typecheck'],['harness-lint','lint']]) {
      if (typeof scripts[script] !== 'string' || /no test specified/i.test(scripts[script])) continue;
      // Root recursive aggregators are recorded for explicit selection, not mixed with child tasks.
      if (/--recursive|(?:^|\s)-r(?:\s|$)|--workspaces|turbo\s|nx\s|--filter/.test(scripts[script])) {
        questions.push({ id: `aggregate:${wId}:${script}`, message: `${p.file} ${script} appears to aggregate other workspaces; declare covers to avoid duplicate execution`, type: 'manual' }); continue;
      }
      if (/harness(?:-kit)?(?:\.mjs)?\s+(verify|lint)/.test(scripts[script])) continue;
      tasks.push({ id: `${wId}:${script}`, workspace: wId, kind, argv: [manager, 'run', script] });
    }
  }
  return { facts, workspaces, tasks, questions };
}
