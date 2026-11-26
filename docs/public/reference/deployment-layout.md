# 环境与部署布局

为现有项目接入 Harness Kit 时，先看文件由哪个应用消费、由哪个工具读取。把同一部署单元的文件放在一起，保留工具或框架要求的原生入口。按实际需求建立目录。

| 内容 | 建议位置 |
|---|---|
| 环境变量读取、类型校验、安全默认值 | 放在使用变量的应用中，例如 `apps/api/src/config/` |
| 环境变量示例 | `.env.example` 放在使用它的应用或部署单元旁，使用占位值 |
| Compose 和 Kubernetes 等交付文件 | 和部署单元放在一起，或按目标放进 `deploy/local/`、`deploy/production/` 等目录 |
| 基础设施和运维 | 有对应工作时，分别使用现有基础设施目录（如 `infra/`）和运维目录（如 `ops/`） |
| GitHub Actions 工作流 | `.github/workflows/`，可调用部署目录或项目脚本里的命令 |

真实的本地环境值使用 Git 忽略的文件。生产凭据通过部署平台的运行环境或密钥管理器注入。公开的配置只记录可公开的参数、路径和占位值。

## 迁移后验证

1. 找到项目脚本及 CI 中读取这些文件的命令。移动 Compose 文件时，核对 `-f`、`--env-file`、相对挂载路径、构建上下文及 Docker 忽略文件。
2. 使用项目原生工具在目标运行目录校验渲染结果、构建输入或测试环境。涉及运行状态时，核对目标环境和回退方式。
3. 目录约定确定后，可从 v0.8.1 起配置 [`files.layout`](configuration.md#file-location-rules)，用 `harness check` 检查位置。`harness run` 同时执行配置的项目验证。

## 按任务查阅 Agent 提示

| 正在处理的任务 | Skill 中对应参考 |
|---|---|
| 修改变量、环境文件或密钥注入 | `references/environment.md` |
| 修改部署路径、容器、流水线或运维流程 | `references/deployment.md` |
| 调整模块边界、共享契约或跨组件设计 | `references/architecture.md` |
| 分配专家职责 | 查阅[角色目录](roles.md)并选择相应角色 |

已加载 Harness Kit Skill 的 Agent 可以按任务查阅这些参考。部署改动同时涉及环境变量时，可补读环境配置参考。专业分工可使用同一会话中的角色提示，或通过宿主支持的委派方式执行。
