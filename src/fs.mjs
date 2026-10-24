import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const slash = value => value.replaceAll('\\', '/');
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const digest = value => hash(stable(value));
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
export function relativePath(value, { glob = false } = {}) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.includes(':') || path.isAbsolute(value)) throw new Error(`Invalid relative path: ${value}`);
  if (value.split('/').some(p => p === '..' || (p !== '.' && /[. ]$/.test(p)) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p) || (!glob && /[*?\[\]{}]/.test(p))) || /[\x00-\x1f]/.test(value)) throw new Error(`Unsafe relative path: ${value}`);
  return path.posix.normalize(value).replace(/\/$/, '') || '.';
}
// Refuse symlinks in every path component, including write destinations that do not exist yet.
export function safePath(root, relative, { allowMissing = true } = {}) {
  relative = relativePath(relative);
  root = fs.realpathSync(root);
  const target = path.resolve(root, relative);
  const fromRoot=path.relative(root,target);
  if (fromRoot==='..'||fromRoot.startsWith(`..${path.sep}`)||path.isAbsolute(fromRoot)) throw new Error(`Path escapes root: ${relative}`);
  let cursor = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Symbolic link not allowed: ${relative}`); }
    catch (error) { if (!(allowMissing && error.code === 'ENOENT')) throw error; }
  }
  if (!allowMissing && !fs.existsSync(target)) throw new Error(`Missing path: ${relative}`);
  return target;
}
export function readJson(root, name) {
  try { return JSON.parse(fs.readFileSync(safePath(root, name, { allowMissing: false }), 'utf8')); }
  catch (error) { throw new Error(`Cannot read ${name}: ${error.message}`); }
}
export function fileHash(root, name) {
  const target = safePath(root, name);
  return fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
}
export function atomicWrite(root, name, content) {
  const target = safePath(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, content, { flag: 'wx' }); fs.renameSync(tmp, target); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
export const defaultIgnore = ['.git', 'node_modules', '.harness', 'artifacts', 'coverage', 'dist', 'build'];
export function walk(root, { ignore = defaultIgnore } = {}) {
  const result = [];
  function visit(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignore.includes(entry.name)) continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) result.push({ path: name, type: 'symlink' });
      else if (entry.isDirectory()) visit(path.join(dir, entry.name), name);
      else if (entry.isFile()) result.push({ path: name, type: 'file' });
      else result.push({ path: name, type: 'unsupported' });
    }
  }
  visit(fs.realpathSync(root), '');
  return result;
}
// Deliberately small portable glob dialect: *, ** and ?. No shell expansion.
export function matches(name, pattern) {
  pattern = relativePath(pattern, { glob: true });
  let expr = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i++;
      if (pattern[i + 1] === '/') { i++; expr += '(?:.*/)?'; } else expr += '.*';
    } else if (c === '*') expr += '[^/]*';
    else if (c === '?') expr += '[^/]';
    else expr += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${expr}$`, 'i').test(slash(name));
}
export const under = (name, root) => root === '.' || name.toLowerCase() === root.toLowerCase() || name.toLowerCase().startsWith(root.toLowerCase() + '/');
