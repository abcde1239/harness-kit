# 安装指南

[文档导航](/) · [日常使用](usage.md)

从 [v0.7.0 Release](https://github.com/abcde1239/harness-kit/releases/tag/v0.7.0) 下载一种安装包。Skill 和插件都包含完整 CLI，**不需要运行 bun setup、配置 Harness Kit 的 PATH 或安装全局 harness 命令**。需要 Node.js ≥ 22.12.0 或 Bun ≥ 1.3.4，二选一。Git 功能另需 Git，包内不附带运行时。

## 把链接交给 Agent

将仓库链接交给 Agent。它会读取当前源码的安装入口，并安装最新正式 Release；也可以提供 Release 链接固定版本：

```text
Read https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md.
Install the Harness Kit plugin from https://github.com/abcde1239/harness-kit.
Ask whether I want the default location or a custom directory, then complete installation and configuration.
```

Agent 从你提供的[安装入口](https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md)开始，识别目标宿主并显示默认绝对路径。选定位置后，独立安装器下载同一 Release 的匹配包与 SHA256SUMS，校验并注册插件；已有文件或来源冲突会保留并说明。安装后会核对宿主状态，必要时提示新会话或重启。用户无需手动解压或运行 setup。

Windows 默认保存到 `%LOCALAPPDATA%/harness-kit/plugins/<宿主>`，其他平台为 `~/.local/share/harness-kit/plugins/<宿主>`；可自选持久目录。宿主内部缓存位置由宿主管理。独立 Skill 模式默认 `~/.agents/skills/harness-kit`，自定义位置必须符合目标宿主实际发现设置。

Release 附件包含 `AGENT-INSTALL.md` 和独立的 `install-plugin.mjs`，无需克隆源码。未答复位置问题时脚本只返回问题，不会开始安装。DSH 需明确实际 profile；没有 DSH CLI 时不伪称原生安装成功。

手动调用示例：

```text
node install-plugin.mjs --source https://github.com/abcde1239/harness-kit/releases/tag/v0.7.0 --host codex --location default
```

v0.7.0 安装器与包内 CLI 均支持 Node.js 或 Bun；使用 Bun 时将命令中的 node 替换为 bun。旧 v0.5.0 包仍需 Bun。

自选目录使用 `--location <绝对路径>`，预览加 `--dry-run`。Claude 使用 `--host claude`；DSH 使用 `--host dsh --profile <实际profile>`。同名 marketplace 已指向其他来源时先审阅冲突，不静默覆盖。只安装插件不会自动改当前项目的测试或可见性配置。

## 独立 Skill

下载 `harness-kit-skill-0.7.0.zip`，将其中完整 harness-kit 目录放在宿主技能根的直接下一层。Codex 可使用：

```text
<项目>/.agents/skills/harness-kit/SKILL.md
<用户目录>/.agents/skills/harness-kit/SKILL.md
```

DSH 启用原生 Skill 文件系统 provider 时可使用 `<项目>/.dsh/skills/harness-kit` 或 `.agents/skills/harness-kit`。其他宿主按实际 Skill 发现配置选择目录，不能假定它们都扫描同一路径。

保留 SKILL.md、scripts、references 和 agents；不要只复制 SKILL.md，也不要多套一层 harness-kit。请使用安装 ZIP：源码 `skills/harness-kit/scripts/harness.mjs` 是依赖源码树的开发入口，单独复制源码技能目录无法替代分发包。

## Codex 插件

下载 `harness-kit-marketplace-0.7.0.zip`，解压后用其中 marketplace 目录的绝对路径：

```powershell
codex plugin marketplace add "D:/tools/harness-kit/marketplace"
codex plugin add harness-kit@harness-kit-local
```

以上命令已在 Codex CLI 0.154.0 的隔离配置中实测。旧版本若没有 plugin add，可按[官方打包文档](https://developers.openai.com/plugins/build/plugins)，重启支持插件的桌面应用，在 Plugins Directory 选择本地源并安装。添加 marketplace 只注册来源，第二步才安装插件。

## Claude Code 插件

使用同一 marketplace ZIP：

```powershell
claude plugin marketplace add "D:/tools/harness-kit/marketplace"
claude plugin install harness-kit@harness-kit-local
```

已在 Claude Code 2.1.167 隔离配置中实测安装。可用 `claude plugin list` 查看状态；临时加载可用 `claude --plugin-dir "<marketplace绝对路径>/plugins/harness-kit"`。插件技能可能带命名空间，以实际发现结果为准。[官方 marketplace 文档](https://code.claude.com/docs/en/plugins/create-marketplace.md)提供宿主详细说明。

## DeepSeek Harness 原生插件

下载 `harness-kit-dsh-0.7.0.zip`，将路径替换为解压后 harness-kit 包根的绝对路径：

```powershell
dsh plugin --profile web add "D:/tools/harness-kit-native/harness-kit"
```

web 替换为实际 profile。Desktop 用户先退出应用，使用 **Desktop 自带的 dsh 命令**和 desktop profile；npm 安装的 CLI 不管理 desktop。保留解压目录，本地依赖可能链接到该目录。

包通过 dsh.bundle.patch 激活原生 Cordis 插件，向 skills 服务注册内置 Skill，正文按需读取。对应 profile 需提供 skills 服务和调用工具；安装后重启 profile。注册不需要 Harness Kit 的执行运行时；CLI 支持 Node.js 或 Bun。

兼容声明为 DSH `>=0.2.2-rc.1 <0.3.0`，依据[官方固定提交](https://github.com/deepseek-ai/deepseek-harness/tree/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159)核实。DSH 仍为 developer preview。本版通过生成插件的接口契约测试，尚未实测真实 DSH profile 安装与会话发现。

撤销安装：`dsh plugin --profile web remove dsh-plugin-harness-kit`，再重启 profile。卸载插件不回滚另行执行 init 写入的项目文件。

## 确认可用

开启新会话，确认宿主发现 harness-kit，再提出：

```text
Use harness-kit to onboard and verify this project, preserve its framework, and keep internal development documents private.
```

Agent 根据实际加载的 SKILL.md 位置调用：

```text
node <已安装技能目录>/scripts/harness.mjs <command> --root <项目绝对路径> --json
```

插件安装、项目指令生成、命令验证成功与模型会话实际加载是不同事实。Codex/Claude 原生 CLI 安装已实测；本版尚未用真实模型会话验收各宿主技能发现，不因目录存在就宣称加载成功。

## 升级与常见问题

- **升级 Skill**：保留自己的定制，替换完整分发目录并开启新会话。先检查是否存在多份同名 Skill，避免误用旧版本。
- **升级本地插件**：保留原目录，按宿主机制更新来源或重新安装并启用新版本；仅覆盖 ZIP 不保证缓存已更新。以实际安装位置的脚本版本和新会话发现结果为准。
- **找不到运行时**：可使用 Node.js ≥ 22.12.0 或 Bun ≥ 1.3.4；v0.5.0 包仍需 Bun。setup 不安装运行时，配置了 bun test 等项目命令时仍需项目工具链。PATH 中有代理时核对实际执行文件。
- **找不到 harness**：Skill/插件正常使用不需要此全局命令；终端短命令是可选能力，见[使用指南](usage.md)。
- **下载 Source code 后不能独立安装 Skill**：使用命名为 harness-kit-skill、harness-kit-marketplace 或 harness-kit-dsh 的 Release 附件。

Release 附带 SHA256SUMS，可用 `Get-FileHash <ZIP> -Algorithm SHA256` 或 `sha256sum <ZIP>` 校验。GitHub Release 下载与宿主公共插件目录上架是不同渠道；本项目不因发布 Release 自动上架 OpenAI、Anthropic 或 npm。
