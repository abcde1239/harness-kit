# Harness Kit

通用的 harness-lint 创建与治理工具，提供 **交互 CLI + Codex Skill**。通过问答适配新项目或已有项目，支持 monorepo，保留原有测试框架，并检查内部文档的公开边界。

需要 **Bun ≥ 1.3.4**；仓库检查另需 Git。

## 安装与使用

克隆本仓库后安装：

```sh
git clone https://github.com/abcde1239/harness-kit.git
cd harness-kit
bun run setup
```

安装器提供 `harness` / `harness-kit` 短命令和 Codex Skill。若提示 bin 目录不在 PATH，按提示添加后重开终端。

在**目标项目**的终端运行：

```sh
harness
```

按中文向导回答需求、预览并应用变更。已有文件发生冲突时保留原内容。

## 使用 Skill

安装后，在目标项目的新 Codex 会话中输入：

```text
$harness-kit 为当前项目配置 harness-lint，保留现有测试框架，内部开发文档不公开。
```

## 常用命令

```sh
harness setup     # 初始化或调整配置
harness inspect   # 扫描项目
harness lint      # 检查项目约定
harness verify    # 检查约定并执行配置的任务
harness help      # 完整命令
```

## 文档

- [使用指南](docs/public/guides/usage.md)：安装选项、配置、自动化与发布检查
- [目标项目布局](skills/harness-kit/references/project-layout.md)：目录职责、文档分类与测试放置
- [公开与内部资料边界](docs/public/reference/publication-boundary.md)：源码和使用文档可公开；memory、决策及开发过程资料保留私有
- [Monorepo 配置示例](examples/monorepo.config.json)

## 开发验证

```sh
bun run verify
bun run harness lint --json
```
