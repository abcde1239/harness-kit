# 配置与非交互调用

所有相对路径参数以 `--root` 为基准。不要在技能目录写目标项目答案。

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

省略字段沿用默认；未知字段或版本被拒绝。根 README.md 默认公开，详细公开内容放 docs/public/guides、reference、examples。内部默认包含 docs/prd、docs/decision、docs/verification、.harness、docs/structure.md 和 docs/agent_guide.md。显式数组替换该字段默认值，改造旧配置时合并新约定。不要添加不存在于 schema 的 fields。

## 命令

统一前缀：`bun <skill>/scripts/harness.mjs`。以下命令均补充 `--root <project> --json`：

- `inspect`：只读发现，返回 facts、questions、suggestedConfig。
- `plan --answers .harness/answers.json --out .harness/plan.json`：保存精确内容和前置摘要。
- `apply --plan .harness/plan.json`：应用未变更计划；conflicts 保留原文件。
- `lint`：只读治理，公开仓库还检查 Git index。
- `verify` 或 `verify --task <id>`：运行声明式任务；所选范围以外标记 not-selected。
- `baseline`：输出提案，不自动修改配置。

退出码 0：本次所要求的门禁满足；1：规则/任务失败；2：配置/工具/执行条件错误。not-configured 不代表测试通过。发布命令不能用普通 lint 成功代替。
