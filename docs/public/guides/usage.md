# 使用指南

安装 [Skill 或插件](installation.md)后，在目标项目的新会话中提出接入请求：

```text
Use harness-kit to onboard this project, preserve its existing conventions, and run its existing tests.
```

Agent 直接调用包内 CLI。手动执行以下示例时，可以用[可选终端短命令](installation.md#可选终端短命令)，也可以把 `harness` 替换为 `node <Harness Kit 源码绝对路径>/bin/harness.mjs` 并通过 `--root` 指定目标项目。

## 接入项目

在目标项目运行 `harness` 打开中文菜单，或直接运行 `harness init`。接入时声明仓库的公开范围，CLI 会优先复用识别到的测试脚本。以下例子将项目声明为私有，并显式指定测试命令：

```sh
harness init --private --test "bun test ./tests" --yes
```

用 `--hosts` 选择一个或多个宿主，例如 `--hosts claude,gemini`。新项目默认接入 Codex，已有项目保留原来的宿主选择。已有测试脚本能被识别时可省略 `--test`。明确暂不配置测试时用 `--no-tests`，只接入并推迟首次验证时用 `--skip-verify`。

自定义技术栈见[适配器参考](../reference/adapters.md)。需要精确预览、配置多工作区或用答案文件自动接入时，见[配置参考](../reference/configuration.md)。

## 验证与诊断

| 命令 | 用途 |
|---|---|
| `harness init` | 接入或更新项目配置，默认执行首次验证 |
| `harness run` | 检查项目约定并执行配置的测试和其他任务 |
| `harness check` | 只读检查项目约定 |
| `harness doctor` | 只读诊断配置、环境和验证记录 |

改动有关源码或配置后，用 `harness run` 刷新验证记录。`run --task <验证任务 ID>` 仅验证所选任务及其依赖。要确认宿主实际加载了 Skill 或项目指令，请在新会话中检查。命令参数见 `harness help --all`。

## 保存任务与交接

需要跨会话继续时，用 `harness task start` 保存目标和验收条件，用 `harness task note` 记下进展和下一步，新会话可通过 `harness task resume` 接手。用 `run --work <工作任务 ID>` 关联验证，再逐项记录验收依据后完成任务。完整示例见[任务与验收](../reference/tasks.md)。

- 分配前端、后端、测试或审查等职责时，查阅[角色](../reference/roles.md)和[协作流程](../reference/collaboration.md)。
- 生成截图、日志、报告或评审稿前，先用 `harness artifacts create` 分配任务目录。目录约定和到期清理见[产物管理](../reference/artifacts.md)及[项目布局](../reference/project-layout.md)。
- 需要会话开始提醒或结束前的验证检查时，查阅[可选会话 Hook](../reference/configuration.md#optional-local-hooks)。
- 从已有项目归纳编码与架构约定时，使用[编码习惯提炼](coding-style.md)。公开导出与历史审计步骤见[发布边界](../reference/publication-boundary.md#导出与审计)。
