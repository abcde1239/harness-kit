# Harness Kit

[简体中文](README.md) · [English](README.en.md)

Harness Kit 帮你把编码 Agent 接入现有项目，运行项目里的测试，并保存下次继续工作需要的信息。安装 Skill 或插件后，在 Agent 会话中说明目标即可开始。

[快速开始](#让-agent-安装已发布版本) · [安装指南](docs/public/guides/installation.md) · [使用指南](docs/public/guides/usage.md) · [版本下载](https://github.com/abcde1239/harness-kit/releases)

## 它能帮你做什么

- **接入已有项目。** 为所选 Agent 配置项目指令，保留现有框架、测试布局和用户修改。
- **接续未完成的工作。** 保存任务目标、验收条件、备注和下一步，供新会话或其他 Agent 接手。
- **协调多 Agent 协作。** 按任务分配职责，使用角色提示词和宿主委派工具推进协作。
- **整理自己的编码习惯。** 从指定项目提炼有代码依据的风格和架构规则，按适用范围用于后续开发与复核，见[使用方法](docs/public/guides/coding-style.md)。

项目接入支持常见技术栈的工作区识别，也可用 `harness.adapters.json` 声明自定义标记、命令和测试路径，见[适配器参考](skills/harness-kit/references/adapters.md)。

小改动直接实施和验证，复杂任务再保存计划、分工和交接。可以继续使用 Superpowers、OpenSpec 或团队已有的开发流程。

## 环境配置

需要 **Node.js ≥ 22.12.0 或 Bun ≥ 1.3.4**；Git 相关检查另需 Git。Skill 和插件可直接使用，无需运行 `bun setup` 或安装全局 `harness` 命令。

## 让 Agent 安装已发布版本

将仓库链接交给 Agent，它会读取[安装入口](INSTALL.md)，询问默认或自定义位置，再下载、校验并配置已发布插件。无需手动解压或运行 `bun setup`。

可直接复制以下请求；要固定安装版本时，将仓库链接替换为对应 Release 链接：

```text
Read https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md.
Install the Harness Kit plugin from https://github.com/abcde1239/harness-kit.
First ask whether I want the default installation location or a custom directory, then install and configure it for the current host.
```

Agent 会显示完整安装路径，保留已有修改，并核对宿主插件状态。自选位置用于保存插件源文件，宿主缓存仍由宿主管理；安装后可能需要重启或开启新会话。

安装器与插件安装包均来自所选 Release。使用仓库链接时安装最新正式版，也可以提供 Release 链接固定版本。

## 手动安装

### 安装 Skill

下载 [harness-kit-skill-0.7.0.zip](https://github.com/abcde1239/harness-kit/releases/download/v0.7.0/harness-kit-skill-0.7.0.zip)，把完整 harness-kit 目录放入宿主的技能目录。以 Codex 用户目录为例：

```text
~/.agents/skills/harness-kit/
├── SKILL.md
├── scripts/
├── references/
└── agents/
```

开启新会话，确认技能已被发现，然后说：

```text
Use harness-kit to onboard this project, preserve its framework, and run its existing tests.
```

接入后，你可以继续提出开发任务：

```text
Use harness-kit to implement pagination and save the task and acceptance criteria for the next session.
```

### 使用插件

| 宿主 | 安装包 |
|---|---|
| Codex / Claude Code | [Marketplace ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.7.0/harness-kit-marketplace-0.7.0.zip) |
| DeepSeek Harness | [DSH 原生插件 ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.7.0/harness-kit-dsh-0.7.0.zip) |

解压后选择对应宿主的命令，将路径替换为解压目录的绝对路径：

```sh
# Codex: use the extracted marketplace directory
codex plugin marketplace add "<absolute-marketplace-path>"
codex plugin add harness-kit@harness-kit-local

# Claude Code: use the same marketplace package
claude plugin marketplace add "<absolute-marketplace-path>"
claude plugin install harness-kit@harness-kit-local

# DeepSeek Harness: use the extracted harness-kit package root
dsh plugin --profile <actual-profile> add "<absolute-harness-kit-package-path>"
```

保留解压目录。DSH 为实验支持，需替换为实际 profile，Desktop 使用自带 CLI。按宿主要求重启或开启新会话，并确认技能已出现。兼容范围与排障见[安装指南](docs/public/guides/installation.md)。GitHub 的 Source code 下载用于源码开发，安装请选择上面的附件。

## 怎么工作

1. **接入项目。** 识别工作区、现有指令和测试命令，为所选宿主补充项目入口，保留已有内容。
2. **推进任务。** 按项目要求实施改动。需要跨会话恢复或协作时，保存目标、验收项和交接信息。
3. **验证结果。** 运行测试和检查，核对验收条件。保存为工作任务时，只有当前完整验证通过、验收项逐一确认后，才能标记完成。

多 Agent 协作提供[职责分配与角色提示词](skills/harness-kit/references/roles.md)，可按需选择产品经理、UX/UI、架构、前端、后端、测试、代码复核、文档审读和 Agent 专家，由宿主的委派工具执行。具体能力与限制见[能力说明](docs/public/reference/capabilities.md)。

维护的 Agent 指令与提示词模板使用英文；面向用户的回复遵循用户偏好，用户原文与代码保持原样。

## 支持的 Agent

| Agent | 项目指令入口 | 原生插件 |
|---|---|---|
| Codex | AGENTS.md | 支持 |
| Claude Code | CLAUDE.md | 支持 |
| Gemini CLI | GEMINI.md | 暂无 |
| Cursor | .cursor/rules/harness-kit.mdc | 暂无 |
| OpenCode | AGENTS.md | 暂无 |
| DeepSeek Harness | AGENTS.md | 实验支持 |

Gemini CLI、Cursor 和 OpenCode 可通过 CLI 的 `init --hosts` 生成项目指令，具体步骤见[使用指南](docs/public/guides/usage.md)。DSH 插件按 developer preview 接口开发，尚未在实际 DSH 环境中验证安装；尝试前请查看[安装指南](docs/public/guides/installation.md)中的兼容范围。

## 终端用法

偏好手动操作时，先在源码目录安装依赖（`npm install` 或 `bun install`），再运行可选的 `node scripts/install.mjs`，安装短命令。使用 Bun 时将 node 替换为 bun：

```sh
harness init      # 接入项目，运行首次验证
harness run       # 检查约定并运行配置的任务
harness check     # 只检查项目约定
harness doctor    # 诊断接入状态和验证记录
```

裸命令 `harness` 打开中文菜单；`harness help --all` 查看高级用法。项目配置、monorepo、可恢复任务和可选 hooks 见[使用指南](docs/public/guides/usage.md)。

## 文档与开发

- [文档导航](docs/public/README.md)
- [多 Agent 协作](skills/harness-kit/references/collaboration.md)
- [可恢复任务](skills/harness-kit/references/tasks.md)
- [v0.7.0 版本说明](docs/public/releases/v0.7.0.md)

在源码目录验证和打包；`node scripts/verify.mjs` 运行 Node 集成测试，`bun run verify:bun` 运行原有完整测试：

```sh
npm install
node scripts/verify.mjs
node bin/harness.mjs check --json
node scripts/package-distribution.mjs <新的输出目录>
```
