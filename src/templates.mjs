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

export const guide = `# Project collaboration and verification

harness.config.json records project conventions. Native host entries are AGENTS.md for Codex/OpenCode/DeepSeek Harness, CLAUDE.md for Claude Code, GEMINI.md for Gemini CLI, and .cursor/rules/harness-kit.mdc for Cursor. Written configuration does not prove the current host loaded it; confirm in a new session. Read relevant requirements and decisions before editing. See docs/structure.md for document responsibilities.

- The root README.md is public by default; detailed public documentation belongs in docs/public/guides, reference and examples.
- Use docs/prd for requirements, docs/decision for significant decisions, and docs/verification for acceptance guidance.
- Memory, decisions and development records may be committed to private Git; keep them internal by default.
- Keep executable tests in framework-native locations. Acceptance documents link tests and commands rather than duplicating assertions.
- Use scripts for orchestration and framework output directories for reports. Avoid documents that add no information to a small change.
- Use harness doctor to diagnose onboarding, harness check to check conventions, and harness run to execute configured tasks. Missing tests do not mean tests passed.
- Match the workflow to the change: establish scope and acceptance, preserve existing frameworks, reproduce failures, distinguish implementation errors from environment blockers, then fix and verify.
- Extract coding style and architecture habits from explicitly selected projects when requested. Store profiles and rules in docs/decision/coding-style by default. Apply only adopted RULES.md rules relevant to this task; candidate rules are references. Preserve project configuration and do not scan or rewrite other projects automatically.
- Delegate only when authorized by the user or applicable project instructions and supported by actual tools. Assign independent writable files, interfaces and acceptance; the lead integrates changes and checks actual evidence.
- Write maintained agent prompts, instructions and templates in English. Respond in the user's requested language and preserve original user requirements, quotations, code and user-owned text.
- For observed agent behavior concerns, assess requirements, context, tools, workflow, prompts and verification. Choose a minimal scoped constraint, capability improvement, simplification or no change based on evidence; evaluate the original case and a valid contrasting case.
- After coding or system design, consolidate project memory with sources and applicability; remove duplicate or obsolete lessons and keep internal experience out of public entry points.
- Check actual artifacts before publishing. Making an existing repository public also requires history and hosted-material review.
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
