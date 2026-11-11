# 可恢复任务与验收关联

只为需要跨会话、明确验收或多人交接的工作建立任务。简单改动继续直接实施和运行验证；已有 OpenSpec/Spec Kit 等任务时复用它们的需求资料，Harness 任务只记录目标、证据和验证关联，不再复制整份规格。

统一调用 `bun <skill>/scripts/harness.mjs`，补充 `--root <项目绝对路径> --json`。下方为人类短命令写法；Agent 使用实际可用入口，不把宿主工具名写死到提示词。

## 一个完整例子

```sh
harness task start login-fix --title "修复空密码提交" --accept "空密码显示校验信息" --accept "有效登录不受影响" --scope src/auth --scope tests/auth
harness task note --note "已复现，定位校验入口" --next "修复并运行认证测试"
harness task status
harness task resume login-fix
# 完成实际修改，并在最终验证前归纳相关 memory
harness run --work login-fix
harness task accept --criterion c1 --evidence "空密码回归用例通过，显示指定提示"
harness task accept --criterion c2 --evidence "有效登录用例通过，返回约定结果"
harness task finish
```

`--accept` 可重复，生成 c1、c2 等验收 ID。`--scope` 是可重复的项目相对路径，默认 `.`，用来说明协作文件范围；它不实施沙箱、不扩大权限，也不缩小验证快照或测试范围。

## 命令选择

| 命令 | 作用 |
|---|---|
| `task start <id> --title ... --accept ...` | 新建目标与验收，设为活动任务；已有同名任务不覆盖 |
| `task status [id]` | 查看当前计算状态、验收、关联验证与下一步 |
| `task resume [id]` | 读取并选择活动任务；需要重开时恢复实施状态，不执行项目命令 |
| `task note [id] --note ... --next ...` | 记录已核实事实、阻塞或下一步 |
| `task accept [id] --criterion c1 --evidence ...` | 保存该验收项的人工证据、当前输入摘要与任务定义摘要 |
| `run --work <id>` | 执行配置验证，并将结果关联到这个工作任务 |
| `task finish [id]` | 检查验收和验证门禁，满足后标记完成 |

省略可选 ID 时使用活动任务，没有活动任务则明确失败。`run --task <runnerID>` 仍是选择某条验证任务；可与 `--work` 组合，但这种局部验证不足以完成工作任务。

## 证据与完成门禁

验收证据是责任人核实后的解释、测试位置或其他实际依据；不应填无信息价值的“完成”“通过”，也不能为了门禁编造人工审阅。工具不会自动证明这段文字确实满足需求。

finish 同时要求：每个 criterion 有当前人工 evidence；本任务已关联完整且通过的验证；当前源码/配置、任务定义与验收和验证摘要仍一致。完整验证记录必须覆盖全部配置的任务和工作区；缺失条目、只运行另一项工作任务、只完成局部测试、没有配置任务或沿用过期 passed 均不足以完成。

验收通过 definitionDigest 绑定目标、标题、scope 和 criterion 要求；这些任务定义或受追踪源码/配置变化，都会使旧 evidence 过期。重新查看当前要求与实现、运行必要验证并重新 accept，不能手改摘要。已完成任务遇到相关变化会显示 needs-attention；resume 可重开并保留旧记录。当前仍有效的已完成任务 resume 后保持完成。

## 恢复、并发和保存边界

任务位于 `.harness/tasks/<id>.json`，活动指针为 `.harness/active-task.json`，默认内部。status/resume 只恢复可读上下文，不自动重新实施、重跑测试、提交、部署或重放任何外部副作用；重试前先核实实际状态。

任务更新有文件锁保护。锁冲突时等待其他写者结束或向集成负责人报告；异常退出残留锁必须确认没有其他写者后处理，不擅自删除或抢占。不要通过修改 JSON 绕过 finish。

多 Agent 协作由集成负责人维护活动任务、接受验收和完成判定；子任务带工作任务 ID、criterion 和写入范围返回证据。任务 ID 不是宿主 Agent ID，记录不提供后台调度。提示词见[协作参考](collaboration.md)。
