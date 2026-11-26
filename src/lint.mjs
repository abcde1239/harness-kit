import fs from 'node:fs';
import path from 'node:path';
import { walk, matches, under, safePath } from './fs.mjs';
import { effectiveTests } from './config.mjs';
import { finding, report } from './report.mjs';
import { taskOrder } from './runner.mjs';
import { auditIndex } from './git.mjs';
import { checkArtifactLayout, RUNS } from './artifacts.mjs';
import { checkHarnessStorage } from './storage.mjs';

const designFiles = /\.(?:fig|sketch|xd|pen|psd|bmpr)$/i;
const reviewFormats = /\.(?:avif|gif|jpe?g|png|svg|webp|pdf|html?|mp4|webm|zip|pptx?)$/i;
const draftName = /(?:^|[^a-z0-9])(?:mockups?|wireframes?|prototypes?|screenshots?|screen[-_ ]?captures?|design[-_ ](?:drafts?|exports?))(?:$|[^a-z])/i;
const draftNameChinese = /设计[草初终]?稿|原型稿|线框稿|截图|效果图/;
const draftDirectory = /(?:^|\/)(?:designs?|设计)(?:\/)/i;
const siteOutput = /(?:^|\/)\.vitepress\/(?:cache|dist)(?:\/)/;

function checkDocumentArtifacts(files, config, add) {
  const roots = new Map([['docs', 'root']]);
  const allowed = new Set(config.documents.artifactAllowlist);
  for (const workspace of config.workspaces) {
    const prefix = workspace.root === '.' ? '' : workspace.root + '/';
    roots.set(prefix + 'docs', workspace.id);
    for (const file of workspace.documents?.artifactAllowlist ?? []) allowed.add(prefix + file);
  }
  const documentRoots = [...roots.keys()].sort((a, b) => b.length - a.length);
  for (const file of files) {
    const documentRoot = documentRoots.find(root => file.startsWith(root + '/'));
    if (!documentRoot || allowed.has(file) || siteOutput.test(file)) continue;
    const local = file.slice(documentRoot.length + 1);
    const isDraft = draftName.test(local) || draftNameChinese.test(local);
    if (designFiles.test(local) ||
        (reviewFormats.test(local) && (isDraft || draftDirectory.test(local))) ||
        (/\.mdx?$/i.test(local) && isDraft)) {
      add('documents.artifacts', file, 'Use a managed artifact run for design drafts, prototypes, and captures. For a maintained documentation file, allowlist its exact path in documents.artifactAllowlist.', roots.get(documentRoot));
    }
  }
}

function checkDocumentLayout(files, config, add) {
  const scopes = [
    { id: 'root', root: '.', rules: config.documents.layout },
    ...config.workspaces.map(workspace => ({
      id: workspace.id, root: workspace.root, rules: workspace.documents?.layout,
    })),
  ];
  for (const scope of scopes) {
    for (const rule of scope.rules ?? []) {
      for (const file of files) {
        if (!under(file, scope.root)) continue;
        const local = scope.root === '.' ? file : file.slice(scope.root.length + 1);
        if (!rule.match.some(pattern => matches(local, pattern)) ||
            rule.exclude?.some(pattern => matches(local, pattern)) ||
            rule.allow.some(pattern => matches(local, pattern))) continue;
        add('documents.layout', file,
          `Document layout rule ${rule.id} expects: ${rule.allow.join(', ')}`,
          scope.id, { id: rule.id, root: scope.root, allow: rule.allow });
      }
    }
  }
}

export function applyBaseline(findings, baseline) {
  return findings.map(f => !f.protected && baseline.includes(f.fingerprint) ? { ...f, severity: 'warning', baseline: true } : f);
}
export function lint(root, config, { useBaseline = true } = {}) {
  const findings = [], entries = walk(root,{ignore:['.git','node_modules','.harness']}), files = entries.filter(e => e.type === 'file').map(e => e.path);
  const add = (rule, name, message, workspace = 'root', detail) => {
    const severity = config.rules[rule] ?? (rule === 'artifacts.layout' ? 'warning' : 'error');
    if (severity !== 'off') findings.push(finding(rule,name,message,{ severity, workspace, detail }));
  };
  checkHarnessStorage(root, config, add);
  checkArtifactLayout(root, add);
  checkDocumentArtifacts(files, config, add);
  if (config.rules['documents.layout'] !== 'off') checkDocumentLayout(files, config, add);
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
      const looksLikeTest = policy.detect.some(pattern => matches(local,pattern));
      if (looksLikeTest && under(file, RUNS)) {
        add('tests.artifacts',file,'Keep executable tests in their framework discovery paths',w.id);
        continue;
      }
      if (policy.exclude.some(p => matches(local,p))) continue;
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
