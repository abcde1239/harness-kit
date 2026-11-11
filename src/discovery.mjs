import fs from 'node:fs';
import { walk, safePath, hash } from './fs.mjs';
import { defaults, loadConfig, CONFIG } from './config.mjs';
import { discoverAdapters } from './adapters/registry.mjs';

function combine(recipes, explicit) {
  const ws = new Map(), ids = new Map();
  for (const w of explicit?.workspaces ?? []) { ws.set(w.root,structuredClone(w)); ids.set(w.id,w.root); }
  for (const recipe of recipes) for (const w of recipe.workspaces) {
    const previous = ws.get(w.root);
    if (!previous) {
      let id = w.id;
      if (ids.has(id) && ids.get(id) !== w.root) id = `${id}-${hash(w.root).slice(0,8)}`;
      if (ids.has(id) && ids.get(id) !== w.root) throw new Error(`Workspace ID collision: ${id}; declare explicit workspace IDs`);
      ws.set(w.root,{...w,id}); ids.set(id,w.root);
    } else if (!explicit?.workspaces.some(existing => existing.root === w.root)) {
      // A recipe without path restrictions must not narrow a co-located stack.
      const includes = [previous.tests?.include,w.tests?.include];
      const include = includes.every(p => p?.length) ? [...new Set(includes.flat())] : [];
      const detect = [...new Set([...(previous.tests?.detect ?? defaults().tests.detect),...(w.tests?.detect ?? defaults().tests.detect)])];
      ws.set(w.root,{...previous,tests:{...previous.tests,...w.tests,include,detect}});
    }
  }
  const tasks = [], questions = [], taskIds = new Set();
  for (const recipe of recipes) {
    const aliases = new Map(recipe.workspaces.map(w => [w.id,ws.get(w.root).id]));
    const rewrite = task => {
      const id = aliases.get(task.workspace) ?? task.workspace;
      return id !== task.workspace && task.id.startsWith(`${task.workspace}:`) ? id+task.id.slice(task.workspace.length) : task.id;
    };
    const taskAliases = new Map(recipe.tasks.map(t => [t.id,rewrite(t)]));
    for (const task of recipe.tasks) {
      const t = {...task,id:taskAliases.get(task.id),workspace:aliases.get(task.workspace) ?? task.workspace};
      if (task.covers) t.covers = task.covers.map(id => aliases.get(id) ?? id);
      if (task.dependsOn) t.dependsOn = task.dependsOn.map(id => taskAliases.get(id) ?? id);
      if (taskIds.has(t.id)) throw new Error(`Adapter task ID collision: ${t.id}; use distinct adapter task IDs`);
      taskIds.add(t.id); tasks.push(t);
    }
    for (const q of recipe.questions) {
      const workspace = aliases.get(q.workspace);
      questions.push(workspace && workspace !== q.workspace ? {...q,workspace,id:q.id.replace(`:${q.workspace}`,`:${workspace}`)} : q);
    }
  }
  return {workspaces:[...ws.values()],tasks,questions};
}

export function inspect(root, options = {}) {
  const entries = walk(root), files = entries.filter(e => e.type === 'file').map(e => e.path);
  const recipes = discoverAdapters(root,files,options);
  if (fs.existsSync(safePath(root, CONFIG))) {
    const config = loadConfig(root);
    // Discover drift without replacing an explicit, user-owned contract.
    const found = combine(recipes,config);
    const roots = new Set(config.workspaces.map(w=>w.root));
    const workspaces = found.workspaces.filter(w=>!roots.has(w.root));
    const tasks = found.tasks.filter(t=>!config.tasks.some(existing=>existing.id===t.id || (existing.workspace===t.workspace && existing.kind===t.kind)));
    const drift = { workspaces, tasks, questions: found.questions, notice:'Suggestions only; explicit configuration is unchanged.' };
    return { facts: [{ source: CONFIG, capability: 'explicit-config' }], questions: config.repository.visibility === 'unknown' ? [visibilityQuestion] : [], suggestedConfig: config, drift, files };
  }
  const config = defaults(), found = combine(recipes), facts = recipes.flatMap(r=>r.facts), questions = [visibilityQuestion,...found.questions];
  config.tasks = found.tasks;
  config.workspaces = found.workspaces.length ? found.workspaces : defaults().workspaces;
  for (const w of config.workspaces) if (!config.tasks.some(t => t.workspace === w.id && t.kind === 'test')) questions.push({ id: `tests:${w.id}`, type: 'test-command', workspace: w.id, message: `Provide test argv for ${w.root}, or explicitly leave tests unconfigured` });
  for (const e of entries.filter(e => e.type !== 'file')) facts.push({ source: e.path, capability: 'unscanned-path', reason: e.type });
  if (files.includes('docs/agent_guide.md') && files.includes('scripts/verify.sh')) facts.push({ source: 'docs/agent_guide.md', capability: 'gen-new-compatible' });
  for (const file of files.filter(f => /(^|\/)harness[-.]lint\./.test(f))) facts.push({ source: file, capability: 'existing-lint-candidate', action: 'Declare argv explicitly; never executed during inspection' });
  return { facts, questions, suggestedConfig: config, files };
}
const visibilityQuestion = { id: 'visibility', type: 'visibility', message: 'Repository visibility: private, public, or unknown?' };
