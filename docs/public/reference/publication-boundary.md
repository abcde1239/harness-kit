# 公开与内部资料边界

本仓库的公开交付是 Bun CLI、核心模块、测试、Codex Skill 与使用文档。内部开发资料可以进入私有 Git，但不进入公开仓库或其历史。

| 范围 | 本项目位置 | 处理方式 |
|---|---|---|
| 使用入口 | 根 README.md | 公开 |
| 详细公开文档 | docs/public/guides、reference、examples | 按公开清单导出 |
| 产品实现 | bin、src、scripts | 公开；脚本不能依赖内部任务表 |
| 自动测试及合成 fixtures | tests | 公开；真实项目资料不放入 fixtures |
| Skill 与参考资料 | skills/harness-kit | 公开；安装时构建自包含 CLI |
| 示例、包配置与 CI | examples、package.json、harness.config.json、.gitignore、.github/workflows | 公开 |
| PRD、决策、开发任务和验收过程 | docs/prd、docs/decision、docs/tasks、docs/verification、docs/harness-*.md | 保留私有源目录 |
| 内部协作说明 | docs/structure.md、docs/agent_guide.md | 保留私有源目录；通用目录说明通过 Skill 参考文档公开 |
| 开发记忆 | MEMORY.md、memory、memories | 保留私有源目录 |
| 本地状态和运行产物 | .harness、artifacts、coverage、dist、build、依赖及本地环境文件 | 不提交；另行发布需重新审阅和核对来源 |

当前根配置以 `documents.publicRoots/publicPatterns` 为允许清单，内部规则优先。未分类文件默认内部。`package.json` 的 `private: true` 只防止包注册表发布，不能保护 GitHub 内容；`.gitignore` 也不能删除已跟踪文件或历史。

提交公开版本时，从私有源目录执行 `export`，核对 manifest 的路径、来源与 SHA-256，再执行 `publication-check`。只在这个不含 `.git` 和内部资料的新快照中建立提交。保留发布清单和检查报告于私有源目录。后续修改必须重新生成或复验，不能沿用旧报告。

公开快照应能独立运行 `bun run verify` 和 `bun run harness lint --json`，不需要内部 PRD、任务表或 memory。CI 使用 Bun，配置 Windows 和 Linux 两种环境；实际通过情况以 GitHub Actions 的运行结果为准。

若同步到已有公开仓库，还需审计目标仓库的历史及托管附属内容。直接把私有仓库改成公开会暴露可达历史，删除当前文件不能代替历史审阅。工具不会自动改变仓库可见性或强推历史。
