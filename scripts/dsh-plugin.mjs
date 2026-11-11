import { version } from '../package.json';
import { relativePath } from '../src/fs.mjs';

export const DSH_PLUGIN_PACKAGE = 'dsh-plugin-harness-kit';
export const DSH_CONTRACT_SHA = 'fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159';

function invocationFlag(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' || typeof value === 'number') {
    if (/^(true|yes|on|1)$/i.test(String(value))) return true;
    if (/^(false|no|off|0)$/i.test(String(value))) return false;
  }
  throw new Error(`Invalid Skill invocation field: ${label}`);
}

function pluginEntry(summary, frontmatter) {
  return `import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'harness-kit';
export const inject = ['skills'];
const summary = ${JSON.stringify(summary)};
const expectedFrontmatter = ${JSON.stringify(frontmatter)};
const pluginRoot = path.dirname(fileURLToPath(import.meta.url));
const resourceRoot = path.join(pluginRoot, 'skills', 'harness-kit');
const instructionFile = path.join(resourceRoot, 'SKILL.md');
const providerName = 'harness-kit-bundled';

// The registration is a Cordis-owned effect. Unloading unregisters the provider
// and aborts its control.signal; this plugin owns no watcher, process or server.
export function apply(ctx) {
  if (typeof ctx.skills?.registerProvider !== 'function') throw new Error('Harness Kit requires the DSH skills registry service');
  ctx.skills.registerProvider(control => {
    const signalFor = options => AbortSignal.any([control.signal, ...(options?.signal ? [options.signal] : [])]);
    async function checkResources(signal) {
      signal.throwIfAborted();
      const realRoot = await fs.realpath(pluginRoot);
      for (const target of [path.join(pluginRoot, 'skills'), resourceRoot, instructionFile]) {
        const stat = await fs.lstat(target);
        if (stat.isSymbolicLink()) throw new Error('Harness Kit bundled resources must not be symlinks');
        if (target === instructionFile ? !stat.isFile() : !stat.isDirectory()) throw new Error('Invalid Harness Kit bundled resource type');
        const relative = path.relative(realRoot, await fs.realpath(target));
        if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Harness Kit resource escapes plugin directory');
      }
      signal.throwIfAborted();
    }
    const candidate = () => ({ ...summary, invocation: { ...summary.invocation }, path: instructionFile,
      resourceBase: { kind: 'directory', path: resourceRoot }, source: 'bundled', provider: providerName,
      rank: 600, locator: 'harness-kit' });
    return {
      name: providerName,
      async list(options = {}) {
        const signal = signalFor(options);
        await checkResources(signal);
        return [candidate()];
      },
      async get(selected, options = {}) {
        const signal = signalFor(options);
        signal.throwIfAborted();
        if (selected?.name !== summary.name || selected.provider !== providerName || selected.locator !== 'harness-kit') return undefined;
        await checkResources(signal);
        const text = await fs.readFile(instructionFile, { encoding: 'utf8', signal });
        signal.throwIfAborted();
        const match = /^(?:\\uFEFF)?---\\r?\\n([\\s\\S]*?)\\r?\\n---(?:\\r?\\n|$)/.exec(text);
        if (!match || match[1].replaceAll('\\r\\n', '\\n') !== expectedFrontmatter) throw new Error('Harness Kit Skill metadata changed; rebuild or reinstall the plugin');
        const { rank, locator, ...definition } = candidate();
        return { ...definition, content: text.slice(match[0].length).trim() };
      },
    };
  });
}
`;
}

function readme() {
  return `# Harness Kit — DeepSeek Harness 原生插件

这是本地安装包，未发布到 npm。它通过 DSH 原生 Cordis 插件注册完整 Harness Kit Skill，无需运行 bun run setup 或复制到 Codex 目录。

解压后，使用实际 profile 安装本目录（替换为绝对路径）：

\x60\x60\x60powershell
dsh plugin --profile web add "D:/plugins/harness-kit"
\x60\x60\x60

其他环境将 web 替换为实际 profile。桌面先完全退出应用，使用 Desktop 自带的 dsh 命令执行 \x60dsh plugin --profile desktop add "D:/plugins/harness-kit"\x60；npm CLI 不管理 desktop profile。保留目录；本地依赖可能引用它。

DSH 的 add 会安装并选择包中声明的 bundle；包无需构建、依赖安装脚本或额外 JavaScript 包。重新启动对应 profile，或在启用 HMR 时等待重载。插件页可查看 Harness Kit 条目；启用了原生 skill 工具的会话应发现 \x60harness-kit\x60，再按需加载。该插件依赖宿主 skills 注册服务；精简或自定义 profile 需先具备该服务及相应 skill 消费工具。不要仅凭文件存在宣称宿主已加载。

插件加载只注册 Skill，不自动扫描项目、运行命令、写项目指令或启动后台服务。Skill 的工具脚本位于 \x60skills/harness-kit/scripts/harness.mjs\x60，实际运行 CLI 时仍需 Bun >= 1.3.4；Git 功能另需 Git。调用形式：\x60bun <本目录>/skills/harness-kit/scripts/harness.mjs doctor --root <项目绝对路径> --json\x60。接入项目时选 \x60init --hosts dsh\x60，不会因安装插件自动改变项目。

原生 provider 的目录资源根固定在插件内的 \x60skills/harness-kit\x60；Skill 正文按需读取，metadata 在打包时固定，修改 metadata 后需重新打包安装。项目/用户同名 Skill 的较高优先级可能覆盖 bundled provider。卸载或禁用后，Cordis 会撤销 provider；已在历史中加载的指令需通过新会话清除。

撤销安装：\x60dsh plugin --profile web remove ${DSH_PLUGIN_PACKAGE}\x60，再重新启动对应 profile；也可通过 DSH 插件页面关闭/移除 bundle。卸载不会回滚另行执行 init 写入的项目文件。

兼容接口依据官方 deepseek-ai/deepseek-harness 源码提交 ${DSH_CONTRACT_SHA}（0.2.2-rc.1）。本包声明 \x60engines.dsh: >=0.2.2-rc.1 <0.3.0\x60；其他版本需重新核实接口，未把契约测试当作真实宿主加载证明。
`;
}

/** Build a dependency-free native DSH bundle from the complete portable Skill. */
export async function dshPluginFiles(skillFilesMap) {
  if (!(skillFilesMap instanceof Map)) throw new Error('Expected a Map of portable Skill files');
  const result = new Map(), seen = new Set();
  for (const [name, bytes] of skillFilesMap) {
    const normalized = relativePath(name);
    if (normalized !== name || normalized === '.' || seen.has(normalized.toLowerCase())) throw new Error(`Invalid or duplicate Skill resource: ${name}`);
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new Error(`Skill resource must contain bytes: ${name}`);
    seen.add(normalized.toLowerCase()); result.set(`skills/harness-kit/${name}`, Buffer.from(bytes));
  }
  const source = result.get('skills/harness-kit/SKILL.md')?.toString('utf8');
  const match = source && /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new Error('Portable Skill requires SKILL.md YAML frontmatter');
  const metadata = Bun.YAML.parse(match[1]);
  if (metadata?.name !== 'harness-kit' || typeof metadata.description !== 'string' || !metadata.description.trim()) throw new Error('Expected harness-kit Skill name and description');
  if (!result.has('skills/harness-kit/scripts/harness.mjs')) throw new Error('Portable Skill is missing its bundled CLI');
  const summary = { name: metadata.name, description: metadata.description, invocation: {
    modelInvocable: !invocationFlag(metadata['disable-model-invocation'], false, 'disable-model-invocation'),
    userInvocable: invocationFlag(metadata['user-invocable'], true, 'user-invocable'),
  } };
  if (metadata.whenToUse !== undefined) {
    if (typeof metadata.whenToUse !== 'string') throw new Error('Skill whenToUse must be a string');
    summary.whenToUse = metadata.whenToUse;
  }
  if (metadata.metadata !== undefined) {
    if (!metadata.metadata || typeof metadata.metadata !== 'object' || Array.isArray(metadata.metadata)) throw new Error('Skill metadata must be an object');
    summary.metadata = metadata.metadata;
  }
  const manifest = { name: DSH_PLUGIN_PACKAGE, version, description: 'Harness Kit project onboarding, resumable work and verification as a native DeepSeek Harness Skill',
    private: true, type: 'module', main: './index.mjs', exports: { '.': './index.mjs', './package.json': './package.json', './cordis.patch.yml': './cordis.patch.yml' },
    files: ['index.mjs', 'cordis.patch.yml', 'README.md', 'skills'], engines: { dsh: '>=0.2.2-rc.1 <0.3.0' }, dsh: { bundle: { patch: './cordis.patch.yml' } } };
  result.set('package.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  result.set('index.mjs', Buffer.from(pluginEntry(summary, match[1].replaceAll('\r\n', '\n'))));
  result.set('cordis.patch.yml', Buffer.from(`- insert:\n    - id: harness-kit\n      name: '${DSH_PLUGIN_PACKAGE}'\n`));
  result.set('README.md', Buffer.from(readme()));
  return result;
}
