import fs from 'node:fs';
import path from 'node:path';
import { walk, matches, under, safePath } from './fs.mjs';
import { effectiveTests } from './config.mjs';
import { finding, report } from './report.mjs';
import { taskOrder } from './runner.mjs';
import { auditIndex } from './git.mjs';

export function applyBaseline(findings, baseline) {
  return findings.map(f => !f.protected && baseline.includes(f.fingerprint) ? { ...f, severity: 'warning', baseline: true } : f);
}
export function lint(root, config, { useBaseline = true } = {}) {
  const findings = [], entries = walk(root,{ignore:['.git','node_modules','.harness']}), files = entries.filter(e => e.type === 'file').map(e => e.path);
  const add = (rule, name, message, workspace = 'root', detail) => {
    const severity = config.rules[rule] ?? 'error';
    if (severity !== 'off') findings.push(finding(rule,name,message,{ severity, workspace, detail }));
  };
  try { taskOrder(config.tasks); } catch (error) { add('tasks.graph', 'harness.config.json', error.message, 'root', error.message); }
  const workspaceResults = [];
  for (const w of config.workspaces) {
    const policy = effectiveTests(config,w);
    const tasks = config.tasks.filter(t => t.kind === 'test' && t.covers.includes(w.id));
    workspaceResults.push({ id: w.id, tests: tasks.length ? 'configured' : 'not-configured', source: w.tests ? `workspaces.${w.id}.tests (inherits root)` : 'tests (root)' });
    if (!tasks.length && policy.requireConfiguredTask) add('tests.configured', w.root, 'Required test task is not configured', w.id);
    for (const file of files.filter(f => under(f,w.root))) {
      const owners = config.workspaces.filter(other => other.root !== w.root && under(other.root,w.root) && under(file,other.root));
      if (owners.length) continue;
      const local = w.root === '.' ? file : file.slice(w.root.length+1);
      if (policy.exclude.some(p => matches(local,p))) continue;
      const looksLikeTest = /(?:\.test\.[^/]+|\.spec\.[^/]+|_test\.go)$/.test(local);
      if (looksLikeTest && policy.artifacts.some(p => under(local,p))) add('tests.artifacts',file,'Test code is inside an artifact directory',w.id);
      else if (looksLikeTest && policy.include.length && !policy.include.some(p => matches(local,p))) add('tests.layout',file,'Test is outside the configured framework discovery paths',w.id);
    }
  }
  for (const file of files.filter(f => f.startsWith('docs/verification/') && f.endsWith('.md'))) {
    const text = fs.readFileSync(safePath(root,file),'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g,'');
      if (/^[a-z][a-z0-9+.-]*:|^#|^\/\//i.test(link)) continue;
      try {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(link.split('#')[0])));
        if (!fs.existsSync(safePath(root,target))) add('documents.links',file,`Missing verification link: ${target}`,'root',target);
      } catch { add('documents.links',file,'Unsafe verification link','root',link); }
    }
  }
  if (config.repository.visibility === 'public') findings.push(...auditIndex(root, config).findings);
  const applied = useBaseline ? applyBaseline(findings,config.baseline) : findings;
  return report(applied, { workspaces: workspaceResults, baselineAccepted: applied.filter(f => f.baseline).length });
}
