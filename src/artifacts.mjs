import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, defaultIgnore, json, readJson, safePath, under, walk } from './fs.mjs';
import { trackedPaths } from './git.mjs';

export const RUNS = 'artifacts/runs';
const LOCK = '.harness/artifacts.lock';
const DAY = 86_400_000;
const CATEGORIES = ['runs', 'releases', 'distribution', 'skill', 'snapshots', 'archive'];
const LABEL = /^[a-z0-9][a-z0-9-]{0,47}$/;
const RUN_ID = /^\d{8}-[a-z0-9][a-z0-9-]{0,47}-[0-9a-f]{8}$/;
const RUN_REFERENCE = new RegExp('(?:^|[^a-z0-9_.-])artifacts/runs/(' + RUN_ID.source.slice(1, -1) + ')(?![a-z0-9_-])', 'gi');
const DOCUMENT = /\.(?:mdx?|html?)$/i;
const README = /^readme(?:[.-].+)?\.mdx?$/i;

function stat(target) {
  return fs.lstatSync(target, { throwIfNoEntry: false });
}
function children(directory) {
  const info = stat(directory);
  if (!info) return [];
  if (!info.isDirectory()) throw new Error(`Expected an ordinary directory: ${directory}`);
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}
function runPath(id) {
  if (typeof id !== 'string' || !RUN_ID.test(id)) throw new Error('Expected a run ID returned by harness artifacts create');
  return `${RUNS}/${id}`;
}
function readRun(root, id) {
  const name = `${runPath(id)}/run.json`;
  if (!stat(safePath(root, name))?.isFile()) throw new Error('Missing artifact run record');
  const record = readJson(root, name);
  if (record?.version !== 1 || record.id !== id || !Number.isFinite(Date.parse(record.createdAt)) ||
      (record.finishedAt !== null && !(Date.parse(record.finishedAt) >= Date.parse(record.createdAt))) ||
      typeof record.keep !== 'boolean') throw new Error('Invalid artifact run record');
  return record;
}
function mutate(root, operation) {
  const lock = safePath(root, LOCK);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Artifact state is locked (.harness/artifacts.lock); retry after the writer exits');
    throw error;
  }
  try { return operation(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

export function createArtifactRun(root, label) {
  if (typeof label !== 'string' || !LABEL.test(label)) throw new Error('Use a short lowercase artifact label, e.g. checkout-e2e');
  return mutate(root, () => {
    const createdAt = new Date().toISOString();
    const id = `${createdAt.slice(0, 10).replaceAll('-', '')}-${label}-${randomUUID().slice(0, 8)}`;
    const location = runPath(id);
    const directory = safePath(root, location);
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    fs.mkdirSync(directory);
    const record = { version: 1, id, createdAt, finishedAt: null, keep: false };
    atomicWrite(root, `${location}/run.json`, json(record));
    return { status: 'created', id, path: location, record };
  });
}

export function updateArtifactRun(root, id, action) {
  const location = runPath(id);
  return mutate(root, () => {
    const record = readRun(root, id);
    if (action === 'finish' && !record.finishedAt) {
      record.finishedAt = new Date().toISOString();
      atomicWrite(root, `${location}/run.json`, json(record));
    } else if (action !== 'finish' && record.keep !== (action === 'keep')) {
      record.keep = action === 'keep';
      atomicWrite(root, `${location}/run.json`, json(record));
    }
    return { status: action === 'finish' ? 'finished' : action === 'keep' ? 'kept' : 'released', id, path: location, record };
  });
}

// Use the newest payload timestamp as well as the completion record. A later
// report write gives the entire run a fresh retention window.
function runInventory(directory) {
  let latest = 0;
  let bytes = 0;
  function visit(target, info) {
    latest = Math.max(latest, info.mtimeMs);
    if (info.isFile()) { bytes += info.size; return; }
    if (!info.isDirectory()) throw new Error('Contains a link or special file');
    const names = fs.readdirSync(target);
    const folded = new Set(names.map(name => name.toLowerCase()));
    if (folded.has('.git') || ['head', 'objects', 'refs'].every(name => folded.has(name))) throw new Error('Contains Git metadata');
    for (const name of names) {
      const child = path.join(target, name);
      visit(child, fs.lstatSync(child));
    }
  }
  visit(directory, fs.lstatSync(directory));
  return { latest, bytes };
}

function taskReferences(root) {
  const taskDir = safePath(root, '.harness/tasks');
  // Task notes and evidence may use absolute paths or embed the ID in prose.
  // A conservative substring match preserves those runs too.
  return children(taskDir).filter(e => e.name.toLowerCase().endsWith('.json')).map(e => {
    if (!e.isFile()) throw new Error('Cannot inspect task references safely');
    const file = safePath(root, `.harness/tasks/${e.name}`, { allowMissing: false });
    return fs.readFileSync(file, 'utf8').toLowerCase();
  });
}

// Match concrete paths conservatively, including reference-style links and code spans.
export function artifactDocumentReferences(root, workspaces = []) {
  const files = new Set();
  for (const scope of new Set(['.', ...workspaces.map(workspace => workspace.root)])) {
    const scopePath = safePath(root, scope);
    const prefix = scope === '.' ? '' : scope + '/';
    for (const entry of children(scopePath)) {
      if (entry.isFile() && README.test(entry.name)) files.add(prefix + entry.name);
    }
    const docs = safePath(root, prefix + 'docs');
    if (!stat(docs)?.isDirectory()) continue;
    for (const entry of walk(docs, { ignore: [...defaultIgnore, '.vitepress'] })) {
      if (entry.type === 'file' && DOCUMENT.test(entry.path)) files.add(prefix + 'docs/' + entry.path);
    }
  }
  const references = new Map();
  for (const file of files) {
    const text = fs.readFileSync(safePath(root, file, { allowMissing: false }), 'utf8')
      .replace(/\\|%5c|%2f/gi, '/');
    for (const match of text.matchAll(RUN_REFERENCE)) {
      const id = match[1].toLowerCase();
      if (!references.has(id)) references.set(id, new Set());
      references.get(id).add(file);
    }
  }
  return references;
}

function classifyRun(root, entry, context) {
  const location = `${RUNS}/${entry.name}`;
  const item = { id: entry.name, path: location };
  if (context.tracked.some(name => under(name, location) || under(location, name))) return { ...item, status: 'protected', reason: 'Git index' };
  if (!entry.isDirectory() || !RUN_ID.test(entry.name)) return { ...item, status: 'unmanaged' };
  let record;
  try { record = readRun(root, entry.name); }
  catch { return { ...item, status: 'unmanaged', reason: 'Missing or invalid run record' }; }
  if (record.keep) return { ...item, status: 'kept' };
  if (context.references.some(text => text.includes(entry.name))) return { ...item, status: 'referenced', reason: 'Harness task reference' };
  const documents = context.documentReferences.get(entry.name);
  if (documents) return { ...item, status: 'referenced', reason: 'Document reference: ' + documents.values().next().value };
  if (!record.finishedAt) return { ...item, status: 'active' };
  try {
    const directory = safePath(root, location, { allowMissing: false });
    const { latest, bytes } = runInventory(directory);
    const lastActivity = Math.max(latest, Date.parse(record.finishedAt));
    return { ...item, status: lastActivity <= context.cutoff ? 'expired' : 'recent', bytes, lastActivity: new Date(lastActivity).toISOString() };
  } catch (error) {
    return { ...item, status: 'protected', reason: error.message };
  }
}

export function cleanArtifactRuns(root, { retentionDays }, { apply = false, workspaces = [] } = {}) {
  const cleanup = () => {
    const scope = safePath(root, RUNS);
    const entries = children(scope);
    const context = {
      cutoff: Date.now() - retentionDays * DAY,
      tracked: entries.length ? trackedPaths(root, RUNS) : [],
      references: entries.length ? taskReferences(root) : [],
      documentReferences: entries.length ? artifactDocumentReferences(root, workspaces) : new Map()
    };
    const items = entries.map(entry => classifyRun(root, entry, context));
    if (apply) for (const [index, item] of items.entries()) {
      if (item.status !== 'expired') continue;
      try {
        const current = classifyRun(root, entries[index], context);
        if (current.status !== 'expired') {
          Object.assign(item, current);
          continue;
        }
        // Recheck the resolved target under the fixed run root before deletion.
        const directory = safePath(root, runPath(item.id), { allowMissing: false });
        if (path.dirname(fs.realpathSync(directory)) !== fs.realpathSync(scope)) throw new Error('Run resolves outside the managed directory');
        fs.rmSync(directory, { recursive: true });
        item.status = 'removed';
      } catch (error) { item.status = 'failed'; item.reason = error.message; }
    }
    const failed = items.some(item => item.status === 'failed');
    return { status: failed ? 'partial' : apply ? 'cleaned' : 'preview', exitCode: failed ? 1 : 0, retentionDays, items };
  };
  return apply && stat(safePath(root, RUNS)) ? mutate(root, cleanup) : cleanup();
}

export function checkArtifactLayout(root, add) {
  try {
    const entries = children(safePath(root, 'artifacts'));
    const unknown = entries.filter(entry => !entry.isDirectory() || !CATEGORIES.includes(entry.name));
    if (unknown.length) {
      const examples = unknown.slice(0, 4).map(entry => entry.name).join(', ');
      add('artifacts.layout', 'artifacts', `Found ${unknown.length} uncategorized entries (${examples}); use artifacts/runs for new outputs and the archive directories for durable deliverables`);
    }
    for (const entry of children(safePath(root, RUNS))) {
      try { readRun(root, entry.name); }
      catch { add('artifacts.layout', `${RUNS}/${entry.name}`, 'Create a managed run with harness artifacts create'); }
    }
  } catch (error) { add('artifacts.layout', 'artifacts', error.message); }
}
