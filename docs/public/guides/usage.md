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

改动有关源码或配置后，用 `harness run` 刷新验证记录。`run --task <验证任务 ID>` 仅验证所选任务及其依赖。要确认宿主实际加载了 Skill 或项目指令，请在新会话中检查。命令用途见 [CLI 命令速查](../reference/cli-and-skill.md#command-reference)。运行 `harness help --all` 可查看所用版本的参数。

## 维护公开文档

文档位置规则需要 Harness Kit v0.8.1 或更新版本。

1. 新增、编辑或移动页面前，确认读者和用途，按[目标项目布局](../reference/project-layout.md#public-documentation)选择位置，并查看项目已有的文档规则。
2. 首次设置时，在 `harness.config.json` 中按目录和文件类型配置[位置规则](../reference/configuration.md#document-location-rules)。后续新增符合规则的页面时，沿用现有配置。以配置参考中的示例为例，`docs/public/setup.md` 会触发 `documents.layout`。报告会列出该文件、`public-pages` 规则和允许的位置。将安装说明移到 `docs/public/guides/setup.md`，更新引用和导航，再运行 `harness check`。`harness run` 也会检查位置，并执行配置的项目任务。
3. 让 Agent 从目标读者的角度通读改动页面及受影响的导航，核对阅读顺序、前提、命令、链接和适用版本。CLI 的位置检查只匹配路径。需要全量审读时，让 Agent 先枚举所有维护中的公开页面，覆盖未列入导航的页面和公开 README 等入口。

将下面的审读请求交给已加载 Harness Kit Skill 的 Agent。

```text
请审读所有维护中的公开文档，覆盖导航之外的页面和仓库公开入口。检查读者能否按文档完成操作，并核对前提、命令、链接及适用版本。按文件报告问题、建议修正和未覆盖范围。
```

## 保存任务与交接

Claude Code、Codex 和 Gemini CLI 在同一项目目录工作时，可以用任务 ID 接续。以下示例使用 v0.8.1 新增的 `--brief`。

1. 开始工作时记录目标和验收项。

   ```sh
   harness task start order-search --title "实现订单查询" --accept "可按订单号查询并显示结果" --brief
   ```

2. 在阶段完成或遇到阻塞时，写一条短笔记。记录关键文件或提交、已执行的检查和阻塞，把接手后的第一步放进 `--next`。

   ```sh
   harness task note order-search --note "查询接口已实现，入口为 src/orders，接口单测通过" --next "接入查询页面并验证完整流程" --brief
   ```

3. 把 `order-search` 交给接手的 Agent。让它打开同一项目目录，运行恢复命令，对照工作树和验收状态继续。会话意外中断时也可以这样恢复，以已保存的笔记和磁盘上的改动为准。

   ```sh
   harness task resume order-search --brief
   ```

日常使用 `--brief`，需要历史笔记或详细验收证据时再用 `harness task status order-search --json`。换检出目录或机器时，用 `harness task handoff order-search` 生成交接文本，并单独交付代码改动。详见[精简输出](../reference/tasks.md#brief-output)和[跨宿主接续](../reference/tasks.md#switch-agent-hosts)。

- 分配前端、后端、测试或审查等职责时，查阅[角色](../reference/roles.md)和[协作流程](../reference/collaboration.md)。
- 生成截图、日志、报告或评审稿前，先用 `harness artifacts create` 分配任务目录。目录约定和到期清理见[产物管理](../reference/artifacts.md)及[项目布局](../reference/project-layout.md)。
- 需要会话开始提醒或结束前的验证检查时，查阅[可选会话 Hook](../reference/configuration.md#optional-local-hooks)。
- 从已有项目归纳编码与架构约定时，使用[编码习惯提炼](coding-style.md)。公开导出与历史审计步骤见[公开导出与审计](../reference/publication-boundary.md#导出与审计)。
