---
layout: home
title: Harness Kit
titleTemplate: 把 Agent 接入你已有的项目
description: 保留项目工作方式，执行真实验证，并在需要时恢复任务上下文。
hero:
  name: Harness Kit
  text: 把 Agent 接入你已有的项目
  tagline: 保留项目约定与原生工具链，验证真实改动，并在跨会话协作时保留目标与验收证据。
  image:
    src: /logo-mark.svg
    alt: Harness Kit
  actions:
    - theme: brand
      text: 立即安装
      link: /guides/installation
    - theme: alt
      text: 快速开始
      link: /guides/quickstart
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/abcde1239/harness-kit
features:
  - icon: ◇
    title: 项目优先
    details: 保留现有框架、测试布局、人工修改和项目自己的命令。
  - icon: ✓
    title: 真实验证
    details: 执行已配置的原生任务，记录范围与输入摘要，区分已验证和待确认状态。
  - icon: ↗
    title: 可恢复协作
    details: 保存目标、验收项、备注和下一步，让跨会话与多 Agent 交接有明确上下文。
---

<div class="home-section vp-doc">

## 产品定位

Harness Kit 是项目与 coding agent 之间的接入层。它负责把项目约定、宿主入口、任务验证和可恢复工作记录连接起来；项目仍然掌握框架、测试工具和业务命令。

它适合已经有代码和工作方式的项目：先接入，再按项目原有工具运行验证；需要长期协作时，再增加任务、职责分工或编码习惯提炼。

</div>

<div class="home-section vp-doc">

## 核心功能

<div class="feature-grid">
  <div class="feature-card"><h3>多宿主项目接入</h3><p>为 Codex、Claude Code、Gemini CLI、Cursor、OpenCode 和 DeepSeek Harness 生成对应项目指令入口，并保留用户正文。</p></div>
  <div class="feature-card"><h3>技术栈无关适配</h3><p>识别常见项目标记，也可以用 harness.adapters.json 声明自定义工作区、测试分类和任务命令。</p></div>
  <div class="feature-card"><h3>验证证据与诊断</h3><p>run 执行配置任务，doctor 只读检查证据是否缺失、失败或过期；静态入口不会冒充宿主会话已加载。</p></div>
  <div class="feature-card"><h3>持久任务与验收</h3><p>保存目标、范围、验收项和交接记录；验收关联当前验证，任务不会自动重放外部操作。</p></div>
  <div class="feature-card"><h3>多 Agent 职责提示词</h3><p>按需使用产品、架构、前后端、测试、文档、UX/UI 和 Agent 专家视角，明确写入范围与交付条件。</p></div>
  <div class="feature-card"><h3>编码习惯提炼</h3><p>从指定项目生成带来源、范围和反例的编码与架构规则；规则是有证据的协作参考，不是自动 lint 门禁。</p></div>
</div>

</div>

<div class="home-section vp-doc">

## CLI 安装命令

发布包已经包含完整 CLI，不需要在源码目录运行 `bun setup`，也不要求全局 `harness` 命令。先从 [v0.7.0 Release 下载 install-plugin.mjs](https://github.com/abcde1239/harness-kit/releases/download/v0.7.0/install-plugin.mjs)，让 Agent 询问默认位置还是自定义目录，再在文件所在目录运行：

```powershell
node install-plugin.mjs --source https://github.com/abcde1239/harness-kit/releases/tag/v0.7.0 --host skill --location default
```

运行环境需要 **Node.js ≥ 22.12.0 或 Bun ≥ 1.3.4**。安装后，Skill 或插件会调用实际加载目录中的 CLI：

```text
node <installed-skill-directory>/scripts/harness.mjs init --root <project-absolute-path> --private --yes --json
```

源码开发者也可以安装依赖后使用 `harness` 短命令；这不是分发包的必要步骤。完整安装方式见[安装指南](/guides/installation)。

</div>

<div class="home-section vp-doc">

## 快速开始

<div class="flow-grid">
  <div class="flow-step"><strong>1 · 安装</strong>把 Release 或仓库链接交给 Agent，选择默认或自定义位置。</div>
  <div class="flow-step"><strong>2 · 接入</strong>让 Agent 识别项目、宿主和已有测试命令，先查看变更预览。</div>
  <div class="flow-step"><strong>3 · 验证</strong>运行配置任务，再用 doctor 查看证据与环境状态。</div>
  <div class="flow-step"><strong>4 · 继续</strong>需要跨会话时创建任务，绑定验收并在完成前重新验证。</div>
</div>

复制下面的请求即可开始：

```text
Use harness-kit to onboard and verify this project.
Preserve its framework, native commands, and existing user instructions.
Ask whether the plugin should use the default installation location or a custom directory before installing.
```

小改动可以直接接入并验证；需要恢复或交接时，再阅读[持久任务与验收](/reference/tasks)。

</div>

<div class="home-section vp-doc">

## CLI 与 Skill 的协作关系

Skill 或原生插件负责让宿主发现使用说明，并把用户目标路由到共享 CLI。CLI 负责读取项目配置、规划任务、调用项目原生工具和记录验证结果；它不会替换项目的测试框架、模型账号或权限系统。

<div class="flow-grid">
  <div class="flow-step"><strong>Skill / Plugin</strong>宿主发现与英文工作指令</div>
  <div class="flow-step"><strong>Bundled CLI</strong>inspect、init、run、check、doctor</div>
  <div class="flow-step"><strong>Project state</strong>配置、适配器、任务与验证证据</div>
  <div class="flow-step"><strong>Native tools</strong>项目自己的测试、lint、类型检查和构建命令</div>
</div>

“已配置”“已验证”和“宿主会话已加载”是三个不同结论。DSH 原生插件仍是 developer preview；本项目不提供后台调度器、模型路由或权限沙箱。

</div>

<div class="home-section vp-doc">

## 文档导航

| 你要做什么 | 从这里开始 |
|---|---|
| 安装 Skill 或插件 | [安装指南](/guides/installation) |
| 接入项目并运行验证 | [使用指南](/guides/usage) |
| 了解当前能力与边界 | [能力与适用范围](/reference/capabilities) |
| 添加其他技术栈 | [技术适配器](/reference/adapters) |
| 跨会话恢复和人工验收 | [持久任务](/reference/tasks) |
| 组织多 Agent 分工 | [协作与职责](/reference/collaboration) · [职责角色](/reference/roles) |
| 提炼编码与架构习惯 | [编码习惯提炼](/guides/coding-style) |
| 查看版本变化 | [v0.7.0 版本说明](/releases/v0.7.0) |

English users can start with the [English README](https://github.com/abcde1239/harness-kit/blob/main/README.en.md). Maintained Agent prompts and role templates remain in English; user-facing guides follow the current project language.

</div>

<div class="home-section vp-doc">

## GitHub 仓库

查看源代码、Issue、版本附件和贡献方式：[github.com/abcde1239/harness-kit](https://github.com/abcde1239/harness-kit)

文档站内容来自仓库中的 `docs/public`，修改文档后可在本地运行 `bun run docs:dev` 预览，使用 `bun run docs:build` 构建静态站点。

</div>
