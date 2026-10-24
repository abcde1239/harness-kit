import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';

// Existing harness config wins inside the nearest Git boundary; never silently cross repositories.
export function locateProject(cwd = process.cwd(), explicit) {
  if (explicit) return {root:fs.realpathSync(path.resolve(cwd,explicit)),source:'explicit'};
  const start=fs.realpathSync(cwd), chain=[];
  let cursor=start;
  while(true) {
    chain.push(cursor);
    if(fs.existsSync(path.join(cursor,CONFIG))) return {root:cursor,source:CONFIG};
    if(fs.existsSync(path.join(cursor,'.git'))) break;
    const parent=path.dirname(cursor); if(parent===cursor)break; cursor=parent;
  }
  for(const dir of chain) {
    if(['pnpm-workspace.yaml','go.work'].some(f=>fs.existsSync(path.join(dir,f)))) return {root:dir,source:'workspace'};
    const pkg=path.join(dir,'package.json');
    if(fs.existsSync(pkg)) {try {if(JSON.parse(fs.readFileSync(pkg,'utf8')).workspaces)return {root:dir,source:'workspace'};} catch {}}
  }
  const gitRoot=chain.find(dir=>fs.existsSync(path.join(dir,'.git')));
  if(gitRoot)return {root:gitRoot,source:'git'};
  const project=chain.find(dir=>['package.json','go.mod'].some(f=>fs.existsSync(path.join(dir,f))));
  return {root:project??start,source:project?'project-manifest':'current-directory'};
}
