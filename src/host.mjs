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
## 项目开发与验证

- 开始任务时，读取适用的项目指令；本地存在 docs/agent_guide.md 或 MEMORY.md 时，只读取与当前任务相关的约定和经验。内部资料缺失时继续依据公开项目文件工作，不要求下载私有资料。
- 按任务选择可用 Skill；已安装 Harness Kit 时，按当前宿主支持的方式加载技能或调用 harness CLI，进行项目接入、开发、修复、评审或恢复。简单改动直接实施，复杂改动先明确范围与验收，保留既有框架和用户修改。
- 使用 harness doctor 诊断接入，使用 harness check 检查项目约定，使用 harness run 运行配置中的验证任务。命令不可用时先核实安装位置和 Bun，不把未运行、未配置、超时或跳过报告为通过。
- 复杂或跨会话任务可用 harness task start/resume/status 保存与恢复目标；用 harness task accept 记录验收，再以 harness run --work ID 验证，最后用 harness task finish 核对完成条件。
- 独立子任务适合并行且用户或适用项目指令允许多 Agent 时再委派。给每个 Agent 明确目标、可写文件、依赖接口和验收命令；共享文件由一名负责人整合，完成后独立检查变更与证据。
- 修复失败应先复现并区分代码问题、配置问题和环境缺失，再运行受影响验证。报告本次变更、实际执行结果和剩余阻塞；项目内容变化后重新核实相关证据。
- 编码或系统设计完成后，按项目约定合并可复用 memory，去重并记录适用范围。开发经验、决策和验证记录保留内部；公开发布前另行检查实际产物与来源。
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
    content = `${host.id === 'cursor' ? '---\nalwaysApply: true\n---\n\n' : ''}# 项目 Agent 指令\n\n${agentInstructions}\n`;
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
