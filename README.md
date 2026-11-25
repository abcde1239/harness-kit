# Harness Kit

[English](README.en.md) · [文档站](https://abcde1239.github.io/harness-kit/) · [版本下载](https://github.com/abcde1239/harness-kit/releases)

Harness Kit 帮你把编码 Agent 接入已有项目，沿用项目的测试和检查命令，并在需要时留存任务目标、进度与验收记录，供下次会话继续。

支持为 Codex、Claude Code、Gemini CLI、Cursor、OpenCode 和 DeepSeek Harness 生成项目指令。Codex 和 Claude Code 提供插件，DeepSeek Harness 原生插件为实验支持。各宿主的安装与功能范围见[安装指南](docs/public/guides/installation.md)和[能力说明](docs/public/reference/capabilities.md)。

需要 **Node.js ≥ 22.12.0 或 Bun ≥ 1.3.4**，Git 相关功能另需 Git。Skill 和插件内置 CLI，无需运行 `bun setup`。终端短命令可按需安装。

## 让 Agent 安装已发布版本

把下面这段发给 Agent。仓库链接选择最新正式版，也可以提供 Release 链接指定版本。

```text
Read https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md.
Install Harness Kit from https://github.com/abcde1239/harness-kit for the current host.
First ask whether I want the default installation location or a custom directory.
```

## 快速开始

安装后开启新会话。在目标项目中告诉 Agent：

```text
Use harness-kit to onboard this project, preserve its existing conventions, and run its existing tests.
```

- [日常使用](docs/public/guides/usage.md)涵盖接入、验证、诊断与任务交接。
- [角色分工](docs/public/reference/roles.md)介绍职责提示词和各宿主的原生角色配置。
- [目录与产物](docs/public/reference/project-layout.md)说明项目指令、`.harness/` 和生成文件的放置规则。
- [编码习惯提炼](docs/public/guides/coding-style.md)说明如何用自己维护的项目归纳编码与架构约定。
