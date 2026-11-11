# CLI 与 Skill

Harness Kit 将宿主接入和项目执行分开：

| 层 | 作用 |
|---|---|
| Skill / 原生插件 | 让 Agent 宿主发现使用说明，提供英文工作指令和宿主注册入口 |
| Bundled CLI | 读取项目配置、发现适配器、规划任务、运行原生命令并记录验证证据 |
| 项目配置与任务 | 说明工作区、测试、lint、类型检查、依赖和验收范围 |
| 项目原生工具 | 由项目自己的测试框架、包管理器和构建工具执行实际工作 |

分发 ZIP 已经包含完整 CLI。Agent 应从实际加载的 `SKILL.md` 定位脚本，并传入目标项目绝对路径：

```text
node <installed-skill-directory>/scripts/harness.mjs <command> --root <project-absolute-path> --json
```

Node.js ≥ 22.12.0 与 Bun ≥ 1.3.4 均可运行 Harness Kit；目标项目的 `bun test`、`cargo test` 或其他任务命令仍使用项目自己声明的工具链。

## 结论边界

- Skill 被安装不等于宿主新会话已经加载它。
- 配置完成不等于任务验证通过。
- `check` 是只读静态检查，`doctor` 是只读诊断；二者不会替代 `run`。
- `run --task` 只选择任务，不自动代表完整项目已经验证。
- CLI 不提供模型路由、后台调度、权限隔离或通用跨宿主委派 API。
