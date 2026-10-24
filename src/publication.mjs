import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite, digest, fileHash, hash, json, readJson, relativePath, safePath, walk } from './fs.mjs';
import { classify } from './policy.mjs';
import { internalHistoryHashes } from './git.mjs';
import { finding, report } from './report.mjs';

const fail = (rule,name,message) => finding(`publication.${rule}`,name,message,{protectedRule:true});
const archives = /\.(zip|tar|gz|tgz|7z|rar|jar|war|bz2|xz)$/i;
function internalHashes(root,config) {
  const result = internalHistoryHashes(root,config);
  for (const file of walk(root).filter(e => e.type === 'file')) if (classify(config,file.path).audience === 'internal') result.add(fileHash(root,file.path));
  return result;
}
function linkFindings(root, config, name, text, { artifactFiles, artifactRoot } = {}) {
  if (!/\.(md|mdx|html?)$/i.test(name)) return [];
  const findings = [];
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g), ...text.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  for (let link of links) {
    link = link.replace(/^<|>$/g,'').split(/[?#]/)[0];
    if (!link || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(link)) continue;
    try {
      link = decodeURIComponent(link);
      const target = path.posix.normalize(link.startsWith('/') ? link.slice(1) : path.posix.join(path.posix.dirname(name),link));
      relativePath(target);
      if (artifactFiles) {
        const possible = [target,`${target}/index.html`,`${target}.html`];
        if (!possible.some(p => artifactFiles.has(p))) findings.push(fail('link',name,`Public artifact link is absent from inspected output: ${target}`));
        if (classify(config,target).audience === 'internal') findings.push(fail('link',name,`Public link names internal content: ${target}`));
      } else if (classify(config,target).audience !== 'public' || !fs.existsSync(safePath(root,target))) findings.push(fail('link',name,`Source link is not a known public file: ${target}`));
    } catch { findings.push(fail('link',name,'Unsafe or malformed local public link')); }
  }
  return findings;
}
export function checkManifest(root, config, manifest) {
  const findings = [];
  try {
    if (!manifest || manifest.version !== 1 || typeof manifest.target !== 'string' || !manifest.target || !Array.isArray(manifest.entries)) throw new Error('Expected manifest version 1, target, artifactRoot and entries');
    const artifactRoot = safePath(root,manifest.artifactRoot,{allowMissing:false});
    if (!fs.statSync(artifactRoot).isDirectory()) throw new Error('artifactRoot must be a directory');
    const actual = walk(artifactRoot,{ignore:[]}), seen = new Set(), internal = internalHashes(root,config), snapshot = [];
    const actualFiles = new Set(actual.map(e => e.path));
    for (const e of actual.filter(e => e.type !== 'file')) findings.push(fail('path',e.path,`Unsupported publication entry: ${e.type}`));
    for (const entry of manifest.entries) {
      relativePath(entry.path);
      if (seen.has(entry.path.toLowerCase())) throw new Error(`Duplicate/case-colliding manifest path: ${entry.path}`);
      seen.add(entry.path.toLowerCase());
      const location = safePath(artifactRoot,entry.path,{allowMissing:false});
      if (!fs.statSync(location).isFile()) throw new Error(`Not a file: ${entry.path}`);
      const bytes = fs.readFileSync(location), checksum = hash(bytes);
      snapshot.push({path:entry.path,sha256:checksum});
      if (checksum !== entry.sha256) findings.push(fail('digest',entry.path,'Output differs from reviewed manifest hash'));
      if (internal.has(checksum)) findings.push(fail('internal-copy',entry.path,'Output is a byte-identical copy of known internal current/historical content'));
      if (archives.test(entry.path)) findings.push(fail('archive',entry.path,'Archive contents are not audited; supply an extracted tree and publish only the checked format'));
      if (classify(config,entry.path).audience === 'internal') findings.push(fail('internal',entry.path,'Output path is explicitly internal'));
      if (!Array.isArray(entry.sources) || !entry.sources.length) { findings.push(fail('unknown-source',entry.path,'Output has no provenance')); continue; }
      let directCopy = false;
      for (const source of entry.sources) {
        relativePath(source.path);
        if (classify(config,source.path).audience !== 'public') findings.push(fail('internal-source',entry.path,`Source is not explicitly public: ${source.path}`));
        const sourceBytes = fs.readFileSync(safePath(root,source.path,{allowMissing:false})), sourceHash = hash(sourceBytes);
        if (sourceHash !== source.sha256) findings.push(fail('source-digest',entry.path,`Source changed: ${source.path}`));
        if (internal.has(sourceHash)) findings.push(fail('internal-copy',entry.path,`Source copies known internal content: ${source.path}`));
        if (sourceHash === checksum) directCopy = true;
        findings.push(...linkFindings(root,config,source.path,sourceBytes.toString('utf8')));
      }
      if (!directCopy && !(entry.review?.reviewer?.trim() && entry.review?.reference?.trim())) findings.push(fail('generated-review',entry.path,'Transformed output needs explicit reviewer/reference for complete provenance'));
      findings.push(...linkFindings(root,config,entry.path,bytes.toString('utf8'),{artifactFiles:actualFiles,artifactRoot}));
    }
    for (const file of actual) if (!seen.has(file.path.toLowerCase())) findings.push(fail('unlisted',file.path,'Actual output contains a file missing from manifest'));
    if (!manifest.entries.length) findings.push(fail('empty',manifest.artifactRoot,'No publication files were inspected'));
    return report(findings,{target:manifest.target,policyDigest:digest(config),manifestDigest:digest(manifest),artifactDigest:digest(snapshot.sort((a,b)=>a.path.localeCompare(b.path))),files:snapshot,coverage:'actual output tree and declared/reviewed provenance'});
  } catch (error) { return report([...findings,fail('incomplete','manifest',error.message)],{exitCode:2}); }
}
export function publicationCheck(root,config,{target,manifestPath} = {}) {
  if (manifestPath) return checkManifest(root,config,readJson(root,manifestPath));
  const targets = config.publicationTargets.filter(t => !target || t.id === target);
  if (!targets.length) return report([fail('not-configured',target ?? 'publicationTargets','No matching publication target configured')],{exitCode:2});
  const reports = targets.map(t => ({id:t.id,...checkManifest(root,config,readJson(root,t.manifest))}));
  return report(reports.flatMap(r=>r.findings),{targets:reports,exitCode:Math.max(...reports.map(r=>r.exitCode))});
}
export function exportSnapshot(root,config,destination) {
  const target = safePath(root,destination);
  if (fs.existsSync(target)) throw new Error('Snapshot destination must not exist');
  const candidates = walk(root,{ignore:['.git','node_modules','.harness']});
  const publicEntries = candidates.filter(e => classify(config,e.path).audience === 'public');
  const internal = internalHashes(root,config), findings = [], files = [];
  for (const file of publicEntries) {
    if (file.type !== 'file') { findings.push(fail('path',file.path,'Public source must be a regular file')); continue; }
    const bytes = fs.readFileSync(safePath(root,file.path)), sha256 = hash(bytes);
    if (internal.has(sha256)) findings.push(fail('internal-copy',file.path,'Public candidate copies known internal content'));
    if (archives.test(file.path)) findings.push(fail('archive',file.path,'Cannot export an unaudited archive'));
    findings.push(...linkFindings(root,config,file.path,bytes.toString('utf8')));
    files.push({path:file.path,sha256,bytes});
  }
  if (!files.length) findings.push(fail('empty','snapshot','No explicitly public files to export'));
  if (findings.length) return report(findings);
  // Destination is a new tree only; source .git is never copied or initialized.
  fs.mkdirSync(target,{recursive:true});
  for (const file of files) atomicWrite(target,file.path,file.bytes);
  const manifest = {version:1,target:'public-snapshot',artifactRoot:destination,entries:files.map(({path,sha256})=>({path,sha256,sources:[{path,sha256}]}))};
  const result = checkManifest(root,config,manifest);
  return {...result,destination,manifest,notice:'Local snapshot only. Existing target repository history must be audited separately before syncing.'};
}
