import fs from 'node:fs';
import { walk, safePath } from './fs.mjs';
import { defaults, loadConfig, CONFIG } from './config.mjs';
import { discoverJavascript } from './adapters/javascript.mjs';
import { discoverGo } from './adapters/go.mjs';

export function inspect(root) {
  const entries = walk(root), files = entries.filter(e => e.type === 'file').map(e => e.path);
  if (fs.existsSync(safePath(root, CONFIG))) {
    const config = loadConfig(root);
    return { facts: [{ source: CONFIG, capability: 'explicit-config' }], questions: config.repository.visibility === 'unknown' ? [visibilityQuestion] : [], suggestedConfig: config, files };
  }
  const config = defaults(), facts = [], questions = [visibilityQuestion], ws = new Map();
  for (const adapter of [discoverJavascript, discoverGo]) {
    const found = adapter(root, files); facts.push(...found.facts); questions.push(...found.questions); config.tasks.push(...found.tasks);
    for (const w of found.workspaces) {
      const previous = ws.get(w.root);
      if (!previous) ws.set(w.root, w);
      else {
        // An adapter without include restrictions must remain unrestricted when
        // another stack shares its directory; discovery cannot guess its layout.
        const includes = [previous.tests?.include, w.tests?.include];
        const include = includes.every(patterns => patterns?.length) ? [...new Set(includes.flat())] : [];
        ws.set(w.root, { ...previous, tests: { ...previous.tests, ...w.tests, include } });
      }
    }
  }
  config.workspaces = ws.size ? [...ws.values()] : defaults().workspaces;
  for (const w of config.workspaces) if (!config.tasks.some(t => t.workspace === w.id && t.kind === 'test')) questions.push({ id: `tests:${w.id}`, type: 'test-command', workspace: w.id, message: `Provide test argv for ${w.root}, or explicitly leave tests unconfigured` });
  for (const e of entries.filter(e => e.type !== 'file')) facts.push({ source: e.path, capability: 'unscanned-path', reason: e.type });
  if (files.includes('docs/agent_guide.md') && files.includes('scripts/verify.sh')) facts.push({ source: 'docs/agent_guide.md', capability: 'gen-new-compatible' });
  for (const file of files.filter(f => /(^|\/)harness[-.]lint\./.test(f))) facts.push({ source: file, capability: 'existing-lint-candidate', action: 'Declare argv explicitly; never executed during inspection' });
  return { facts, questions, suggestedConfig: config, files };
}
const visibilityQuestion = { id: 'visibility', type: 'visibility', message: 'Repository visibility: private, public, or unknown?' };
