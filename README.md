# Harness Kit

为新旧项目接入 **Agent 指令与统一验证**，保留已有框架和用户修改。支持 Codex、Claude Code、Gemini CLI、Cursor、OpenCode、DeepSeek Harness（dsh），提供可恢复任务、monorepo、经授权的多 Agent 协作与按需公开检查。

安装自包含 **Skill 或本地插件包**，在 Agent 会话中说明目标即可使用，无需运行 setup 或配置 Harness Kit 的 PATH。执行验证仍需 **Bun ≥ 1.3.4**；Git 检查另需 Git。

## 安装

从 [v0.5.0 Release](https://github.com/abcde1239/harness-kit/releases/tag/v0.5.0) 选择一种安装包，具体命令见[安装指南](docs/public/guides/installation.md)：

- **Skill**：[下载 Skill ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-skill-0.5.0.zip)，将完整 harness-kit 目录放入宿主原生技能目录。
- **Codex / Claude 插件**：[下载 Marketplace ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-marketplace-0.5.0.zip)，添加其中 marketplace 目录，再安装 harness-kit@harness-kit-local。
- **DeepSeek Harness 原生插件**：[下载 DSH ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-dsh-0.5.0.zip)，通过 dsh plugin 安装解压后的包目录。

插件包含同一份打包 Skill。请使用上述命名附件；GitHub 自动生成的 Source code 是开发源码，其中 Skill 脚本是开发入口，单独复制源码技能目录不能替代自包含包。

在新会话中输入：

```text
使用 harness-kit 接入当前项目并验证，保留现有框架，内部开发文档不公开。
使用 harness-kit 实现这项改动，允许多 Agent 分工，集成后按项目要求验证。
```

Agent 直接调用已安装技能内的 `scripts/harness.mjs`，不需要全局 `harness` 命令。不同宿主或插件可能使用命名空间，以实际发现的技能为准。本地包与 marketplace 配置不代表已上架公共目录。

从源码生成分发包：`bun run package:distribution <新的输出目录>`。它同时生成独立 Skill、Codex/Claude 兼容的本地 marketplace、DSH 原生插件和对应 ZIP；已有输出目录不覆盖。

## 可选：终端短命令

习惯直接在终端操作时，才在源码目录运行 `bun run setup`，安装 `harness` 短命令；若 bin 目录不在 PATH，按安装器提示设置。Skill/插件用户无需这一步。

```sh
harness init     # 中文向导：接入、保留已有内容并运行首次验证
harness check    # 只检查项目约定
harness run      # 检查约定并执行项目已有的验证任务
```

也可以一次完成：`harness init --private --test "bun test ./tests" --yes`。已有测试脚本可识别时省略 `--test`。裸 `harness` 打开菜单；遇到接入或环境问题运行 `harness doctor`。

其他宿主用 `harness init --hosts claude,gemini,cursor,opencode,dsh --private --yes`，只需 DeepSeek Harness 时用 `--hosts dsh`（别名 `deepseek-harness`）。新项目只接入所选宿主，已有项目保留历史选择；默认接入 Codex。dsh 接入复用 AGENTS.md；其 developer preview 的 profile 和插件配置会影响实际加载，详见使用指南。

初始化建立宿主原生指令入口和治理配置，并报告首次验证结果。已有指令使用受管段合并；用户修改冲突保留。静态检查不代表真实 Agent 会话已加载，也不代表未配置的测试通过。

需要 Codex 本地会话自动检查验证证据时，使用 `harness init --hooks`，再在新会话 `/hooks` 中审阅信任。普通使用无需配置 hooks。

需要跨会话恢复时，使用 `harness task start <id> --title "目标" --accept "验收条件"` 保存任务，再用 `task resume` 接续、`run --work <id>` 验证。人工验收证据和当前完整验证均满足后才可 `task finish`，详见使用指南。

Skill 按任务选择轻量开发、修复、评审或协作流程，复用已有 Superpowers、OpenSpec 等工作流；多 Agent 需要宿主提供实际委派工具。旧命令继续兼容，高级接口见 `harness help --all`。

## 文档

- [文档导航](docs/public/README.md)：按安装、使用、能力与发布查阅
- [安装指南](docs/public/guides/installation.md)：独立 Skill、Codex/Claude 插件和 DSH 原生插件
- [能力与适用范围](docs/public/reference/capabilities.md)：当前解决的问题、差异与限制
- [使用指南](docs/public/guides/usage.md)：接入、诊断、验证记录与高级配置
- [目标项目布局](skills/harness-kit/references/project-layout.md)：生成范围、框架测试及 monorepo
- [多 Agent 协作提示词](skills/harness-kit/references/collaboration.md)：任务边界、验收、复核和交接
- [可恢复任务](skills/harness-kit/references/tasks.md)：目标、验收证据、恢复与完成门禁
- [公开与内部资料边界](docs/public/reference/publication-boundary.md)：按需发布检查
- [v0.5.0 版本说明](docs/public/releases/v0.5.0.md)：变更、升级和验证范围

开发验证：`bun run verify`；项目约定检查：`bun run harness check --json`。
