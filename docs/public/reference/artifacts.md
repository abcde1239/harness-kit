# 产物管理

一次任务有日志、截图、测试报告或追踪文件需要落盘时，用 CLI 分配一个目录。参与同一任务的 Agent 复用这个目录，各自使用有明确用途的文件名或子目录。保留足以说明结果和重现问题的文件。例如，浏览器验收可以产出 `browser/checkout.png` 和 `tests/results.json`，无需在 `artifacts/` 根目录为每轮尝试新建文件夹。

| 位置 | 用途 |
|---|---|
| `.harness/` | Harness 的接入、计划、任务、验证摘要和发布审阅状态 |
| `artifacts/runs/<id>/` | 一次工作的临时产物，`run.json` 由 CLI 维护 |
| `artifacts/releases/`、`artifacts/distribution/`、`artifacts/skill/`、`artifacts/snapshots/` | 按版本或用途组织的发布包、Skill 和导出快照 |
| `artifacts/archive/` | 留作参考的历史产物 |
| `docs/verification/` | 长期维护的验收方法和结论 |
| 项目原有源码、测试或框架产物目录 | 可复用脚本、可执行测试、测试夹具，以及框架自己管理的覆盖率等文件 |

```sh
harness artifacts create checkout-e2e --json
harness artifacts finish <id>
harness artifacts keep <id>
harness artifacts clean
harness artifacts clean --yes
```

第一条命令返回 `id` 和相对于项目根的 `path`。把该路径交给执行者和支持指定输出位置的测试工具。所有写入者结束后运行 `finish`。如果外部文档或工单会长期引用这个目录，先用 `keep` 保留，待引用不再需要时用 `release` 恢复保留期规则。

## 设计稿与评审素材

生成前先执行 `harness artifacts create <label>`。把可编辑稿、临时 HTML 原型、对比导出图和评审截图写入返回目录下的 `design/`，交给参与评审的人复用。已经采纳的设计规范与决策保存在项目约定的文档目录。长期维护的图示、站点素材使用文档原有的资源目录。

`harness check` 和 `harness run` 会报告根目录和工作区 `docs/` 下的常见原生设计文件，以及通过名称或目录能辨认的临时评审素材。例如 `docs/design/checkout.html`、`docs/assets/checkout-mockup.png` 和 `docs/首页设计稿.png`。`documents.artifacts` 默认报错。确需保留的文档素材可以把文件的精确路径加入 `documents.artifactAllowlist`。该例外只影响目录检查，发布边界仍由项目的公开策略决定。

遇到已有的误放稿件，先核对用途和引用，迁入本次运行目录后再更新引用。`artifacts clean` 只清理登记的已结束运行目录；`docs/` 里的文件由维护者处理。

## 保留期与清理

默认保留 **14 天**。在 `harness.config.json` 里用 `"artifacts": { "retentionDays": 14 }` 调整。保留期从完成时间和最近文件或目录修改时间中较晚的一项算起。`clean` 默认预览，`--yes` 才删除。清理范围是 `artifacts/runs/` 中已登记、已结束并到期的目录。进行中的运行、手动保留的运行、`.harness/tasks/` 已记录引用的运行、Git 索引中的文件，以及包含链接、特殊文件或 Git 元数据的目录会保留。`check`、`run`、安装和发布不会触发清理。

`check` 中，`storage.state` 会报告 `.harness/` 里的非约定文件。自定义 JSON 状态可放在 `.harness/tmp/`，生成报告放运行目录。`artifacts.layout` 默认提示根目录的散落文件和未登记的运行目录。整理完历史目录后，可以在 `rules` 中将该规则设为 `"error"`。`tests.artifacts` 会检查管理范围内可识别的测试源码，即使外层 `artifacts/` 配置了测试路径排除。

`.harness/` 状态保留供 CLI 读取，产物清理不会删除任务、验证或 Hook 状态。Hook 会话快照由独立的 `harness hooks clean` 管理，见[项目目录约定](./project-layout.md)。已有项目继续使用自己的 `.gitignore`，可核对其中是否已忽略本地产物和状态。

迁移时先预览，后按用途检查旧目录。用新结构存放后续产物。已有发布包和验收依据按版本或任务归档，旧仓库和用途不明的目录逐个确认。历史目录、发布目录和框架产物目录均在本命令的清理范围之外。
