# 安装指南

[文档导航](../README.md) · [日常使用](usage.md)

从 [v0.5.0 Release](https://github.com/abcde1239/harness-kit/releases/tag/v0.5.0) 下载一种安装包。Skill 和插件都包含完整 CLI，**不需要运行 bun setup、配置 Harness Kit 的 PATH 或安装全局 harness 命令**。Bun ≥ 1.3.4 必须在 Agent 执行环境可用；Git 功能另需 Git。分发包不附带 Bun。

## 独立 Skill

下载 `harness-kit-skill-0.5.0.zip`，将其中完整 harness-kit 目录放在宿主技能根的直接下一层。Codex 可使用：

```text
<项目>/.agents/skills/harness-kit/SKILL.md
<用户目录>/.agents/skills/harness-kit/SKILL.md
```

DSH 启用原生 Skill 文件系统 provider 时可使用 `<项目>/.dsh/skills/harness-kit` 或 `.agents/skills/harness-kit`。其他宿主按实际 Skill 发现配置选择目录，不能假定它们都扫描同一路径。

保留 SKILL.md、scripts、references 和 agents；不要只复制 SKILL.md，也不要多套一层 harness-kit。请使用安装 ZIP：源码 `skills/harness-kit/scripts/harness.mjs` 是依赖源码树的开发入口，单独复制源码技能目录无法替代分发包。

## Codex 插件

下载 `harness-kit-marketplace-0.5.0.zip`，解压后用其中 marketplace 目录的绝对路径：

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

下载 `harness-kit-dsh-0.5.0.zip`，将路径替换为解压后 harness-kit 包根的绝对路径：

```powershell
dsh plugin --profile web add "D:/tools/harness-kit-native/harness-kit"
```

web 替换为实际 profile。Desktop 用户先退出应用，使用 **Desktop 自带的 dsh 命令**和 desktop profile；npm 安装的 CLI 不管理 desktop。保留解压目录，本地依赖可能链接到该目录。

包通过 dsh.bundle.patch 激活原生 Cordis 插件，向 skills 服务注册内置 Skill，正文按需读取。对应 profile 需提供 skills 服务和调用工具；安装后重启 profile。注册不需要 Bun，实际执行包内 CLI 才需要 Bun。

兼容声明为 DSH `>=0.2.2-rc.1 <0.3.0`，依据[官方固定提交](https://github.com/deepseek-ai/deepseek-harness/tree/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159)核实。DSH 仍为 developer preview。本版通过生成插件的接口契约测试，尚未实测真实 DSH profile 安装与会话发现。

撤销安装：`dsh plugin --profile web remove dsh-plugin-harness-kit`，再重启 profile。卸载插件不回滚另行执行 init 写入的项目文件。

## 确认可用

开启新会话，确认宿主发现 harness-kit，再提出：

```text
使用 harness-kit 接入当前项目并验证，保留现有框架，内部开发文档不公开。
```

Agent 根据实际加载的 SKILL.md 位置调用：

```text
bun <已安装技能目录>/scripts/harness.mjs <command> --root <项目绝对路径> --json
```

插件安装、项目指令生成、命令验证成功与模型会话实际加载是不同事实。Codex/Claude 原生 CLI 安装已实测；本版尚未用真实模型会话验收各宿主技能发现，不因目录存在就宣称加载成功。

## 升级与常见问题

- **升级 Skill**：保留自己的定制，替换完整分发目录并开启新会话。先检查是否存在多份同名 Skill，避免误用旧版本。
- **升级本地插件**：保留原目录，按宿主机制更新来源或重新安装并启用新版本；仅覆盖 ZIP 不保证缓存已更新。以实际安装位置的脚本版本和新会话发现结果为准。
- **找不到 bun**：在 Agent 执行环境安装或配置 Bun；setup 不负责安装 Bun。PATH 中有下载代理时，确认使用的实际 Bun 可执行文件。
- **找不到 harness**：Skill/插件正常使用不需要此全局命令；终端短命令是可选能力，见[使用指南](usage.md)。
- **下载 Source code 后不能独立安装 Skill**：使用命名为 harness-kit-skill、harness-kit-marketplace 或 harness-kit-dsh 的 Release 附件。

Release 附带 SHA256SUMS，可用 `Get-FileHash <ZIP> -Algorithm SHA256` 或 `sha256sum <ZIP>` 校验。GitHub Release 下载与宿主公共插件目录上架是不同渠道；本项目不因发布 Release 自动上架 OpenAI、Anthropic 或 npm。
