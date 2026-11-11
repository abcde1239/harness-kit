# 快速开始

## 1. 安装

把仓库或 Release 链接交给 Agent。安装前它应询问使用默认位置还是自定义目录。完整命令和宿主差异见[安装指南](installation.md)。

```text
Read https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md.
Install Harness Kit from https://github.com/abcde1239/harness-kit.
Ask whether I want the default installation location or a custom directory before installing.
```

## 2. 接入项目

在目标项目会话中提出：

```text
Use harness-kit to onboard this project.
Preserve the existing framework, native test commands, and user instructions.
```

Agent 会先读取项目约定和现有配置，再展示接入变更。简单项目可以使用：

```powershell
harness init --private --test "bun test ./tests" --yes
```

分发包中的 Skill 调用实际安装目录里的 `scripts/harness.mjs`，不需要全局 `harness` 命令。

## 3. 运行验证

接入后运行项目已有任务：

```powershell
harness run
harness doctor
```

`run` 执行配置任务并记录证据；`doctor` 只读检查证据是否仍对应当前源码和配置。旧证据过期时重新运行适用任务，不要手改验证记录。

## 4. 需要交接时保存任务

```powershell
harness task start release-fix --title "Prepare release fix" --accept "Configured checks pass" --scope src
harness run --work release-fix
harness task accept --criterion c1 --evidence "Current full verification passed"
harness task finish
```

任务记录目标与验收，不会自动重放操作，也不是权限沙箱。进一步了解范围和边界，请看[能力与适用范围](../reference/capabilities.md)。
