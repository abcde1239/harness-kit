import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite, hash, json, readJson, safePath, under } from './fs.mjs';
import { trackedPaths } from './git.mjs';

export const HOOK_SESSIONS = '.harness/hooks/sessions';
const SESSION_ID = /^[0-9a-f]{64}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const DAY = 86_400_000;

function sessionFile(id) {
  return `${HOOK_SESSIONS}/${id}.json`;
}

export function isHookSessionFile(name) {
  const match = /^(.*)\.(?:json|lock)$/.exec(name);
  return Boolean(match && SESSION_ID.test(match[1]));
}

function readSession(root, name) {
  if (!fs.lstatSync(safePath(root, name), { throwIfNoEntry: false })?.isFile()) throw new Error('Expected an ordinary Hook session file');
  const record = readJson(root, name);
  if (record?.version !== 1 || typeof record.inputDigest !== 'string' || !DIGEST.test(record.inputDigest) ||
      Object.keys(record).some(key => !['version', 'inputDigest', 'lastSeenAt'].includes(key)) ||
      (record.lastSeenAt !== undefined && (typeof record.lastSeenAt !== 'string' || !Number.isFinite(Date.parse(record.lastSeenAt))))) {
    throw new Error('Invalid Hook session record');
  }
  return record;
}

function withSessionLock(root, id, action) {
  const lock = safePath(root, `${HOOK_SESSIONS}/${id}.lock`);
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') return { status: 'busy' };
    throw error;
  }
  try { return action(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

export function touchHookSession(root, sessionId, startDigest) {
  const id = hash(sessionId);
  const name = sessionFile(id);
  const target = safePath(root, name);
  if (startDigest) fs.mkdirSync(path.dirname(target), { recursive: true });
  else if (!fs.existsSync(target)) return { status: 'missing' };
  return withSessionLock(root, id, () => {
    const exists = fs.existsSync(target);
    if (!exists && !startDigest) return { status: 'missing' };
    const inputDigest = exists ? readSession(root, name).inputDigest : startDigest();
    atomicWrite(root, name, json({ version: 1, inputDigest, lastSeenAt: new Date().toISOString() }));
    return { status: 'recorded', inputDigest };
  });
}

function sessionStatus(root, name, cutoff) {
  try {
    const record = readSession(root, name);
    if (!record.lastSeenAt) return { status: 'legacy', reason: 'No recorded activity time' };
    const lastSeenAt = Date.parse(record.lastSeenAt);
    // Preserve a record touched by a previously installed runner or external writer.
    const mtime = fs.statSync(safePath(root, name, { allowMissing: false })).mtimeMs;
    return { status: Math.max(lastSeenAt, mtime) <= cutoff ? 'expired' : 'recent', lastSeenAt: record.lastSeenAt };
  } catch (error) { return { status: 'protected', reason: error.message }; }
}

export function cleanHookSessions(root, { sessionRetentionDays }, { apply = false } = {}) {
  const directory = safePath(root, HOOK_SESSIONS);
  const cutoff = Date.now() - sessionRetentionDays * DAY;
  const entries = fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }) : [];
  const indexed = entries.length ? trackedPaths(root, HOOK_SESSIONS) : [];
  const items = [];
  for (const entry of entries) {
    const id = entry.name.slice(0, -5);
    if (!entry.name.endsWith('.json') || !SESSION_ID.test(id)) continue;
    const name = sessionFile(id);
    const item = { path: name };
    items.push(item);
    if (indexed.some(file => under(name, file))) Object.assign(item, { status: 'protected', reason: 'Git index' });
    else if (!entry.isFile()) Object.assign(item, { status: 'protected', reason: 'Expected an ordinary Hook session file' });
    else if (fs.lstatSync(path.join(directory, `${id}.lock`), { throwIfNoEntry: false })) item.status = 'busy';
    else Object.assign(item, sessionStatus(root, name, cutoff));
    if (!apply || item.status !== 'expired') continue;
    try {
      Object.assign(item, withSessionLock(root, id, () => {
        const current = sessionStatus(root, name, cutoff);
        if (current.status !== 'expired') return current;
        fs.unlinkSync(safePath(root, name, { allowMissing: false }));
        return { ...current, status: 'removed' };
      }));
    } catch (error) { Object.assign(item, { status: 'failed', reason: error.message }); }
  }
  const failed = items.some(item => item.status === 'failed');
  return { status: failed ? 'partial' : apply ? 'cleaned' : 'preview', exitCode: failed ? 1 : 0, retentionDays: sessionRetentionDays, items };
}
