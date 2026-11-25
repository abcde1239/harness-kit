import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { atomicWrite, hash, safePath } from './fs.mjs';
import { normalizeHosts } from './host.mjs';

const roles = {
  'product-manager': 'Clarifies requirements, scope and business acceptance.',
  'ux-designer': 'Designs user journeys, interaction, visual hierarchy and accessibility.',
  architect: 'Designs shared interfaces, data contracts and module boundaries.',
  frontend: 'Implements client interfaces, interaction and state.',
  backend: 'Implements service logic, APIs and storage.',
  qa: 'Designs and runs acceptance, regression and reproduction checks.',
  'code-reviewer': 'Independently reviews code and verification evidence without editing.',
  documentation: 'Improves documentation and reviews it from a reader’s perspective.',
  'agent-expert': 'Diagnoses agent behavior and evaluates changes to prompts, tools or workflow.',
};
const native = {
  codex: '.codex/agents', claude: '.claude/agents', gemini: '.gemini/agents',
  cursor: '.cursor/agents', opencode: '.opencode/agents',
};
const marker = /^# harness-kit:role-v1 ([0-9a-f]{64})\n/;

export function readRolePrompts() {
  const references = new URL('../skills/harness-kit/references/', import.meta.url);
  return Object.fromEntries(Object.keys(roles).map(id => {
    const file = id === 'code-reviewer' ? 'collaboration.md' : `roles/${id}.md`;
    let markdown = fs.readFileSync(new URL(file, references), 'utf8').replaceAll('\r\n', '\n');
    if (id === 'code-reviewer') markdown = markdown.split('## Read-only reviewer prompt\n')[1] ?? '';
    const block = /```text\n([\s\S]+?)\n```/.exec(markdown)?.[1];
    if (!block) throw new Error(`Missing role prompt: ${file}`);
    return [id, block];
  }));
}

function render(host, id, name, description, rolePrompt) {
  const prompt = `${rolePrompt}\n\nUse the assignment's scope, write ownership, permitted checks and acceptance criteria. Ask the lead about material gaps or conflicts. Report actual evidence and uncovered behavior. Do not independently delegate, commit, deploy, publish, or declare the whole task finished.`;
  if (host === 'codex') {
    return `name = ${JSON.stringify(name)}\ndescription = ${JSON.stringify(description)}\ndeveloper_instructions = ${JSON.stringify(prompt)}\n`;
  }
  const settings = host === 'opencode' ? { description, mode: 'subagent' } : { name, description };
  if (id === 'code-reviewer') {
    if (host === 'claude') settings.tools = 'Read, Glob, Grep';
    if (host === 'cursor') settings.readonly = true;
    if (host === 'opencode') settings.permissions = ['edit', 'shell'].map(action => ({ action, resource: '*', effect: 'deny' }));
  }
  return `---\n${stringifyYaml(settings)}---\n\n${prompt}\n`;
}

function owned(file, relative) {
  const start = file.startsWith('---\n') ? 4 : 0;
  const match = marker.exec(file.slice(start));
  return match && match[1] === hash(relative + '\n' + file.slice(0, start) + file.slice(start + match[0].length));
}

export function configureRoles(root, {host, role, apply = false} = {}) {
  const ids = !role || role === 'all' ? Object.keys(roles) : [...new Set(role.split(',').map(value => value.trim()))];
  for (const id of ids) if (!Object.hasOwn(roles, id)) throw new Error(`Unknown role: ${id}`);
  const catalog = ids.map(id => ({ id, name: id === 'qa' ? 'tester' : id, description: roles[id] }));
  if (!host) {
    if (apply) throw new Error('--host is required to apply role configuration');
    return { status: 'catalog', hosts: [...Object.keys(native), 'dsh'], roles: catalog };
  }
  [host] = normalizeHosts([host]);
  if (!Object.hasOwn(native, host)) {
    return { status: 'manual', host, roles: catalog, changed: [], notice: 'Use the matching Skill role and pass its responsibility-based name to the DeepSeek Harness delegation tool when it supports names. Use the active preset.' };
  }
  if (apply && !role) throw new Error('Select --role <ids> or --role all to apply role configuration');

  const prompts = typeof HARNESS_ROLE_PROMPTS === 'undefined' ? readRolePrompts() : HARNESS_ROLE_PROMPTS;
  const files = catalog.map(({ id, name, description }) => {
    const relative = `${native[host]}/${name}.${host === 'codex' ? 'toml' : 'md'}`;
    const content = render(host, id, name, description, prompts[id]);
    const start = content.startsWith('---\n') ? 4 : 0;
    const next = `${content.slice(0, start)}# harness-kit:role-v1 ${hash(relative + '\n' + content)}\n${content.slice(start)}`;
    const target = safePath(root, relative);
    const stat = fs.lstatSync(target, { throwIfNoEntry: false });
    const existing = stat?.isFile() ? fs.readFileSync(target, 'utf8') : null;
    const current = existing?.replaceAll('\r\n', '\n');
    const status = !stat ? 'create' : current === next ? 'unchanged' : current && owned(current, relative) ? 'update' : 'conflict';
    return { id, name, path: relative, status, next, existing };
  });
  const conflicts = files.filter(file => file.status === 'conflict').map(file => file.path);
  const result = { status: conflicts.length ? 'conflicts' : apply ? 'configured' : 'preview', exitCode: conflicts.length ? 1 : 0, host, roles: files.map(({ id, name, path, status }) => ({ id, name, path, status })), changed: [], conflicts };
  if (!apply || conflicts.length) return result;

  for (const file of files) {
    if (file.status === 'unchanged') continue;
    const target = safePath(root, file.path);
    if (file.status === 'create') {
      // Exclusive creation preserves a file that appeared after the preview.
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.next, { flag: 'wx' });
    } else {
      if (fs.readFileSync(target, 'utf8') !== file.existing) throw new Error(`Role file changed: ${file.path}`);
      atomicWrite(root, file.path, file.next);
    }
    result.changed.push(file.path);
  }
  return result;
}
