# 接入后的项目架构

本文描述目标项目的布局，不是 Harness Kit 工具自身的源码结构。接入是在现有项目上增加治理配置；业务架构和框架仍由项目决定。

## 实际生成范围

CLI 的 plan/apply 管理 `harness.config.json`、`docs/agent_guide.md`、`docs/structure.md`、`.gitignore`，在缺少根 `README.md` 时补充公开入口。已有项目 README 保留；已有 gitignore 和目录说明发生差异时给出冲突建议。默认目录包括 docs/prd、docs/decision、docs/verification、docs/public/guides、docs/public/reference、docs/public/examples 和 scripts。没有内容的目录不会自动成为 Git 跟踪项。

apply 维护 `.harness/managed.json`；向导保存 `.harness/plan.json`。Skill 的答案可放 `.harness/answers.json`。计划包含完整建议内容，应作为内部开发资料管理。

已有文件按摘要判断是否安全更新；冲突保留原文件。不会自动生成业务源码、测试用例、框架配置、CI workflow、AGENTS.md、verify.sh 或各 Agent 品牌目录。原 gen-new 的 `.agent/*`、指南和 verify.sh 保留；它们的内容不意味着已有业务测试通过。

## 单项目参考布局

以下组合适用于私有源仓库；可选项按需要存在，不要求空目录或每次改动写全套文档。

```text
project/
├── harness.config.json       工作区、文档边界、测试路径、任务、baseline
├── README.md                 根项目说明，默认公开
├── .gitignore                依赖、产物、本地环境与临时记录
├── AGENTS.md                 可选，沿用现有协作入口并链接 agent_guide
├── MEMORY.md                 可选，内部开发经验
├── .harness/
│   ├── managed.json          apply 的管理摘要
│   ├── answers.json          Skill 回答记录，按需保存
│   └── plan.json             可审阅计划
├── docs/
│   ├── agent_guide.md        协作与验证约定
│   ├── structure.md          各目录文档职责与边界（内部）
│   ├── prd/                 内部需求；任务表可按需放在这里
│   ├── decision/            内部重要决策
│   ├── verification/        内部验收方法，链接测试和命令
│   └── public/              公开文档
│       ├── guides/          使用指南
│       ├── reference/       接口、命令和配置参考
│       └── examples/        示例与配套说明
├── src/                     现有业务代码与框架允许的邻近测试
├── tests/                   按框架需要存在：集成、E2E、fixtures 等
├── scripts/                 按需编排入口，复用真实 runner
└── artifacts/、coverage/    按实际框架配置存放运行产物
```

默认公开路径包括根 README.md 与 docs/public；显式配置继续优先，已有项目若 publicPatterns 已覆盖默认值，接入新约定时应把 README.md 合并进去。`MEMORY.md`、memory/decision 等受保护路径始终不可公开。默认内部范围包括 docs/prd、docs/decision、docs/verification、docs/structure.md、docs/agent_guide.md 和 .harness。其他过程目录、任务记录和 Agent 上下文应在配置中加入 internalRoots/internalPatterns；不要用宽泛公开规则代替分类。

自带 gitignore 忽略依赖、常见根构建目录、产物、本地 env（保留 .env.example/.env.sample）、日志、操作系统临时文件，以及 .harness 的本地答案和计划。私有仓库保留内部文档和 managed.json 可提交；声明为公开仓库时额外忽略默认内部文档、memory/decision 和整个 .harness。自定义内部路径仍需补充忽略规则。已有 gitignore 保留并由 Agent 合并差异。

内部资料可以进入私有 Git；对已经公开的仓库，这些内容应移到私有伴随仓库或仓库外。若只留本地，须保持不跟踪，并检查已有历史。目录命名、gitignore 和一次普通 lint 通过都不能清理历史。

## 测试随框架放置

| 项目现状 | 代码位置 | harness 的接入方式 |
|---|---|---|
| Go | 包内 `*_test.go`，fixtures 常用包内 testdata | 每个 Go module 声明任务；不假定根命令覆盖全部 module |
| TS + Vitest/Jest | 保留原 src 下邻近测试或框架 tests 目录 | 调用原 package script，路径映射经核实后显式填写 |
| Bun 原生测试 | 保留现有 test/spec 文件和目录 | 用项目自己的 bun test 命令，明确扫描范围 |
| Playwright/E2E | 保留框架 e2e/tests 目录及专属配置 | 建独立任务，按需声明服务依赖、运行条件和超时 |
| 其他栈 | 保留其框架习惯 | 显式 workspace、argv、cwd、依赖和产物配置 |

docs/verification 记录“如何验收”和命令/测试链接；可执行测试放框架目录，报告放输出目录。scripts 只编排，不重复实现断言。Vite 不是测试框架，发现依赖也不等于框架已配置。

当前发现器识别 Go/JS 常见入口和框架依赖，不执行任意框架配置文件，也不完整解析其 include/exclude。当前静态测试文件识别覆盖 `.test.*`、`.spec.*`、`_test.go`；其他命名由实际 runner 及项目专用 lint 保证。`tests.include` 是治理路径规则，不会改写框架自身的测试发现配置。

多个技术栈共用目录时，未限定路径的配方保持未限定；需要严格布局时列出所有适用路径。`not-configured` 表示没有配置测试，不表示测试通过。

## Monorepo 参考布局

```text
repo/
├── harness.config.json       一份根治理配置，集中列出各工作区
├── docs/、.harness/          共用文档政策和计划
├── apps/web/                前端源码、原测试及框架配置
├── services/api/            后端 module、包内测试、testdata
├── packages/shared/         共用库及其测试
└── tools/custom/            自定义栈及其验证入口
```

apps/services/packages 只是示例名；现有目录不迁移。配置中的 workspace.root 指向真实目录，任务 cwd 相对所属工作区。工作区测试规则可覆盖根规则，根内部文档保护继续生效。

执行选择逐包任务或已有根聚合任务；聚合任务用 `covers` 声明验证了哪些工作区。`covers` 本身不会自动禁用另一个 ID 的子任务：不要同时配置根聚合和重复执行同一测试的子任务。依赖图只保证同一个任务 ID 在一次执行中运行一次。

## 统一验证与发布

- `harness lint`：只检查项目约定；公开仓库同时检查 Git index。
- `harness verify`：约定检查加配置任务，保留每个工作区的结果。
- 有 scripts/verify.sh 或 package verify 入口时，明确它与 harness 谁调用谁，避免递归。`test` 脚本应调用真实测试 runner。
- CI 使用相同配置和检查入口；当前 CLI 不自动写 workflow，需要在 CI 安装 Bun、配置任务需要的工具，并提供可用的 Harness Kit CLI。
- 公开导出到独立新目录，例如 artifacts/public-snapshot，检查真实 manifest 和文件；该目录不带私有 Git 历史。原私有仓库直接转公开还需 history 与平台资料审阅。

工具不自动上传、切换可见性或清理历史。日常测试无需执行发布审计，普通 lint 通过也不等于允许公开发布。
