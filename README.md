# Harness Kit

基于 gen-new 思路的通用 harness-lint 创建与治理工具。使用 **Bun ≥ 1.3.4**，无第三方运行依赖；Git 功能另需 Git。无需 Node.js、npm 安装或 Bash。

核心按配置执行，扫描适配器提供建议。Go、TS、Vite、pnpm 和 Bun 是发现配方；其他栈可以直接声明工作区、测试布局和命令。

## 一次安装

在下载/克隆后的本工具目录执行一次：

```powershell
bun run setup
```

这会在 Bun 的用户 bin 目录安装 `harness` / `harness-kit` 短命令，并在 `$CODEX_HOME/skills/harness-kit`（未设置则 `~/.codex/skills/harness-kit`）安装 Skill。安装包包含完整 Bun CLI，不依赖源码目录的固定位置。没有网络下载，不修改系统 PATH 或 shell profile，不覆盖无归属或用户已修改的文件。

安装器会报告 bin 目录是否已在 PATH；如果不在，把报告中的目录加到用户 PATH 后重新打开终端。源码升级后重新运行 `bun run setup` 即可更新已管理的安装文件。预览安装位置可运行 `bun run setup --dry-run`；高级场景可传 `--bin-dir`、`--skill-dir`。

## 在任意项目中使用

打开**目标项目**的终端，输入：

```powershell
harness
```

中文菜单可选择初始化/调整配置、只扫描、lint 或运行测试。首次使用选择初始化，回答仓库可见性及缺失测试信息，查看变更预览后选择应用或只保存计划。支持直接输入 `bun test`、`pnpm run test` 等普通命令和带引号路径，不需要输入 JSON 数组；不执行 shell 管道或变量展开。已有测试脚本可识别时直接复用，不重复提问。

项目根目录自动定位：优先已有 harness.config.json，其次 workspace/Git/项目清单；不会越过嵌套 Git 仓库边界。启动时会显示实际目标。需要指定独立子项目或其他目录时才用 `--root`。

```powershell
harness setup           # 直接进入初始化/调整向导
harness inspect         # 只查看扫描结果
harness lint            # 只检查项目约定
harness verify          # 运行约定检查和已配置任务
harness help            # 查看完整命令
```

计划默认保存在目标项目 `.harness/plan.json`。应用时保留冲突文件，并指出需要合并的内容。终端无交互输入时裸 `harness` 显示帮助，不会等待输入或修改文件。

## 使用 Skill

安装后，在项目的新 AI 会话中使用：

```text
$harness-kit 为当前项目配置 harness-lint，保留现有测试框架，内部开发文档不公开。
```

或者：`$harness-kit 检查当前项目已有的 harness-lint 是否适配 monorepo。`

Skill 会扫描、询问缺失需求、形成可审阅计划，然后在用户授权范围内应用并验证。Agent 使用随 Skill 提供的非交互 JSON 接口，不会打开人类终端菜单。如果当前会话尚未显示新 Skill，打开新会话再选择；也可显式指定安装目录下的 SKILL.md。

当前产物为 **交互 CLI + Skill**，不是插件。源 Skill 位于 [skills/harness-kit/SKILL.md](skills/harness-kit/SKILL.md)，用 `bun run package:skill` 可产生可复制的自包含 Skill 目录。项目治理执行依然统一使用同一套核心。

接入后目录、文档公开边界、框架原生测试和 monorepo 组织见 [目标项目布局](skills/harness-kit/references/project-layout.md)。CLI 提供配置、协作指南、目录职责说明和 gitignore；缺少根 README 时补充公开入口。详细公开文档按 docs/public/guides、reference、examples 分类；业务代码、框架配置及 CI 接线由项目按需要适配。

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
harness setup --answers answers.json --yes --json
```

`--json` 保留完整机器输出；普通模式仅显示简要状态与诊断。`configure` 仍是仅生成计划的兼容入口。`--out` 对 setup 指定计划路径，不会把执行结果覆盖到计划文件里。安装前也可用 `bun bin/harness.mjs` 代替短命令。

项目已经有 `harness.config.json` 时以它为准。可直接编辑该配置；生成器不会覆盖未管理或已被用户修改的文件。`apply` 返回 `conflicts` 时保留原文件，需人工合并计划里的建议内容后重跑。gen-new 的原 `scripts/verify.sh`、Agent 目录和自定义指南均保留。

## 文档与测试放置

| 内容 | 默认位置 | 公开规则 |
|---|---|---|
| 项目介绍、安装与快速开始 | 根 README.md | 默认公开 |
| 目录与文档职责说明 | docs/structure.md | 内部协作资料 |
| PRD、ADR、验收过程 | docs/prd、docs/decision、docs/verification | 可进私有 Git，默认不公开 |
| memory、decision 等开发过程材料 | 现有位置 | 默认禁止公开 |
| 公开指南、参考和示例 | docs/public/guides、reference、examples | 检查实际产物和来源后发布 |
| 自动测试与 fixtures | 框架原生目录 | 独立配置公开范围 |
| 报告、截图、覆盖率 | 框架输出目录或 artifacts | 不因输出到该处自动获得公开资格 |

`docs/verification` 写验收方法和测试链接，不重复抄写测试断言。单元测试保留框架习惯，跨模块测试按需要集中；不生成一堆空测试目录。没有测试的项目会显示 `not-configured`。

多个技术栈共用工作区时保留各自测试任务。若任一发现配方未限定测试路径，合并建议也不限制路径，避免另一技术栈的测试被误报；需要更严格的布局时在配置中明确列出各框架路径。已有显式配置保持优先。

生成的 `.gitignore` 忽略依赖、常见产物、本地环境和临时答案/计划，保留 env 示例。私有仓库中的内部文档仍可提交；公开仓库额外忽略默认内部资料。已有 gitignore 保留并提供合并建议；忽略规则不处理已跟踪文件或历史。

## 配置契约

根文件为 `harness.config.json`，`schemaVersion` 必须为 1。未知字段拒绝加载，避免拼写错误悄悄失效。完整可运行示例见本项目根配置；多工作区示例见 [examples/monorepo.config.json](examples/monorepo.config.json)。

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

`answers.json` 可包含 visibility、managers（按工作区 ID）、testCommands（argv 或 null）、完整 config，以及 acknowledge（已阅问题 ID）。自定义框架通过 config.tasks 接入，不必编写新适配器。

## 验证与渐进治理

```powershell
bun bin/harness.mjs lint --root D:/project --json
bun bin/harness.mjs verify --root D:/project --task web:test --json
bun bin/harness.mjs baseline --root D:/project --out .harness/baseline-proposal.json
```

`lint` 不执行业务脚本；`verify` 运行 lint 及所选任务图，检测循环、每个任务只执行一次、保留失败退出码。required 的失败/跳过/缺工具/超时都会阻断。可选任务失败仍会明确显示，不冒充 passed。返回码：0 为本次门禁满足，1 为检查失败，2 为配置或执行条件错误。`not-configured` 即使不阻断，也不代表业务测试通过。

baseline 命令只输出建议；审阅后将数组合入配置。普通已知问题转为 warning，新增问题仍失败；发布规则无法关闭或加入基线。Windows 下包管理器的 `.cmd` shim 使用受限参数启动，包含 shell 元字符时拒绝；此时配置可直接执行的原生程序或 JS 入口。

任务日志默认仅保留末尾 32 KiB，JSON 输出属于内部验证记录，可能包含被执行程序自己的输出。不要将它当作自动脱敏的公开报告。

## 公开快照与发布清单

本工具自身的提交范围见 [公开与内部资料边界](docs/public/reference/publication-boundary.md)。公开仓库只接收独立导出的源码、测试、Skill 和使用文档；PRD、决策、任务表、验收过程及 memory 保留在私有源目录。

```powershell
bun bin/harness.mjs export --root D:/project --destination artifacts/public-snapshot --manifest-out .harness/publication.json
bun bin/harness.mjs publication-check --root D:/project --manifest .harness/publication.json --out .harness/publication-result.json
```

目标必须不存在。只导出显式允许的文件，不复制 `.git` 或私有历史，不推送。memory/decision 默认禁止；已知内部文件的完全相同复制件也会被阻断。导出结果进入已有公开仓库前，仍须单独审计该仓库历史。

构建产物使用 [manifest 模板](examples/publication.manifest.json)：填写真实输出、全部来源和 SHA-256；转换后的产物还需要 reviewer/reference，表示人工确认来源完整。模板里的示例值不能通过检查。根输出目录每个实际文件都必须列入，额外文件、摘要变化、来源不明、内部来源、内部链接、符号链接或未审计归档均阻断。

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
bun run harness lint --json
```

测试使用 Bun 原生测试框架和临时 fixture，包括本地 Git 历史；不会提交本项目或操作真实远端。CI 文件提供 Windows/Linux 矩阵，只有推送到用户自己的仓库后才会运行。内部验收记录保存在 docs/verification，不随公开说明导出。

当前交付是可运行的交互 CLI、自包含 Skill 与核心模块；plugin 封装不在本次范围。运行时只需要 Bun；代码中的 `node:` 导入使用 Bun 内置兼容 API，不需要 Node.js。
