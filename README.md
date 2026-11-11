# Harness Kit

Harness Kit 帮你把编码 Agent 接入现有项目，运行项目里的测试，并保存下次继续工作需要的信息。安装 Skill 或插件后，在 Agent 会话中说明目标即可开始。

[快速开始](#快速开始) · [安装指南](docs/public/guides/installation.md) · [使用指南](docs/public/guides/usage.md) · [版本下载](https://github.com/abcde1239/harness-kit/releases)

## 它能帮你做什么

- **接入已有项目。** 为所选 Agent 配置项目指令，保留现有框架、测试布局和用户修改。
- **接续未完成的工作。** 保存任务目标、验收条件、备注和下一步，供新会话或其他 Agent 接手。
- **检查改动是否通过验证。** 运行项目已有的测试和检查；源码或配置变化后，之前的验证结果会过期。

小改动直接实施和验证，复杂任务再保存计划、分工和交接。可以继续使用 Superpowers、OpenSpec 或团队已有的开发流程。

## 快速开始

需要 **Bun ≥ 1.3.4**；Git 相关检查另需 Git。Skill 和插件可直接使用，无需运行 `bun setup` 或安装全局 `harness` 命令。

### 安装 Skill

下载 [harness-kit-skill-0.5.0.zip](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-skill-0.5.0.zip)，把完整 harness-kit 目录放入宿主的技能目录。以 Codex 用户目录为例：

```text
~/.agents/skills/harness-kit/
├── SKILL.md
├── scripts/
├── references/
└── agents/
```

开启新会话，确认技能已被发现，然后说：

```text
使用 harness-kit 接入当前项目，保留现有框架，并运行项目已有的测试。
```

接入后，你可以继续提出开发任务：

```text
使用 harness-kit 实现分页功能，保存任务和验收条件，方便下次继续。
```

### 使用插件

| 宿主 | 安装包 |
|---|---|
| Codex / Claude Code | [Marketplace ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-marketplace-0.5.0.zip) |
| DeepSeek Harness | [DSH 原生插件 ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-dsh-0.5.0.zip) |

解压后按[安装指南](docs/public/guides/installation.md)中的宿主命令安装。请使用上述安装附件；GitHub 的 Source code 下载用于源码开发。

## 怎么工作

1. **接入项目。** 识别工作区、现有指令和测试命令，为所选宿主补充项目入口，保留已有内容。
2. **推进任务。** 按项目要求实施改动。需要跨会话恢复或协作时，保存目标、验收项和交接信息。
3. **验证结果。** 运行测试和检查，核对验收条件。保存为工作任务时，只有当前完整验证通过、验收项逐一确认后，才能标记完成。

多 Agent 协作提供分工、复核和交接提示词，由宿主的委派工具执行。具体能力与限制见[能力说明](docs/public/reference/capabilities.md)。

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

偏好手动操作时，可在源码目录运行可选的 `bun run setup`，安装短命令：

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
- [v0.5.0 版本说明](docs/public/releases/v0.5.0.md)

在源码目录验证和打包：

```sh
bun run verify
bun run harness check --json
bun run package:distribution <新的输出目录>
```
