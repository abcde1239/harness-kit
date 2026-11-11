export const managedPaths = ['harness.config.json','README.md','AGENTS.md','CLAUDE.md','GEMINI.md','.cursor/rules/harness-kit.mdc','.gitignore','docs/agent_guide.md','docs/structure.md'];
export const directories = ['docs/prd','docs/decision','docs/verification','docs/public/guides','docs/public/reference','docs/public/examples','scripts'];

export const readme = `# 项目说明

本文是项目根目录的公开入口，用于介绍项目用途、安装、快速开始与验证命令。请按实际项目补充说明，内容应适合公开。

详细公开文档按用途放在 docs/public/guides、docs/public/reference、docs/public/examples；有实际内容后再添加对应链接。

接入诊断：harness doctor；约定检查：harness check；运行已配置验证：harness run。未配置测试不代表测试通过。
`;

export const structure = `# 文档目录与资料边界

本文是内部协作说明，解释文档职责与放置方式。

| 路径 | 用途 | 公开边界 |
|---|---|---|
| 根 README.md | 项目介绍、安装、快速开始与公开文档入口 | 默认公开 |
| AGENTS.md / CLAUDE.md / GEMINI.md / .cursor/rules/harness-kit.mdc | 按所选宿主生成的精简协作入口 | 通用生成区块适合公开；现有自定义正文按实际策略分类 |
| docs/public/guides | 面向使用者的操作指南 | 公开 |
| docs/public/reference | 接口、配置和命令参考 | 公开 |
| docs/public/examples | 使用示例与配套说明 | 公开 |
| docs/prd | 内部需求与验收标准 | 内部 |
| docs/decision | 重要技术决策与取舍 | 内部 |
| docs/verification | 验收方法、命令和测试链接 | 内部 |
| docs/agent_guide.md | Agent 协作与验证规范 | 内部 |
| docs/structure.md | 本目录说明 | 内部 |
| MEMORY.md、memory | 开发经验和过程记录 | 内部 |
| .harness | 答案、计划和受管理文件摘要 | 内部 |

测试代码保留框架原生目录；docs/verification 仅说明如何验收，不存放可执行测试。scripts 负责调用，报告与覆盖率放框架产物目录或 artifacts。

内部资料可以提交私有 Git。公开仓库应使用私有伴随仓库或不跟踪的本地资料；gitignore 不会清理已跟踪文件和历史。公开前检查实际产物，私有仓库直接转公开还需审阅全部相关历史与托管资料。
`;

export const guide = `# 项目协作与验证

项目约定由 harness.config.json 记录，所选宿主的原生指令文件提供精简入口：Codex/OpenCode 使用 AGENTS.md，Claude Code 使用 CLAUDE.md，Gemini CLI 使用 GEMINI.md，Cursor 使用 .cursor/rules/harness-kit.mdc。文件配置成功不等于当前宿主已加载，需在新会话确认。先读取相关需求与决策，再修改代码。文档职责见 docs/structure.md。

- 根 README.md 默认公开；详细公开文档放 docs/public/guides、reference、examples。
- docs/prd：需求；docs/decision：重要决策；docs/verification：验收说明。
- memory、decision 等过程材料可进私有 Git，默认不可公开。
- 测试代码保留框架原生目录；验收说明链接测试与命令，不重复抄写断言。
- scripts 仅作编排；报告放框架产物目录。不要为简单修改制造无信息价值的文档。
- 使用 harness doctor 诊断接入，harness check 检查约定，harness run 执行配置任务；没有测试不等于测试通过。
- 日常改动按规模处理：明确范围与验收，保留已有框架；失败先复现，区分实现错误和环境阻塞，再修复并重验。
- 并行协作仅在用户或适用项目指令授权时启用，按独立文件划分职责，约定接口和验收，由负责人整合并核对实际证据。
- 完成编码或系统设计后按项目约定合并 memory，保留来源和适用范围，删除重复与过时结论；内部经验不写入公开入口。
- 发布前检查实际产物；原仓库转公开还需历史与托管资料审阅。
`;

export function gitignore(visibility) {
  const common = `# Dependencies and generated output
node_modules/
/artifacts/
/coverage/
/dist/
/build/

# Local environment (keep distributable examples)
.env
.env.*
!.env.example
!.env.sample
*.log
.DS_Store
Thumbs.db

# Local harness answers, plans and temporary data
/.harness/*
!/.harness/managed.json
`;
  return common + (visibility === 'public' ? `
# Internal development material in a public repository
/.harness/
/docs/prd/
/docs/decision/
/docs/verification/
/docs/agent_guide.md
/docs/structure.md
MEMORY.md
memory/
memories/
decision/
decisions/
` : '');
}
