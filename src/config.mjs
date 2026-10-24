import fs from 'node:fs';
import { readJson, relativePath, safePath } from './fs.mjs';

export const CONFIG = 'harness.config.json';
const object = (v, label) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label} must be an object`); };
const keys = (v, allowed, label) => { object(v, label); for (const k of Object.keys(v)) if (!allowed.includes(k)) throw new Error(`Unknown ${label} field: ${k}`); };
const strings = (v, label) => { if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x)) throw new Error(`${label} must be a string array`); };
const bool = (v, label) => { if (typeof v !== 'boolean') throw new Error(`${label} must be boolean`); };
const enumValue = (v, choices, label) => { if (!choices.includes(v)) throw new Error(`Invalid ${label}: ${v}`); };
const id = v => { if (typeof v !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(v)) throw new Error(`Invalid id: ${v}`); };
function array(v, label) { if (!Array.isArray(v)) throw new Error(`${label} must be an array`); }
function paths(v, label, glob = false) { strings(v, label); for (let i=0;i<v.length;i++) v[i]=relativePath(v[i], { glob }); }
function documents(v) {
  keys(v, ['defaultAudience','publicRoots','internalRoots','publicPatterns','internalPatterns'], 'documents');
  if (v.defaultAudience !== undefined && v.defaultAudience !== 'internal') throw new Error('documents.defaultAudience must be internal');
  for (const k of ['publicRoots','internalRoots','publicPatterns','internalPatterns']) if (v[k] !== undefined) paths(v[k], `documents.${k}`, k.endsWith('Patterns'));
}
function tests(v) {
  keys(v, ['include','exclude','artifacts','requireConfiguredTask'], 'tests');
  for (const k of ['include','exclude']) if (v[k] !== undefined) paths(v[k], `tests.${k}`, true);
  if (v.artifacts !== undefined) paths(v.artifacts, 'tests.artifacts');
  if (v.requireConfiguredTask !== undefined) bool(v.requireConfiguredTask, 'requireConfiguredTask');
}
export function defaults() {
  return {
    schemaVersion: 1,
    repository: { visibility: 'unknown' },
    workspaces: [{ id: 'root', root: '.' }],
    documents: { defaultAudience: 'internal', publicRoots: ['docs/public'], internalRoots: ['docs/prd','docs/decision','docs/verification','.harness'], publicPatterns: ['README.md'], internalPatterns: ['docs/structure.md','docs/agent_guide.md','**/MEMORY.md','**/memory/**','**/memories/**','**/decision/**','**/decisions/**'] },
    tests: { include: [], exclude: [], artifacts: ['artifacts','coverage'], requireConfiguredTask: false },
    tasks: [], publicationTargets: [], rules: {}, baseline: []
  };
}
export function validateConfig(value, root) {
  keys(value, ['schemaVersion','repository','workspaces','documents','tests','tasks','publicationTargets','rules','baseline'], 'config');
  if (value.schemaVersion !== 1) throw new Error('Unsupported schemaVersion (expected 1)');
  const c = { ...defaults(), ...structuredClone(value) };
  documents(c.documents); tests(c.tests);
  c.documents = { ...defaults().documents, ...c.documents };
  c.tests = { ...defaults().tests, ...c.tests };
  keys(c.repository, ['visibility'], 'repository');
  enumValue(c.repository.visibility, ['private','public','unknown'], 'repository.visibility');
  documents(c.documents); tests(c.tests);
  array(c.workspaces, 'workspaces');
  if (!c.workspaces.length) throw new Error('At least one workspace is required');
  const ids = new Set(), roots = new Set();
  for (const w of c.workspaces) {
    keys(w, ['id','root','documents','tests'], 'workspace'); id(w.id); w.root=relativePath(w.root);
    if (ids.has(w.id) || roots.has(w.root.toLowerCase())) throw new Error(`Duplicate workspace: ${w.id}`);
    ids.add(w.id); roots.add(w.root.toLowerCase());
    if (root && !fs.statSync(safePath(root, w.root, { allowMissing: false })).isDirectory()) throw new Error(`Workspace is not a directory: ${w.root}`);
    if (w.documents) documents(w.documents);
    if (w.tests) tests(w.tests);
  }
  array(c.tasks, 'tasks'); const taskIds = new Set();
  for (const t of c.tasks) {
    keys(t, ['id','workspace','argv','cwd','dependsOn','kind','required','enabled','timeoutMs','covers'], 'task');
    id(t.id); if (taskIds.has(t.id)) throw new Error(`Duplicate task: ${t.id}`); taskIds.add(t.id);
    t.workspace ??= c.workspaces[0].id;
    if (!ids.has(t.workspace)) throw new Error(`Unknown workspace: ${t.workspace}`);
    strings(t.argv, 'task.argv'); if (!t.argv.length || t.argv.some(x => x.includes('\0'))) throw new Error('task.argv must contain a command');
    t.cwd ??= '.'; t.cwd=relativePath(t.cwd); t.dependsOn ??= []; strings(t.dependsOn, 'dependsOn');
    t.kind ??= 'test'; enumValue(t.kind, ['test','lint','typecheck','build','custom'], 'task.kind');
    t.required ??= true; t.enabled ??= true; bool(t.required, 'required'); bool(t.enabled, 'enabled');
    t.timeoutMs ??= 60000; if (!Number.isSafeInteger(t.timeoutMs) || t.timeoutMs < 1 || t.timeoutMs > 86400000) throw new Error('Invalid task.timeoutMs');
    t.covers ??= [t.workspace]; strings(t.covers, 'covers'); for (const w of t.covers) if (!ids.has(w)) throw new Error(`Unknown covers workspace: ${w}`);
  }
  for (const t of c.tasks) for (const d of t.dependsOn) if (!taskIds.has(d)) throw new Error(`Unknown dependency: ${d}`);
  array(c.publicationTargets, 'publicationTargets'); const targets = new Set();
  for (const p of c.publicationTargets) {
    keys(p, ['id','manifest'], 'publicationTarget'); id(p.id); relativePath(p.manifest);
    if (targets.has(p.id)) throw new Error(`Duplicate target: ${p.id}`); targets.add(p.id);
  }
  keys(c.rules, ['tests.layout','tests.configured','tests.artifacts','documents.links','tasks.graph'], 'rules');
  for (const [k,v] of Object.entries(c.rules)) enumValue(v, ['error','warning','off'], k);
  strings(c.baseline, 'baseline');
  return c;
}
export const loadConfig = root => validateConfig(readJson(root, CONFIG), root);
export function effectiveTests(c, w) { return { ...defaults().tests, ...c.tests, ...w.tests }; }
