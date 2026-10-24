import { matches, relativePath, under } from './fs.mjs';

const protectedPatterns = ['**/.git/**','**/.git','**/MEMORY.md','**/memory/**','**/memories/**','**/decision/**','**/decisions/**'];
export function classify(c, name) {
  name = relativePath(name);
  const internal = [], publicMatches = [];
  for (const p of protectedPatterns) if (matches(name, p)) internal.push(`protected:${p}`);
  function collect(policy, prefix, source) {
    const qualify = p => prefix === '.' ? p : p === '.' ? prefix : `${prefix}/${p}`;
    for (const [key,list] of [['internalRoots',internal],['publicRoots',publicMatches]]) for (const p of policy?.[key] ?? []) if (under(name, qualify(p))) list.push(`${source}:${key}:${p}`);
    for (const [key,list] of [['internalPatterns',internal],['publicPatterns',publicMatches]]) for (const p of policy?.[key] ?? []) if (matches(name, qualify(p))) list.push(`${source}:${key}:${p}`);
  }
  collect(c.documents, '.', 'root');
  for (const w of c.workspaces) if (w.documents) collect(w.documents, w.root, w.id);
  return { audience: internal.length ? 'internal' : publicMatches.length ? 'public' : 'unknown', reasons: [...internal, ...publicMatches], conflict: internal.length > 0 && publicMatches.length > 0 };
}
