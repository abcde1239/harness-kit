import fs from 'node:fs';
import { fileHash, hash, readJson, safePath } from './fs.mjs';

export const AGENT_FILE = 'AGENTS.md';
export const HOSTS = Object.freeze(Object.fromEntries([
  ['codex', 'Codex', AGENT_FILE], ['claude', 'Claude Code', 'CLAUDE.md'],
  ['gemini', 'Gemini CLI', 'GEMINI.md'], ['cursor', 'Cursor', '.cursor/rules/harness-kit.mdc'],
  ['opencode', 'OpenCode', AGENT_FILE], ['dsh', 'DeepSeek Harness', AGENT_FILE],
].map(([id, label, file]) => [id, Object.freeze({ id, label, file })])));

export function normalizeHosts(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('hosts must be a nonempty array');
  const aliases = { 'claude-code': 'claude', 'gemini-cli': 'gemini', 'open-code': 'opencode', 'deepseek-harness': 'dsh' };
  return [...new Set(ids.map(value => {
    if (typeof value !== 'string') throw new Error('Invalid host: expected a host ID');
    const id = value.trim().toLowerCase(), canonical = Object.hasOwn(aliases, id) ? aliases[id] : id;
    if (!Object.hasOwn(HOSTS, canonical)) throw new Error(`Unsupported host: ${value}`);
    return canonical;
  }))];
}

export function selectedHosts(root, requested) {
  const stateFile = '.harness/managed.json';
  const previous = fs.existsSync(safePath(root, stateFile)) ? readJson(root, stateFile) : null;
  const existing = previous ? normalizeHosts(previous.hosts ?? ['codex']) : [];
  return requested === undefined ? (existing.length ? existing : ['codex']) : normalizeHosts([...existing, ...normalizeHosts(requested)]);
}
export const AGENT_BLOCK_START = '<!-- harness-kit:begin -->';
export const AGENT_BLOCK_END = '<!-- harness-kit:end -->';

// This block is safe to publish independently of private project notes.
export const agentInstructions = `${AGENT_BLOCK_START}
## Project development and verification

- Read applicable project instructions first. If docs/agent_guide.md or MEMORY.md exists locally, read only relevant conventions and lessons. Continue from public files when private material is absent; do not require downloading it.
- If docs/decision/coding-style/RULES.md exists, apply adopted rules within this task's scope; candidate rules are references only. Personal preferences do not override current user requirements, applicable instructions or existing tool configuration. Explain material conflicts.
- Use applicable installed Skills. Load Harness Kit through the actual host mechanism or CLI for onboarding, development, repair, review or recovery. Implement small changes directly; clarify scope and acceptance for complex work. Preserve frameworks and user edits.
- Use harness doctor for diagnosis, harness check for conventions and harness run for configured verification. If unavailable, verify the installation and Bun. Never report unrun, unconfigured, timed-out or skipped work as passed.
- For complex or cross-session work, use harness task start/resume/status to preserve goals, harness run --work ID to associate verification, harness task accept for checked criteria, and harness task finish only after completion gates hold.
- Delegate independent work only when authorized and real host tools are available. Provide goals, writable files, interface dependencies, applicable rules and verification commands. Assign one writer per shared file and independently check changes and evidence.
- Reproduce failures and distinguish implementation, configuration and environment causes before retrying. Report changes, actual outcomes and remaining blockers; refresh relevant evidence after project inputs change.
- Write maintained agent prompts and instructions in English; use the user's requested language for responses. Preserve original user-owned text, code and quotations. For observed agent behavior problems, assess context, tools, workflow, prompts and validation before adding a scoped rule.
- After coding or system design, consolidate reusable project memory and applicability. Keep development lessons, decisions and verification records internal. Check actual artifacts and provenance separately before publication.
${AGENT_BLOCK_END}`;

const blockHash = block => hash(block.replaceAll('\r\n', '\n'));

export function agentBlock(text) {
  const starts = [...text.matchAll(/<!-- harness-kit:begin -->/g)];
  const ends = [...text.matchAll(/<!-- harness-kit:end -->/g)];
  if (!starts.length && !ends.length) return { status: 'absent' };
  if (starts.length !== 1 || ends.length !== 1 || starts[0].index >= ends[0].index) return { status: 'malformed' };
  const start = starts[0].index, end = ends[0].index + AGENT_BLOCK_END.length;
  const content = text.slice(start, end);
  return { status: 'present', start, end, content, hash: blockHash(content) };
}

// Cursor only loads .mdc rules with valid frontmatter. Never change a user's
// scoped/manual rule into an always-on rule as a side effect of initialization.
export function cursorFrontmatter(text) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return { status: 'invalid', message: 'Cursor rule requires YAML frontmatter with alwaysApply: true' };
  try {
    const parsed = Bun.YAML.parse(match[1]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.alwaysApply !== true || [...match[1].matchAll(/^alwaysApply\s*:/gm)].length !== 1) throw new Error('alwaysApply must be true exactly once');
    return { status: 'valid' };
  } catch (error) { return { status: 'invalid', message: `Invalid Cursor frontmatter: ${error.message}` }; }
}

export function planAgentEntry(root, previous = { files: {} }, hostId = 'codex') {
  const host = HOSTS[normalizeHosts([hostId])[0]], file = host.file;
  const before = fileHash(root, file);
  const current = before === null ? '' : fs.readFileSync(safePath(root, file), 'utf8');
  const block = agentBlock(current), previousBlock = previous.blocks?.[file];
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const desiredBlock = agentInstructions.replaceAll('\n', newline);
  let content, action, reason;
  if (before === null) {
    // A deliberately removed managed entry is not silently recreated.
    content = `${host.id === 'cursor' ? '---\nalwaysApply: true\n---\n\n' : ''}# Project Agent Instructions\n\n${agentInstructions}\n`;
    action = previousBlock || previous.files?.[file] ? 'conflict' : 'create';
    if (action === 'conflict') reason = 'Previously managed Agent entry was removed; review before restoring it';
  } else if (block.status === 'absent') {
    content = current + (current.endsWith('\n') ? newline : newline + newline) + desiredBlock + newline;
    action = previousBlock ? 'conflict' : 'update';
    if (action === 'conflict') reason = 'Previously managed Agent block was removed; preserve the user decision';
  } else if (block.status === 'malformed') {
    content = current;
    action = 'conflict';
    reason = 'Agent block markers are incomplete or duplicated; merge the suggested block manually';
  } else {
    content = current.slice(0, block.start) + desiredBlock + current.slice(block.end);
    if (block.hash === blockHash(agentInstructions)) action = 'unchanged';
    else if (previousBlock === block.hash) action = 'update';
    else {
      action = 'conflict';
      reason = 'Agent block was modified or belongs to another owner; preserve its contents';
    }
    // Keep the existing bytes, including line endings, when instructions match.
    if (action === 'unchanged') content = current;
  }
  if (host.id === 'cursor' && before !== null && cursorFrontmatter(current).status !== 'valid') {
    action = 'conflict'; content = current;
    reason = cursorFrontmatter(current).message + '; preserve the existing rule and merge manually';
  }
  return { path: file, before, after: hash(content), action, content,
    blockHash: blockHash(agentInstructions), ...(reason ? { reason, suggestedBlock: desiredBlock } : {}) };
}

export function inspectAgentEntry(root, hostId = 'codex') {
  const host = HOSTS[normalizeHosts([hostId])[0]];
  const location = safePath(root, host.file), override = host.id === 'codex' ? safePath(root, 'AGENTS.override.md') : null;
  const present = fs.existsSync(location), overridePresent = override !== null && fs.existsSync(override);
  const content = present ? fs.readFileSync(location, 'utf8') : '';
  const block = present ? agentBlock(content) : { status: 'absent' };
  const overrideActive = overridePresent && fs.readFileSync(override, 'utf8').trim().length > 0;
  const frontmatter = host.id === 'cursor' && present ? cursorFrontmatter(content) : null;
  const managed = block.status === 'present' && block.hash === blockHash(agentInstructions) && (!frontmatter || frontmatter.status === 'valid');
  return { host: host.id, file: host.file, present, block: block.status, managed, ...(frontmatter ? { frontmatter } : {}),
    ...(host.id === 'dsh' ? { notice: 'DSH developer preview：需启用 agent-instructions 和文件系统插件；自定义候选文件、上下文预算及 CLAUDE.md/local overlays 会影响加载，请在实际会话核对。' } : {}),
    overridePresent, overridden: overrideActive, status: overrideActive ? 'overridden' : !present ? 'missing' : block.status === 'malformed' || (block.status === 'present' && !managed) || frontmatter?.status === 'invalid' ? 'conflict' : managed ? 'configured' : 'unmanaged',
    loaded: 'not-confirmed',
    message: overrideActive ? 'Root AGENTS.override.md takes precedence; review its Harness Kit guidance in a new session' : 'File inspection does not confirm a live Agent session loaded these instructions' };
}

export function inspectHostEntries(root) {
  const hosts = selectedHosts(root);
  return { hosts, entries: hosts.map(id => inspectAgentEntry(root, id)) };
}
