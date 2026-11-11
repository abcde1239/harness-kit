# 使用指南

为新旧项目接入 Agent 指令、开发流程与统一验证。当前源码与新构建包支持 **Node.js ≥ 22.12.0 或 Bun ≥ 1.3.4**；Git 功能另需 Git。分发包内置解析库，不需要额外安装 npm 依赖；源码开发需先安装依赖。已发布 v0.5.0 包仍要求 Bun。

核心按配置执行，扫描适配器提供建议。Go、TS、Vite、pnpm 和 Bun 是发现配方；其他栈可以直接声明工作区、测试布局和命令。

## 安装后开始使用

独立 Skill、Codex/Claude 插件和 DSH 原生插件的下载、安装、升级与排障统一见[安装指南](installation.md)。安装后用自然语言提出目标；Agent 直接调用实际技能目录内的 CLI，无需 setup 或全局 harness 命令。

本页的 harness 示例面向已安装可选终端短命令的用户；Skill/插件调用使用 node <已安装技能目录>/scripts/harness.mjs，并显式提供 --root <项目绝对路径>。完整文档入口见[文档导航](../README.md)。

要从自己维护的项目中总结编码风格与架构习惯，可直接说明项目路径和目标。画像与规则的保存、采用及复核方式见[编码习惯提炼](coding-style.md)，无需新增 CLI 命令。

## 可选：人类终端短命令

希望手动使用中文菜单和 `harness` 短命令时，先在源码目录运行 `npm install` 或 `bun install`，再执行 `node scripts/install.mjs`（Bun 用户可替换运行时）。安装器写入所选运行时的默认用户命令目录（Bun 为 ~/.bun/bin，Node 在 Windows 为 %LOCALAPPDATA%/harness-kit/bin，其他系统为 ~/.local/bin），生成 `harness` / `harness-kit`，默认也安装 Codex Skill 到 `$CODEX_HOME/skills/harness-kit`（未设置时 `~/.codex/skills/harness-kit`），不覆盖无归属或用户已修改的文件。它不修改系统 PATH 或 shell profile；若 bin 目录不在 PATH，按报告提示自行添加后重开终端。此步骤不影响 Skill/插件直接调用包内 CLI 的方式。

源码升级后可重新运行 setup；`bun run setup --dry-run` 预览位置，高级参数为 `--bin-dir`、`--skill-dir`。已经通过其他方式安装同名 Skill 时，先确认实际加载来源，避免多份安装造成混淆。

在**目标项目**终端输入：

```powershell
harness
```

中文菜单突出初始化、运行验证和诊断。首次使用选择初始化，回答仓库可见性及缺失测试信息，查看变更预览后选择应用或只保存计划。支持直接输入 `bun test`、`pnpm run test` 等普通命令和带引号路径，不需要输入 JSON 数组；不执行 shell 管道或变量展开。已有测试脚本可识别时直接复用，不重复提问。

项目根目录自动定位：优先已有 harness.config.json，其次 workspace/Git/项目清单；不会越过嵌套 Git 仓库边界。启动时会显示实际目标。需要指定独立子项目或其他目录时才用 `--root`。

```powershell
harness init            # 初始化/调整，默认执行首次验证
harness check           # 只检查项目约定
harness run             # 检查约定并执行已配置任务
harness doctor          # 只读诊断接入状态、环境与验证证据
```

简单项目可以一次完成，无需创建答案文件：

```powershell
harness init --private --test "bun test ./tests" --yes
```

已有测试脚本可识别时省略 `--test`；公开仓库使用 `--public`。明确暂不配置测试时使用 `--no-tests`，结果保持 `not-configured`。初始化会执行项目命令；确需先只接入、稍后验证时加 `--skip-verify`，报告会保留未验证状态。`--private` / `--public`、`--test` / `--no-tests` 分别互斥。

选择项目使用的宿主：

```powershell
harness init --hosts claude,gemini,cursor,opencode,dsh --private --yes
```

支持 `codex`、`claude`、`gemini`、`cursor`、`opencode`、`dsh`。`dsh` 即 DeepSeek Harness，别名 `deepseek-harness`；只接入它可运行 `harness init --hosts dsh --private --yes`。新项目显式选择时只生成所选入口；未指定时默认 Codex，已有项目保留历史选择并累计新增宿主。不会因为再次 init 少选一个宿主就删除已有入口。

| 宿主 | 生成的原生项目指令入口 |
|---|---|
| Codex | AGENTS.md |
| Claude Code | CLAUDE.md |
| Gemini CLI | GEMINI.md |
| Cursor | .cursor/rules/harness-kit.mdc，alwaysApply 为 true |
| OpenCode | AGENTS.md，与 Codex 共用时只管理一次 |
| DeepSeek Harness（dsh） | AGENTS.md，与 Codex/OpenCode 共用时只管理一次 |

计划默认保存在目标项目 `.harness/plan.json`。应用时保留冲突文件，并指出需要合并的内容。终端无交互输入时裸 `harness` 显示帮助，不会等待输入或修改文件。`harness help` 仅展示日常入口；`harness help --all` 查看完整接口。原 setup/lint/verify 命令仍兼容。

## 初始化后如何判断可用

初始化创建所选宿主的精简原生指令入口。已有文件只合并受管段，保留用户正文；受管段被用户修改或删除时报告冲突。配置仍以实际项目为准，原框架、业务目录和测试入口不迁移。宿主选择在接入归属状态中保存，不需要给 harness.config.json 添加 hosts 字段。

`init` 默认执行约定检查及配置的任务，再报告独立的 readiness。doctor 逐宿主核查已选择的入口；配置落盘、命令可执行和宿主实际加载是不同结论。静态入口存在不代表新会话已读取，各宿主的全局、局部或团队规则也可能影响生效范围，宿主加载保持未确认。

在真实会话中核对指令来源与验证入口：Codex 需留意 AGENTS.override.md；Claude 使用明确的 CLAUDE.md 入口，不依赖所有版本都直接读取 AGENTS.md；Gemini CLI 可通过 `/memory show`、`/memory reload` 查看/重载实际上下文；Cursor 核对规则是否启用。OpenCode V2 使用 AGENTS.md，`OPENCODE_DISABLE_PROJECT_CONFIG=1` 会停用项目指令发现；嵌套指令更新后应开新会话。新版本 Claude Code 对 AGENTS.md 的直接支持有版本与其他指令文件优先级条件，不能泛化成所有环境一致。

DeepSeek Harness 目前为 developer preview，可能发生破坏兼容的变更。本轮依据其 [官方固定提交](https://github.com/deepseek-ai/deepseek-harness/tree/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159)：默认 dsh-base 启用 agent-instructions，读取项目层级的 AGENTS.md、CLAUDE.md，并追加 AGENTS.local.md/CLAUDE.local.md。同组文件只有 trim 后内容完全相同才去重，已有不同的 CLAUDE.md 仍会一并加载；这不是 Codex 的 override 规则。自定义 profile、filesystem provider、候选文件名、项目根标记和 maxBytes 预算均影响实际加载；超预算可能省略或截断内容。外部指令修改靠后续成功的结构化 read/write/edit 或 resume 对账，不持续监听，shell 的 cd 也不触发嵌套发现。请在真实会话核对来源与预算提示；本工具不安装 dsh，也不写其插件、模型或权限配置。

`run` 将验证证据保存到 `.harness/verification.json`，包含输入快照摘要、配置/执行环境、范围及任务状态，不保存原始 stdout。`doctor` 不运行任务，只检查当前状态和该记录是否一致。源码或配置变化后，旧通过记录会过期；仅运行选定任务也不证明全项目就绪。该记录是本地证据，不是可信签名或自动脱敏的公开报告。

摘要覆盖项目常规文件，排除 `.git`、`node_modules`、`.harness` 和配置中明确声明的产物路径；不会因为源码目录名为 build/dist 就忽略它。依赖、外部服务和环境变量的任意变化不在完整追踪范围内；相关条件变化后应主动重验。只要任务在运行期间修改了受追踪文件，本次证据就不能作为稳定输入下的通过记录。

遇到未配置、缺工具、失败、冲突或过期记录时，根据诊断补齐条件并运行适用验证；不要修改证据文件或放宽必需任务来消除提示。

## 可选：保存并恢复一次工作任务

小改动直接运行验证即可。需要跨会话或多 Agent 交接时保存目标与验收：

```powershell
harness task start login-fix --title "修复空密码提交" --accept "空密码显示校验信息" --accept "有效登录不受影响" --scope src/auth --scope tests/auth
harness task note --note "已复现，定位到校验入口" --next "修复并运行认证测试"
harness task resume login-fix
# 完成实际改动、归纳必要 memory 后验证
harness run --work login-fix
harness task accept --criterion c1 --evidence "空密码回归用例通过，提示正确"
harness task accept --criterion c2 --evidence "有效登录回归用例通过"
harness task finish
```

使用 `harness task status` 查看当前状态与下一步。status/resume/note/accept/finish 可传任务 ID，省略时使用活动任务。验收按输入顺序编号 c1、c2；`--accept`、`--scope` 可重复，scope 默认 `.`。scope 仅描述协作文件范围，不是权限或验证范围限制。

`run --task <runnerID>` 保留原义：选择验证任务；`run --work <工作任务ID>` 才是绑定持久任务。二者可组合，但局部运行不足以 finish。完成门禁要求全部人工验收具有当前证据、本工作任务关联当前全量验证且 passed。人工 evidence 由责任人核实，工具不自动证明文字的语义真实性。

源码/配置变化会使旧验收与验证过期；验收还通过 definitionDigest 绑定任务目标、标题、scope 和 criterion 要求，任务定义变化也使旧验收过期。完整验证记录必须覆盖全部配置的任务和工作区，缺失条目不能作为完成依据。已完成任务也可能变为 needs-attention，resume 可重新打开，保留旧证据供复核。任务位于 `.harness/tasks/<id>.json`、活动指针位于 `.harness/active-task.json`，均为内部资料。恢复只呈现上下文并切换活动任务，不自动实施、运行测试或重放外部副作用。更新有锁保护，冲突时不擅自删除锁；异常残留需先确认没有其他写者。

完整说明见[任务与验收](../../../skills/harness-kit/references/tasks.md)。

## 可选：Codex 本地会话接入

希望会话启动时取得项目提示、结束时检查验证证据，可运行：

```powershell
harness init --hooks
```

已有脚本和可见性可复用；非交互接入时补充 `--yes` 及仍缺失的答案。该模式写入 `.codex/hooks.json`、`.harness/hooks/runtime.mjs` 和归属记录。项目运行器自包含，保留现有第三方字段与 handlers；本工具的 handler 被用户修改或删除时报告冲突，不强行恢复。

在新 Codex 本地会话中打开 `/hooks` 审阅并信任。配置使用所选 Node/Bun 运行时和项目绝对路径，移动项目、更换机器或升级后重新运行 `init --hooks`；不修改宿主权限。`.harness` 仍为内部资料，hook 配置中的本机路径也不应直接作为公开模板发布。

项目若已在 `.codex/config.toml` 明确设置 `features.hooks=false`，接入会报告 disabled 并保留禁用选择；不会擅自启用。`doctor` 会检查本工具已有 hooks 的文件和本地禁用状态，仍无法证明宿主已信任或实际加载。

SessionStart 提供项目验证提示并记录本会话输入摘要；Stop 在本会话文件发生变化、且当前没有完整通过证据时请求 Agent 继续运行 `harness run`。hook 自身不执行业务命令。已经自动继续过一次时只提醒，避免无限循环；没有启动快照或没有任务时也只提示，不将未知状态当通过。它不是权限沙箱，不能保证拦截绕过入口的行为，也不代表其他宿主或云端环境已适配。

## 使用 Skill

在宿主实际加载 Skill 后，用自然语言说明任务：

```text
Use harness-kit to onboard and verify this project, preserve its test framework, and keep internal development documents private.
```

日常也可直接使用：`Use harness-kit to reproduce and fix this issue with a minimal change, then run project verification.` 需要并行时明确授权：`Use harness-kit to implement this change. Multi-agent delegation is authorized; integrate the work and verify acceptance.` 显式调用方式以宿主实际发现的技能为准，插件可能带命名空间；不能假定同一符号语法通用。下方 CLI 示例中的 `harness` 是可选短命令，未安装时由 Agent 使用包内 `node <已安装技能目录>/scripts/harness.mjs`。

对于 dsh，启用 dsh-skill 与 dsh-skill-filesystem 后，将打包出的完整自包含目录放到 `<projectRoot>/.dsh/skills/harness-kit` 或 `<projectRoot>/.agents/skills/harness-kit`，也可按实际 provider 配置使用用户技能目录（默认 `~/.dsh/skills`、`~/.agents/skills`）。当前安装器默认的 Codex Skill 目录不会自动变成 dsh 技能目录。目录型技能须为扫描根的直接子目录；亦支持根顶层 `<name>.md` flat 技能，不递归任意嵌套树。Harness Kit 包含脚本与引用，应保留完整目录；先确认会话目录中出现 harness-kit 再加载。该 provider 监测技能目录/frontmatter 变化，正文在加载时重读；这与项目指令插件没有持续 watcher 的机制不同。详见 [dsh skill-filesystem 官方说明](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/skill/skill-filesystem/README.md)。

Skill 按需选择接入、改动、修复、评审或发布路径。小任务直接完成，不要求每次生成 PRD；复杂任务才保存方案与可恢复任务，并关联逐项验收和验证。失败时区分行为、配置和环境原因，限制同一原因的修复重试。已有 Superpowers、OpenSpec 或团队流程时继续复用，本工具负责接入与验证。

Agent 使用随 Skill 提供的非交互 JSON 接口，不会打开人类终端菜单。如果当前会话尚未显示新 Skill，打开新会话再选择；也可显式指定安装目录下的 SKILL.md。

多 Agent 协作需要实际宿主委派工具和授权。Skill 提供[主 Agent、实现 Agent、只读复核及交接提示词](../../../skills/harness-kit/references/collaboration.md)，规定工作任务 ID、独占写入范围、接口、依赖、验收和集成责任；没有工具或任务不适合拆分时串行完成。主 Agent 检查真实 diff 并执行集成验证，不把子任务自述作为完成证明。不同宿主使用实际提供的工具，不假造通用委派 API。开发与恢复细节见[开发流程](../../../skills/harness-kit/references/development.md)。

维护的 Agent 指令、职责模板、默认提示词和 Hooks 注入指令统一使用英文；用户文档与回复仍可使用中文，用户原文和代码保持原样。需要判断某种 Agent 行为是否值得改进时，可使用 [Agent 专家](../../../skills/harness-kit/references/roles/agent-expert.md)：

```text
Use the harness-kit Agent expert to review this behavior: <observed behavior>.
Compare the original goal with the actual instructions, tool results and output.
Decide whether to constrain, enable, simplify or leave it unchanged. Propose the smallest justified change and a behavioral check, including a valid contrasting case.
```

该职责按需分析上下文、工具、工作流、提示词和验证中的原因，不要求每项开发都增加一次审核。提出建议与实际验证改善效果分别报告。

当前提供 **自包含 Skill、宿主插件与可选交互 CLI**。它们复用同一套治理/runner/任务核心；插件负责宿主发现与打包，不提供新模型、权限或后台执行引擎。源 Skill 位于 [skills/harness-kit/SKILL.md](../../../skills/harness-kit/SKILL.md)。

从源码生成分发包：

```powershell
bun run package:distribution artifacts/distribution/0.5.0
```

输出目录必须不存在；省略参数时也使用 `artifacts/distribution/0.5.0`。产物包括 `skill/harness-kit`、`marketplace/plugins/harness-kit/skills/harness-kit`、Codex 的 `marketplace/.agents/plugins/marketplace.json`、Claude 的 `marketplace/.claude-plugin/marketplace.json`，以及 `native-dsh/harness-kit`。对应 ZIP 为 `harness-kit-skill-0.5.0.zip`（顶层 harness-kit）、`harness-kit-marketplace-0.5.0.zip`（顶层 marketplace）和 `harness-kit-dsh-0.5.0.zip`（顶层 harness-kit）。

Codex/Claude 插件目录同时含根 `plugin.json` portable manifest 与 `.claude-plugin/plugin.json` 兼容入口；技能位于插件根的 skills/，不放在 manifest 目录内。分发包附 INSTALL.md；该命令只生成本地产物，不推送仓库或上架公共目录。原 `bun run package:skill` 保留为只生成技能目录的接口。

接入后目录、文档公开边界、框架原生测试和 monorepo 组织见 [目标项目布局](../../../skills/harness-kit/references/project-layout.md)。CLI 提供所选宿主入口、配置、协作指南、目录职责说明和 gitignore；缺少根 README 时补充公开入口。详细公开文档按 docs/public/guides、reference、examples 分类；业务代码、框架配置及 CI 接线由项目按需要适配。hooks 仅适配明确选择的 Codex 本地模式，在显式接入并获宿主信任后生效；本轮不配置其他宿主的 hooks、权限或模型设置。

## 自动化与高级计划模式

把如下内容保存到目标项目的 `answers.json`：

```json
{
  "visibility": "private",
  "testCommands": { "root": ["bun", "test"] }
}
```

```powershell
harness plan --answers answers.json --out .harness/plan.json --json
harness apply --plan .harness/plan.json --json
# 已提供答案并明确授权应用时也可一步执行：
harness init --answers answers.json --yes --json
```

`--json` 保留完整机器输出；普通模式仅显示简要状态与诊断。`configure` 仍是仅生成计划的兼容入口。`--out` 对 init 指定计划路径，不会把执行结果覆盖到计划文件里。低层 `apply` 只应用计划，之后运行 `run` 和 `doctor`。以上短命令均可由 Agent 替换成 `node <已安装技能目录>/scripts/harness.mjs`；源码开发者也可用 `bun bin/harness.mjs`。

项目已经有 `harness.config.json` 时以它为准。可直接编辑该配置；生成器不会覆盖未管理或已被用户修改的文件。`apply` 返回 `conflicts` 时保留原文件，需人工合并计划里的建议内容后重跑。gen-new 的原 `scripts/verify.sh`、Agent 目录和自定义指南均保留。

## 文档与测试放置

| 内容 | 默认位置 | 公开规则 |
|---|---|---|
| 项目介绍、安装与快速开始 | 根 README.md | 默认公开 |
| 通用 Agent 指令入口 | 所选宿主原生路径 | 无既有配置时新生成入口可纳入公开规则；已有/自定义内容须审阅 |
| 工作目标、人工验收、下一步和验证记录 | .harness/tasks、active-task.json、verification.json | 默认内部 |
| 目录与文档职责说明 | docs/structure.md | 内部协作资料 |
| PRD、ADR、验收过程 | docs/prd、docs/decision、docs/verification | 可进私有 Git，默认不公开 |
| memory、decision 等开发过程材料 | 现有位置 | 默认禁止公开 |
| 公开指南、参考和示例 | docs/public/guides、reference、examples | 检查实际产物和来源后发布 |
| 自动测试与 fixtures | 框架原生目录 | 独立配置公开范围 |
| 报告、截图、覆盖率 | 框架输出目录或 artifacts | 不因输出到该处自动获得公开资格 |

`docs/verification` 写验收方法和测试链接，不重复抄写测试断言。单元测试保留框架习惯，跨模块测试按需要集中；不生成一堆空测试目录。没有测试的项目会显示 `not-configured`。

多个技术栈共用工作区时保留各自测试任务。若任一发现配方未限定测试路径，合并建议也不限制路径，避免另一技术栈的测试被误报；需要更严格的布局时在配置中明确列出各框架路径。已有显式配置保持优先。

生成的 `.gitignore` 忽略依赖、常见产物、本地环境和临时答案/计划，保留 env 示例。私有仓库中的内部文档仍可提交；公开仓库额外忽略默认内部资料。已有 gitignore 保留并提供合并建议；忽略规则不处理已跟踪文件或历史。

已有明确的 publicPatterns 不因新增宿主而自动扩宽。只有没有既有治理配置且入口是新生成的通用内容时，生成器才将该入口纳入建议公开范围；已有 CLAUDE.md 等可能含内部信息，仍需人工核查。

## 配置契约

根文件为 `harness.config.json`，`schemaVersion` 必须为 1。未知字段拒绝加载，避免拼写错误悄悄失效。完整可运行示例见本项目根配置；多工作区示例见 [examples/monorepo.config.json](../../../examples/monorepo.config.json)。

| 字段 | 说明 |
|---|---|
| repository.visibility | private / public / unknown；是用户声明，不自动从 remote URL 推断 |
| workspaces | id、root，可选 tests/documents；路径相对项目根 |
| documents | defaultAudience 只能为 internal；publicRoots/internalRoots、publicPatterns/internalPatterns |
| tests | include/exclude glob、artifacts 路径、requireConfiguredTask |
| tasks | id、workspace、argv、cwd、dependsOn、kind、required、enabled、timeoutMs、covers |
| publicationTargets | id 与 manifest 相对路径 |
| rules | tests.layout、tests.configured、tests.artifacts、documents.links、tasks.graph；error/warning/off |
| baseline | 经过审阅的普通历史问题 fingerprint 数组 |

工作区 tests 覆盖同名根字段；工作区 documents 追加作用域内的路径，不能取消根 internal 规则。glob 支持 `*`、`**`、`?`，不支持 shell 花括号展开。路径用 `/`，不允许越界和符号链接。任务 cwd 相对其工作区；dependsOn 使用全局唯一任务 ID。

`covers` 用于声明根任务已验证哪些工作区；它不会自动禁用其他 ID 的子任务，配置时选择根聚合或逐包运行以避免重复执行。工具不会猜测任意 shell 脚本的行为。Vite 依赖本身不会生成测试任务；Go 每个 module 独立发现。复杂 YAML、复杂 workspace 模式、多个锁文件和聚合脚本会要求显式配置。

`answers.json` 可包含 visibility、hosts（宿主 ID 数组）、managers（按工作区 ID）、testCommands（argv 或 null）、完整 config，以及 acknowledge（已阅问题 ID）。宿主选择也记录于 plan 和 managed 状态，不是 harness.config.json 新字段。自定义框架通过 config.tasks 接入，不必编写新适配器。

## 验证与渐进治理

```powershell
bun bin/harness.mjs check --root D:/project --json
bun bin/harness.mjs run --root D:/project --task web:test --json
bun bin/harness.mjs baseline --root D:/project --out .harness/baseline-proposal.json
```

`check` 不执行业务脚本；`run` 运行约定检查及所选任务图，检测循环、每个任务只执行一次、保留失败退出码。required 的失败/跳过/缺工具/超时都会阻断。可选任务失败仍会明确显示，不冒充 passed。返回码：0 为本次门禁满足，1 为检查失败，2 为配置或执行条件错误。`not-configured` 即使不阻断，也不代表业务测试通过或项目已就绪。

baseline 命令只输出建议；审阅后将数组合入配置。普通已知问题转为 warning，新增问题仍失败；发布规则无法关闭或加入基线。Windows 下包管理器的 `.cmd` shim 使用受限参数启动，包含 shell 元字符时拒绝；此时配置可直接执行的原生程序或 JS 入口。

任务日志默认仅保留末尾 32 KiB，JSON 输出属于内部验证记录，可能包含被执行程序自己的输出。不要将它当作自动脱敏的公开报告。

## 公开快照与发布清单

本工具自身的提交范围见 [公开与内部资料边界](../reference/publication-boundary.md)。公开仓库只接收独立导出的源码、测试、Skill 和使用文档；PRD、决策、任务表、验收过程及 memory 保留在私有源目录。

```powershell
bun bin/harness.mjs export --root D:/project --destination artifacts/public-snapshot --manifest-out .harness/publication.json
bun bin/harness.mjs publication-check --root D:/project --manifest .harness/publication.json --out .harness/publication-result.json
```

目标必须不存在。只导出显式允许的文件，不复制 `.git` 或私有历史，不推送。memory/decision 默认禁止；已知内部文件的完全相同复制件也会被阻断。导出结果进入已有公开仓库前，仍须单独审计该仓库历史。

构建产物使用 [manifest 模板](../../../examples/publication.manifest.json)：填写真实输出、全部来源和 SHA-256；转换后的产物还需要 reviewer/reference，表示人工确认来源完整。模板里的示例值不能通过检查。根输出目录每个实际文件都必须列入，额外文件、摘要变化、来源不明、内部来源、内部链接、符号链接或未审计归档均阻断。

报告绑定策略、manifest 和实际产物摘要。上传步骤只能使用检查过的同一份文件；修改或重新构建后必须重验。本工具不执行上传，也无法限制用户绕过门禁。源码映射、搜索索引等同样需要来源声明；不自动推断任意生成器的完整数据流。

## 私有仓库转公开 / 已公开仓库

```powershell
bun bin/harness.mjs review-template --root D:/project --out .harness/review.json
# 人工填写 reviewer/reference、全部远端 refs 清单和各托管平台资料审阅项
bun bin/harness.mjs audit-history --root D:/project --evidence .harness/review.json --json
```

检查全部本地 refs 可达历史，包括 HEAD 已删文件、非默认分支、标签及已知内部 blob 的重命名/复制。浅克隆、缺失对象、LFS 和 submodule/符号链接等未覆盖资源会阻断。原始已知内部内容被改写后，不能保证通过内容指纹自动识别；应保留真实来源并人工审阅。

远端 refs 的完整性和 Issues/PR/Wiki/Release/Actions 等托管资料目前通过**绑定当前 scope 的人工审阅声明**提供。工具会验证声明是否完整及其 refs 是否能在本地对应，但不会连接托管平台证实声明真实性。不要把人工声明当成自动审计。仓库 refs、remote 摘要或策略变化后旧声明失效。

仓库标记 public 时，lint 也检查暂存区。私有文档在公开仓库应保存在私有伴随仓库或不跟踪的本地位置；`.gitignore` 不能消除历史。工具不重写历史、不强推、不改可见性。

## 本项目开发与 CI

```powershell
bun run verify
bun run harness check --json
```

原有完整测试使用 Bun 原生测试框架，Node 集成测试使用 node:test；两者使用临时 fixture，包括本地 Git 历史，不操作真实远端。CI 提供 Windows/Linux 矩阵，实际结果以对应提交的 Actions 为准。构建与使用文档可以公开，内部验收过程不随公开源码导出。

当前交付包含 CLI、自包含 Skill、Codex/Claude 插件和 DSH 原生插件；宿主覆盖范围见[能力说明](../reference/capabilities.md)。当前源码及新包的 CLI 支持 Node.js 或 Bun，二选一；项目测试仍需要自身工具链。构建全部分发包：bun run package:distribution <新的输出目录>。已有目标目录拒绝覆盖。
