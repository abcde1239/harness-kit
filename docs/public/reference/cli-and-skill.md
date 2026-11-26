# CLI 与 Skill

Harness Kit 将宿主接入和项目执行分开：

| 层 | 作用 |
|---|---|
| Skill / 原生插件 | 让 Agent 宿主发现使用说明，提供英文工作指令、公开文档审读规则和宿主注册入口 |
| Bundled CLI | 读取项目配置、发现适配器、规划任务、运行原生命令并记录验证证据 |
| 项目配置与任务 | 说明工作区、测试、lint、类型检查、依赖和验收范围 |
| 项目原生工具 | 由项目自己的测试框架、包管理器和构建工具执行实际工作 |

分发 ZIP 已经包含完整 CLI。Agent 应从实际加载的 `SKILL.md` 定位脚本，并传入目标项目绝对路径：

```text
node <installed-skill-directory>/scripts/harness.mjs <command> --root <project-absolute-path>
```

需要结构化结果时加 `--json`。使用支持 `--brief` 的 CLI 处理持久任务时，可以先读取精简输出。

Node.js ≥ 22.12.0 与 Bun ≥ 1.3.4 均可运行 Harness Kit；目标项目的 `bun test`、`cargo test` 或其他任务命令仍使用项目自己声明的工具链。

## CLI 命令速查 {#command-reference}

表中命令以终端短命令 `harness` 为前缀。直接使用安装包或源码时，按上面的脚本方式传入子命令。在目标项目目录运行，或用 `--root` 指定目标项目。CLI 本身无需调用模型。标注「主要供 Agent 使用」的命令也可以手动运行。`init` 默认执行首次验证，`run` 执行项目配置的原生命令，Agent 可根据结果继续开发或审查。

### 项目接入与验证

| 命令 | 用途 |
|---|---|
| `harness` 或 `harness menu` | 在交互式终端打开菜单，可选择接入项目、运行验证或查看诊断。 |
| `init`（兼容 `setup`） | 生成或更新项目配置和宿主指令，默认执行首次验证。非交互调用需要 `--yes`。 |
| `check`（兼容 `lint`） | 只读检查项目约定，例如测试文件和文档的位置。 |
| `run`（兼容 `verify`） | 执行约定检查和配置的测试、lint、类型检查或构建等任务，并保存验证结果。`--task <id>` 选择验证任务，`--work <id>` 关联持久工作任务。 |
| `doctor` | **主要供 Agent 使用。** 诊断项目接入、配置和验证记录是否适用，无需运行项目任务。 |
| `inspect` | **主要供 Agent 使用。** 静态识别技术栈、工作区和候选命令，列出待确认的配置。 |
| `configure` | 交互补齐接入信息并输出计划，供确认后应用。 |
| `plan` | **主要供 Agent 使用。** 根据可用信息或 `--answers` 文件生成待审阅的接入计划。 |
| `apply --plan <文件>` | 应用已审阅的计划并报告冲突。首次验证可随后用 `run` 执行。 |
| `baseline` | **主要供 Agent 使用。** 输出普通检查问题的指纹，供审阅后纳入基线。 |

参数及示例见[使用指南](../guides/usage.md)和[配置参考](configuration.md#commands)。

### 工作任务与本地产物

| 命令 | 用途 |
|---|---|
| `task start <id>` | 创建可恢复的工作任务，使用 `--accept` 声明验收项。 |
| `task status [id]` | 查看任务状态、验收进度和关联的验证记录。 |
| `task resume [id]` | 恢复任务上下文并选中该任务，以便继续工作。 |
| `task handoff [id]` | 输出可复制的跨宿主交接文本，不切换当前任务。自 v0.8.1 起可用。 |
| `task note [id]` | 保存工作笔记或下一步。 |
| `task accept [id]` | 为指定验收项记录已核对的证据。 |
| `task finish [id]` | 核对验收项和当前验证记录，通过后标记任务完成。 |
| `artifacts create <标签>` | 为一次工作分配独立的产物目录。 |
| `artifacts finish <id>` | 标记产物写入完成，开始计算保留期。 |
| `artifacts keep <id>` | 保留需要长期引用的产物。 |
| `artifacts release <id>` | 恢复该产物的保留期规则。 |
| `artifacts clean [--yes]` | 预览到期产物，加 `--yes` 执行清理。 |

从 v0.8.1 起，`task start`、`note`、`accept` 和 `finish` 支持 `--brief` 回执，`task status` 和 `resume` 支持 `--brief` 摘要。用 `task status <id> --brief` 只读查看，用 `task resume <id> --brief` 查看并选中任务。需要完整记录时使用 `task status <id> --json`。详见[精简输出](tasks.md#brief-output)、[交接示例](../guides/usage.md#保存任务与交接)和[产物管理](artifacts.md)。

### 宿主接入与发布审计

| 命令 | 用途 |
|---|---|
| `roles` | 列出职责，指定 `--host` 和 `--role` 可预览受支持宿主的角色文件，加 `--yes` 写入。自 v0.8.1 起可用。 |
| `hook` | 供宿主调用的事件接口，通过标准输入和输出交换 JSON，处理会话开始和结束时的验证提示。 |
| `hooks clean [--yes]` | 预览到期的 Hook 会话快照，加 `--yes` 执行清理。 |
| `export --destination <目录>` | 按公开路径策略导出文件到新建的本地目录，可用 `--manifest-out` 保存清单。 |
| `publication-check` | 按发布目标或清单核对实际输出、文件来源及哈希。 |
| `review-template` | 生成与当前 Git 引用及公开策略关联的审阅证据模板。 |
| `audit-history` | 审计本地引用可达的 Git 历史，并检查审阅人提交的平台核对证据。 |

详见[角色配置](roles.md)、[会话 Hook](configuration.md#optional-local-hooks)和[公开导出与审计](publication-boundary.md)。

### 帮助与版本

| 命令 | 用途 |
|---|---|
| `help` 或 `--help` | 查看常用入口。用 `harness artifacts --help` 或 `harness hooks --help` 查看对应的子命令。 |
| `help --all` | 查看所用 CLI 支持的高级命令、兼容别名和参数。 |
| `--version` | 显示所用 CLI 的版本。 |

## 公开文档检查与审读

在支持 `documents.layout` 的 CLI 构建中，`harness check` 和 `harness run` 都会按配置检查文档位置，无需调用模型。Agent 按 Skill 或项目指令审读正文和导航，核对文档是否清晰、可操作，以及所描述的版本是否支持示例。维护流程见[使用指南](../guides/usage.md#维护公开文档)。

## 结论边界

- Skill 被安装不等于宿主新会话已经加载它。
- 配置完成不等于任务验证通过。
- `check` 是只读静态检查，`doctor` 是只读诊断；二者不会替代 `run`。
- `run --task` 只选择任务，不自动代表完整项目已经验证。
- CLI 不提供模型路由、后台调度、权限隔离或通用跨宿主委派 API。

## 从源码验证和打包

在 Harness Kit 源码目录安装依赖后执行：

```sh
node scripts/verify.mjs
bun run verify:bun
node scripts/package-distribution.mjs <新的输出目录>
```

第一条运行 Node 集成测试，第二条运行 Bun 完整测试。打包器生成独立 Skill、Codex / Claude Code 插件和 DeepSeek Harness 原生插件，输出目录需为新目录。
