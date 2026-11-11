import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { version, description } from '../package.json';
import { hash, json, safePath } from '../src/fs.mjs';
import { skillFiles } from './package-skill.mjs';
import { validateSkill } from './validate-skill.mjs';
import { zipFiles } from './archive.mjs';
import { dshPluginFiles } from './dsh-plugin.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = (files, directory) => new Map([...files].map(([name, bytes]) => [`${directory}/${name}`, bytes]));
const metadata = () => ({name:'harness-kit',version,description,author:{name:'Harness Kit contributors'}});
export function pluginFiles(skill) {
  return new Map([
    ['plugin.json', Buffer.from(json({$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',...metadata()}))],
    ['.claude-plugin/plugin.json', Buffer.from(json(metadata()))],
    ...prefix(skill, 'skills/harness-kit'),
  ]);
}
function marketplaces(plugin) {
  return new Map([
    ['.agents/plugins/marketplace.json', Buffer.from(json({name:'harness-kit-local',plugins:[{name:'harness-kit',source:{source:'local',path:'./plugins/harness-kit'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]}))],
    ['.claude-plugin/marketplace.json', Buffer.from(json({name:'harness-kit-local',description:'Harness Kit portable Skill and project verification plugin',owner:{name:'Harness Kit contributors'},plugins:[{name:'harness-kit',source:'./plugins/harness-kit',description}]}))],
    ...prefix(plugin,'plugins/harness-kit'),
  ]);
}
const instructions = `# Harness Kit ${version}

安装任选一种，不需要运行 bun setup。内置脚本需要 Bun >= 1.3.4；Git检查另需Git。

## Skill

将 harness-kit-skill-${version}.zip 解压后的 harness-kit 完整目录放进宿主原生技能目录。
Codex 可使用 ~/.agents/skills/harness-kit；DSH 可使用 <project>/.dsh/skills/harness-kit。
确认目录内直接包含 SKILL.md、scripts 和 references。在新会话要求使用 Harness Kit 接入当前项目。
Agent 使用 bun <安装后的技能绝对路径>/scripts/harness.mjs <command> --root <项目绝对路径> --json。

## Codex 插件

解压 harness-kit-marketplace-${version}.zip 后，使用 marketplace 目录的绝对路径：
codex plugin marketplace add <marketplace绝对路径>
codex plugin add harness-kit@harness-kit-local
上述完整流程已在 Codex CLI 0.154.0 实测；旧版本若无 plugin add，请在支持插件的桌面界面安装。
开始新会话确认实际技能发现；添加 marketplace 本身不等于安装插件。

## Claude Code 插件

claude plugin marketplace add <marketplace绝对路径>
claude plugin install harness-kit@harness-kit-local
也可用 claude --plugin-dir <marketplace绝对路径>/plugins/harness-kit 临时加载。

## DSH 原生插件

解压 harness-kit-dsh-${version}.zip，使用 harness-kit 包根目录的绝对路径：
dsh plugin --profile web add <harness-kit绝对路径>
撤销：dsh plugin --profile web remove dsh-plugin-harness-kit
web 替换为实际 profile；本地依赖可能链接源目录，请保留该目录。
Desktop 请先退出应用，使用 Desktop 自带的 dsh 和 desktop profile；npm CLI 不管理 Desktop。
安装后重启 profile；原生插件向 skills 服务注册内置 Skill，CLI仍使用技能包内脚本。
兼容契约为 DSH >=0.2.2-rc.1 <0.3.0，需 profile 提供 skills 及调用工具；详情见包内 README.md。

## 运行与发布边界

插件和Skill安装不会创建全局harness短命令。需要人类短命令时才使用源码安装器。
首次项目接入由Agent调用init，并保留可见性/测试等必要业务选择。
这些是本地分发产物，未代表已发布到公共仓库、npm或插件目录。
宿主扫描/信任/启用与工具权限以实际环境为准；安装包没有自动执行安装或启动脚本。
`;

export async function packageDistribution(destination = path.join(repository,'artifacts/distribution',version)) {
  destination = path.resolve(destination);
  const volume = path.parse(destination).root;
  safePath(volume,path.relative(volume,destination).split(path.sep).join('/'));
  if (fs.existsSync(destination)) throw new Error(`Distribution destination exists: ${destination}`);
  const skill = await skillFiles(), plugin = pluginFiles(skill), marketplace = marketplaces(plugin);
  const native = await dshPluginFiles(skill);
  const files = new Map([
    ...prefix(skill,'skill/harness-kit'), ...prefix(marketplace,'marketplace'), ...prefix(native,'native-dsh/harness-kit'),
    [`harness-kit-skill-${version}.zip`,zipFiles(prefix(skill,'harness-kit'))],
    [`harness-kit-marketplace-${version}.zip`,zipFiles(prefix(marketplace,'marketplace'))],
    [`harness-kit-dsh-${version}.zip`,zipFiles(prefix(native,'harness-kit'))],
    ['INSTALL.md',Buffer.from(instructions)],
  ]);
  const entries=[...files].map(([name,bytes])=>({path:name,sha256:hash(bytes),bytes:bytes.length}));
  files.set('distribution.json',Buffer.from(json({version,requirements:{bun:'>=1.3.4'},entries})));
  files.set('SHA256SUMS',Buffer.from(entries.filter(e=>e.path.endsWith('.zip')).map(e=>`${e.sha256}  ${e.path}`).join('\n')+'\n'));
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  const staging = `${destination}.staging-${crypto.randomUUID()}`;
  fs.mkdirSync(staging);
  try {
    for (const [name,bytes] of files) {
      const target=safePath(staging,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
    }
    for(const directory of ['skill/harness-kit','marketplace/plugins/harness-kit/skills/harness-kit','native-dsh/harness-kit/skills/harness-kit']) validateSkill(safePath(staging,directory));
    // Recheck before the final rename; never merge a package into user files.
    if(fs.existsSync(destination))throw new Error(`Distribution destination appeared: ${destination}`);
    fs.renameSync(staging,destination);
  } catch(error) {
    if(path.dirname(staging)!==path.dirname(destination)||!path.basename(staging).startsWith(path.basename(destination)+'.staging-'))throw new Error('Unsafe staging cleanup');
    fs.rmSync(staging,{recursive:true,force:true});throw error;
  }
  return {status:'packaged',version,destination,archives:entries.filter(e=>e.path.endsWith('.zip')),files:files.size,requiresSetup:false,runtime:'Bun >= 1.3.4',published:false};
}
if(import.meta.main) {
  try {
    if(process.argv.length>3)throw new Error('Usage: bun scripts/package-distribution.mjs [new-output-directory]');
    console.log(json(await packageDistribution(process.argv[2])));
  } catch(error) {console.error(error.message);process.exitCode=2;}
}
