import fs from 'node:fs';
import path from 'node:path';
import { safePath } from '../fs.mjs';
import { workspaceId } from './recipes.mjs';
export function discoverGo(root, files) {
  const facts = [], workspaces = [], tasks = [], questions = [];
  const modules = files.filter(f => f === 'go.mod' || f.endsWith('/go.mod'));
  for (const file of modules) {
    const directory = path.posix.dirname(file), id = workspaceId(directory,modules.map(f=>path.posix.dirname(f)));
    facts.push({ source: file, capability: 'go-module' });
    workspaces.push({ id, root: directory, tests: { include: ['**/*_test.go'] } });
    tasks.push({ id: `${id}:go-test`, workspace: id, kind: 'test', argv: ['go','test','./...'] });
  }
  for (const file of files.filter(f => f === 'go.work' || f.endsWith('/go.work'))) {
    const content = fs.readFileSync(safePath(root, file), 'utf8');
    facts.push({ source: file, capability: 'go-workspace' });
    const declarations = [...content.matchAll(/(?:^use\s+([^\r\n(]+)|^use\s*\(([\s\S]*?)\))/gm)].flatMap(m => (m[1] ?? m[2]).split(/\r?\n/)).map(s => s.replace(/\/\/.*$/, '').trim().replace(/^"|"$/g, '')).filter(Boolean);
    for (const dir of declarations) {
      const module = path.posix.normalize(path.posix.join(path.posix.dirname(file), dir, 'go.mod'));
      if (!files.includes(module)) questions.push({ id: `module:${module}`, message: `Missing or external go.work module: ${module}`, type: 'manual' });
    }
  }
  return { facts, workspaces, tasks, questions };
}
