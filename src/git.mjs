import { spawnSync } from 'node:child_process';
import { classify } from './policy.mjs';
import { digest, hash, relativePath } from './fs.mjs';
import { finding, report } from './report.mjs';

function git(root, args, { binary = false, optional = false } = {}) {
  const result = spawnSync('git', ['--no-replace-objects','-C',root,...args], { encoding: binary ? undefined : 'utf8', maxBuffer: 64*1024*1024, timeout: 30000, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } });
  if (result.error || result.status !== 0) {
    if (optional) return null;
    // Do not echo Git stderr: it may contain a credential-bearing remote URL.
    throw new Error(`Git ${args[0]} unavailable or incomplete (${result.error?.code ?? result.status})`);
  }
  return result.stdout;
}
export const isGit = root => git(root, ['rev-parse','--is-inside-work-tree'], { optional: true })?.trim() === 'true';
export function gitScope(root, config) {
  const refs = git(root,['for-each-ref','--format=%(refname) %(objectname)']).trim().split(/\r?\n/).filter(Boolean).map(line => { const [name,oid] = line.split(' '); return { name,oid }; });
  const head = git(root,['rev-parse','--verify','HEAD'],{optional:true})?.trim() ?? null;
  const shallow = git(root,['rev-parse','--is-shallow-repository']).trim() === 'true';
  const remoteDigest = hash(git(root,['remote','-v']));
  const policyDigest = digest(config);
  return { refs, head, shallow, remoteDigest, policyDigest, scopeDigest: digest({ refs,head,shallow,remoteDigest,policyDigest }) };
}
const privacyFinding = (rule, name, message, detail) => finding(rule,name,message,{ protectedRule: true, detail });
function entries(output) {
  return output.split('\0').filter(Boolean).map(row => {
    const tab = row.indexOf('\t'), [mode,type,oid] = row.slice(0,tab).split(' ');
    return { mode,type,oid,path:row.slice(tab+1) };
  });
}
// Read reachable objects, not only HEAD. Cache each blob so a copied/renamed known internal file stays internal.
export function historyInventory(root, { onProgress } = {}) {
  const commits = git(root,['rev-list','--all', ...(git(root,['rev-parse','--verify','HEAD'],{optional:true}) ? ['HEAD'] : [])]).trim().split(/\r?\n/).filter(Boolean);
  const records = [], blobs = new Map(), trees = new Set();
  for (const [i,commit] of commits.entries()) {
    onProgress?.({ phase: 'history', current:i+1,total:commits.length });
    const tree = git(root,['rev-parse',`${commit}^{tree}`]).trim();
    if (trees.has(tree)) continue; trees.add(tree);
    for (const entry of entries(git(root,['ls-tree','-r','-z',commit]))) {
      records.push({ ...entry, commit });
      if (entry.type === 'blob' && !blobs.has(entry.oid)) blobs.set(entry.oid,git(root,['cat-file','blob',entry.oid],{binary:true}));
    }
  }
  return { records,blobs };
}
function knownInternal(config, inventory) {
  const oids = new Set();
  for (const e of inventory.records) {
    try { if (classify(config,e.path).audience === 'internal') oids.add(e.oid); }
    catch { oids.add(e.oid); }
  }
  return oids;
}
export function internalHistoryHashes(root, config) {
  if (!isGit(root)) return new Set();
  const data = historyInventory(root), internal = knownInternal(config,data);
  return new Set([...internal].filter(oid => data.blobs.has(oid)).map(oid => hash(data.blobs.get(oid))));
}
function inspectRecord(config, e, blob, internalOids) {
  const findings = [];
  let classification;
  try { relativePath(e.path); classification = classify(config,e.path); }
  catch { findings.push(privacyFinding('publication.path',e.path,'Unsafe historical path')); return findings; }
  if (e.mode === '120000' || e.mode === '160000') findings.push(privacyFinding('publication.nested-resource',e.path,'Symlink or submodule requires independent reviewed export',e.commit));
  if (classification.audience !== 'public' || internalOids.has(e.oid)) findings.push(privacyFinding('publication.internal-history',e.path,internalOids.has(e.oid) ? 'Known internal content exists in reachable history/index' : 'Historical/index file is not explicitly public',e.commit ?? e.oid));
  if (blob?.subarray(0,150).toString().startsWith('version https://git-lfs.github.com/spec/v1')) findings.push(privacyFinding('publication.lfs',e.path,'LFS object audit is unsupported: supply a reviewed snapshot instead',e.commit));
  return findings;
}
export function auditIndex(root, config) {
  if (!isGit(root)) return report([privacyFinding('publication.git-unavailable','.git','Public repository index cannot be checked')],{exitCode:2});
  try {
    const data = historyInventory(root), internal = knownInternal(config,data);
    const staged = git(root,['ls-files','--stage','-z']).split('\0').filter(Boolean).map(row => {
      const tab = row.indexOf('\t'), [mode,oid,stage] = row.slice(0,tab).split(' ');
      return { mode,oid,stage,type:'blob',path:row.slice(tab+1) };
    });
    for (const e of staged) if (classify(config,e.path).audience === 'internal') internal.add(e.oid);
    const findings = staged.flatMap(e => e.stage !== '0' ? [privacyFinding('publication.index-conflict',e.path,'Unmerged index cannot be published')] : inspectRecord(config,e,git(root,['cat-file','blob',e.oid],{binary:true}),internal));
    return report(findings,{ coverage:'index-and-known-internal-history' });
  } catch (error) { return report([privacyFinding('publication.git-incomplete','.git',error.message)],{exitCode:2}); }
}
export function reviewTemplate(root, config) {
  const scope = gitScope(root,config);
  return {
    version:1, scopeDigest:scope.scopeDigest,
    reviewer:'', reference:'', visibility:config.repository.visibility,
    remoteRefs: null,
    platform:Object.fromEntries(['issues','pullRequests','wiki','releases','actions','other'].map(name => [name,{status:'pending',reference:''}])),
    instructions:'Manually inventory ALL remote refs and platform content. Fill reviewer/reference and each section. This is a reviewer attestation, not an automatic platform audit.'
  };
}
export function auditHistory(root, config, { evidence, onProgress } = {}) {
  const findings = [];
  try {
    const scope = gitScope(root,config);
    if (scope.shallow) findings.push(privacyFinding('publication.shallow','.git','Shallow repository cannot pass full-history review'));
    if (scope.refs.some(r => r.name.startsWith('refs/replace/'))) findings.push(privacyFinding('publication.replace','.git','Replace refs require separate review'));
    if (!scope.head) findings.push(privacyFinding('publication.no-history','.git','No HEAD to bind repository publication evidence'));
    if (config.repository.visibility === 'unknown') findings.push(privacyFinding('publication.visibility','.git','Repository visibility is unknown'));
    const inventory = historyInventory(root,{onProgress}), internal = knownInternal(config,inventory), seen = new Set();
    for (const entry of inventory.records) {
      const key = `${entry.path}\0${entry.oid}`; if (seen.has(key)) continue; seen.add(key);
      findings.push(...inspectRecord(config,entry,inventory.blobs.get(entry.oid),internal));
    }
    const validText = value => typeof value === 'string' && value.trim().length > 0;
    if (!evidence || evidence.version !== 1 || evidence.scopeDigest !== scope.scopeDigest || !validText(evidence.reviewer) || !validText(evidence.reference) || evidence.visibility !== config.repository.visibility) findings.push(privacyFinding('publication.review','.git','Missing, incomplete or stale reviewer evidence bound to this scope'));
    else {
      if (!Array.isArray(evidence.remoteRefs)) findings.push(privacyFinding('publication.remote-refs','.git','Remote ref inventory has not been attested'));
      else for (const r of evidence.remoteRefs) if (!r || !validText(r.name) || !validText(r.oid) || !scope.refs.some(local => local.oid === r.oid && (local.name === r.name || local.name.replace(/^refs\/remotes\/[^/]+\//,'refs/heads/') === r.name))) findings.push(privacyFinding('publication.remote-refs','.git','An attested remote ref is absent or stale locally'));
      for (const section of ['issues','pullRequests','wiki','releases','actions','other']) {
        const item = evidence.platform?.[section];
        if (!item || !['reviewed','not-applicable'].includes(item.status) || !validText(item.reference)) findings.push(privacyFinding('publication.platform-review',section,'Platform section has not been explicitly reviewed'));
      }
    }
    return report(findings,{ scope, commitsAndFilesScanned:inventory.records.length, coverage:'reachable-local-refs plus explicit human remote/platform attestation', automaticPlatformAudit:false });
  } catch (error) { return report([...findings,privacyFinding('publication.git-incomplete','.git',error.message)],{exitCode:2}); }
}
