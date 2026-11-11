# 配置与非交互调用

所有相对路径参数以 `--root` 为基准。不要在技能目录写目标项目答案。

## 已安装技能的入口

独立 Skill 和插件内 Skill 的分发包都包含完整 `scripts/harness.mjs`。以宿主实际加载的 SKILL.md 所在目录为技能根，直接运行 `bun <已安装技能目录>/scripts/harness.mjs <command> --root <项目绝对路径> --json`。无需先执行 bun run setup、安装全局 harness 或调整 Harness Kit 的 PATH；Bun ≥ 1.3.4 仍需可执行，分发包不附带 Bun，Git 功能另需 Git。不要假设插件缓存固定在某个用户路径，也不要依赖源码 checkout 的位置。源码 skills/harness-kit 中的脚本是开发入口，独立安装须使用 ZIP 或打包产物，不只复制源码技能目录。

下面省略统一前缀的示例，均由 Agent 补齐上述实际路径。用户可以只用自然语言请求接入、开发或验证。可选的源码 `bun run setup` 仅为人类终端提供短命令，不是 Skill/插件运行前置步骤。插件安装名与技能调用名可能带宿主命名空间，以实际发现结果为准。

单工作区优先短接口：`init --private --test "bun test ./tests" --yes`，已有脚本可发现时省略 `--test`。暂不测试需明确使用 `--no-tests`；不要把缺失自动当作无测试。复杂配置或需分开审阅时使用以下 answers / plan 接口。

宿主选择用 `init --hosts claude,gemini,cursor,opencode,dsh`，也支持 codex。dsh 即 DeepSeek Harness，接受别名 deepseek-harness；仅接入它时用 `init --hosts dsh --private --yes`。新项目显式选择只生成这些入口；未选时默认 Codex，已有项目累计保留历史选择。复杂答案可给 `hosts: ["claude", "dsh"]`。选择存于 plan.hosts 和 managed 状态，不属于 harness.config.json schema，不要新增 config.hosts。

DeepSeek Harness 仍处于 developer preview。本工具只生成/合并 AGENTS.md 并复用任务与验证，不安装 dsh、不配置其插件、模型或权限。默认 dsh-base 的 agent-instructions 插件读取 AGENTS.md、CLAUDE.md 及追加的 AGENTS.local.md/CLAUDE.local.md；同一候选组仅 trim 后完全相同才去重，不能依赖 Codex 的 AGENTS.override.md 语义。自定义 profile、filesystem provider、候选名、项目根标记和 maxBytes 会改变实际加载；外部修改靠后续结构化文件操作或 resume 对账，没有持续 watcher。用真实会话核实指令来源与预算提示，不把文件存在当加载证明。

Skill 发现是独立机制。启用 dsh-skill 与 dsh-skill-filesystem 时，可把完整自包含技能目录放到 `<projectRoot>/.dsh/skills/harness-kit` 或 `<projectRoot>/.agents/skills/harness-kit`；用户目录默认也扫描 `~/.dsh/skills` 和 `~/.agents/skills`，实际根受环境与 provider 配置影响。目录型技能须为扫描根的直接子目录；亦支持根顶层 `<name>.md` flat 技能，不递归任意嵌套树。本技能包含 scripts/references，应保留完整目录。先查看会话目录中是否出现 harness-kit，再按宿主实际机制加载；CLI 短命令不依赖 Skill 发现，勿假定 `$harness-kit` 是跨宿主通用语法。

```json
{
  "visibility": "private",
  "testCommands": { "root": ["bun", "test"] }
}
```

`managers` 是工作区 ID 到 bun/pnpm/npm/yarn 的映射。`acknowledge` 只放已经检查处理的问题 ID。完整 `config` 可替代扫描建议；请从 inspect.suggestedConfig 修改，保留适用项目字段。

## schemaVersion 1

- repository：`visibility` 为 private/public/unknown；unknown 阻断仓库发布检查。
- workspaces：数组，`id`、项目根相对 `root`，可选 `tests`/`documents`。
- documents：`defaultAudience: internal`，publicRoots/internalRoots，publicPatterns/internalPatterns。内部规则优先，子工作区不能放宽根策略。只有显式公开路径可发布。
- tests：include/exclude glob、artifacts 路径、requireConfiguredTask。保留框架扫描约定；glob 支持 `*`、`**`、`?`。
- tasks：id、workspace、argv 数组、cwd（相对工作区）、dependsOn、kind（test/lint/typecheck/build/custom）、required、enabled、timeoutMs、covers（覆盖工作区）。同一任务去重，检测循环；根聚合已有子测试时用 covers 明确范围，避免重复执行。
- publicationTargets：id、manifest。只有公开检查需要配置。
- rules：tests.layout、tests.configured、tests.artifacts、documents.links、tasks.graph；error/warning/off。
- baseline：普通历史问题的 fingerprint 数组，不能包含公开问题豁免。

省略字段沿用默认；未知字段或版本被拒绝。根 README.md 默认公开；没有既有治理配置时，新生成的通用宿主入口可纳入建议公开规则，已有入口或显式策略不自动放宽。详细公开内容放 docs/public/guides、reference、examples。内部默认包含 docs/prd、docs/decision、docs/verification、.harness、docs/structure.md 和 docs/agent_guide.md。显式数组替换该字段默认值，改造旧配置时审阅合并新约定，并检查自定义 Agent 指令是否含内部信息。不要添加不存在于 schema 的 fields。

## 命令

统一前缀：`bun <skill>/scripts/harness.mjs`。以下命令均补充 `--root <project> --json`：

- `inspect`：只读发现，返回 facts、questions、suggestedConfig。
- `init --answers .harness/answers.json --yes`：应用接入并默认执行首次验证；`--skip-verify` 明确暂不执行。
- `plan --answers .harness/answers.json --out .harness/plan.json`：保存精确内容和前置摘要。
- `apply --plan .harness/plan.json`：应用未变更计划；conflicts 保留原文件。
- `check`：只读治理，公开仓库还检查 Git index；兼容名 lint。
- `run` 或 `run --task <id>`：运行声明式任务并保存验证记录；所选范围以外标记 not-selected，兼容名 verify。
- `doctor`：只读诊断配置、入口和当前验证记录，不运行任务，不确认宿主会话已经加载。
- `baseline`：输出提案，不自动修改配置。

工作任务通过 `task start/status/resume/note/accept/finish` 管理，详细参数见[任务参考](tasks.md)。`run --work <工作任务ID>` 绑定验证；原 `run --task <runner任务ID>` 保持选择验证任务的含义。不要混用两个 ID，也不要把 task scope 当作验证或权限范围。

日常帮助只展示主要入口，`help --all` 查看所有兼容与高级接口。低层 apply 不执行首次验证，需再调用 run。验证记录位于 `.harness/verification.json`，源码/配置变化后不能沿用旧结果；不要手工写入通过状态。

## 可选 Codex 本地 hooks

`init --hooks` 合并 `.codex/hooks.json` 的 SessionStart/Stop handlers，并在 `.harness/hooks` 生成自包含运行器和归属记录。用户需要在新本地会话 `/hooks` 中审阅信任；该操作不改变宿主权限。已有第三方 handlers 保留，本工具的 handler 被修改/删除时报告冲突。命令绑定本机 Bun 与项目绝对路径，搬迁、换机器或升级后重新 init --hooks。

SessionStart 记录本会话输入摘要并提示验证入口。Stop 只在会话内有修改且没有当前完整通过证据时请求 Agent 继续验证；不执行项目命令，自动继续一次后只提醒。无启动快照或无任务时只说明缺口。此协议适配不等于全平台强制执行，不能自行代用户信任或关闭其他 hook。

退出码 0：本次所要求的门禁满足；1：规则/任务失败；2：配置/工具/执行条件错误。not-configured 不代表测试通过。发布命令不能用普通 lint 成功代替。
