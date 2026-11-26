export const sharedGuidePath = '.agent/guide.md';
export const legacyGuidePath = 'docs/agent_guide.md';
export const legacyGuidePointer = `# Project collaboration and verification

The shared project guide is now at ../${sharedGuidePath}. Read that project file for collaboration and verification conventions.
`;

export const managedPaths = ['harness.config.json','README.md','AGENTS.md','CLAUDE.md','GEMINI.md','.cursor/rules/harness-kit.mdc','.gitignore',sharedGuidePath,legacyGuidePath,'docs/structure.md'];
export const directories = ['docs/prd','docs/decision','docs/verification','docs/public/guides','docs/public/reference','docs/public/examples','scripts'];

export const publicDocumentationRule = 'For public documentation, identify the intended reader. Cover supported product use, behavior, interfaces, and architecture relevant to that reader. Keep development history, internal decisions, work records, and repository-specific publication procedures internal. When both audiences need the same facts, write a standalone public explanation. Use descriptive headings and neutral prose with minimal personal pronouns. Before adding or editing a public page, identify its public path, reader, and applicable writing rules. Before finishing, reread the entire page and affected navigation as that reader. Verify changed claims, commands, and public links. For a public documentation audit, inventory and read every public page and report coverage and unresolved findings in internal records.';

export const readme = `# 项目说明
`;

export const structure = `# 文档目录与资料边界

本文是内部协作说明，解释文档职责与放置方式。公开文档说明产品用途、使用方式、实际行为、接口和面向读者的原理与结构。需求、决策过程、实现进度、联调验收、发布操作和开发沟通保留在对应的内部资料。需要公开解释同一主题时，从已确认的产品事实独立编写。

| 路径 | 用途 | 公开边界 |
|---|---|---|
| 根 README.md | 项目介绍、安装、快速开始与公开文档入口 | 默认公开 |
| AGENTS.md / CLAUDE.md / GEMINI.md / .cursor/rules/harness-kit.mdc | 长期有效的 Agent 操作规则及按需查阅入口 | 通用生成区块适合公开；现有自定义正文按实际策略分类 |
| docs/public/guides | 面向使用者的操作指南 | 公开 |
| docs/public/reference | 接口、配置和命令参考 | 公开 |
| docs/public/examples | 使用示例与配套说明 | 公开 |
| docs/prd | 内部需求与验收标准 | 内部 |
| docs/decision | 重要技术决策与取舍 | 内部 |
| docs/verification | 验收方法、命令和测试链接 | 内部 |
| .agent/guide.md | 各宿主共享的 Agent 协作与验证规范 | 内部 |
| docs/structure.md | 本目录说明 | 内部 |
| MEMORY.md、memory | 开发经验和过程记录 | 内部 |
| .harness | 接入、任务、验证和发布审阅状态 | 内部 |
| .harness/hooks | 受管 Hook 运行器、归属记录和会话快照 | 本地状态 |
| scripts | 有明确调用入口或依赖关系的验证、开发、运维和打包脚本 | 按公开策略分类 |
| artifacts/runs | CLI 分配的评审设计稿、原型、日志、报告和截图目录 | 临时产物 |

测试源码、夹具和快照放在框架原生目录；docs/verification 仅说明如何验收，不存放可执行测试。验证脚本复用项目原有命令。一次性探针和生成结果使用运行目录或框架约定的输出位置。生成评审设计稿、原型或截图前用 harness artifacts create 分配目录，每项工作复用一个。长期维护的设计说明与预览及其依赖放在项目约定的设计目录，并标明提案或已采用状态。冻结的历史依据按需归档，长期说明链接维护文件或归档快照。

内部资料可以提交私有 Git。公开仓库应使用私有伴随仓库或不跟踪的本地资料；gitignore 不会清理已跟踪文件和历史。公开前检查实际产物，私有仓库直接转公开还需审阅全部相关历史与托管资料。
`;

export const guide = `# Project collaboration and verification

harness.config.json records project conventions. Native host entries are AGENTS.md for Codex/OpenCode/DeepSeek Harness, CLAUDE.md for Claude Code, GEMINI.md for Gemini CLI, and .cursor/rules/harness-kit.mdc for Cursor. Written configuration does not prove the current host loaded it; confirm in a new session. Read relevant requirements and decisions before editing. See docs/structure.md for document responsibilities.

- The root README.md is public by default; detailed public documentation belongs in docs/public/guides, reference and examples. ${publicDocumentationRule}
- Keep native host entries concise and scoped to durable agent rules. Put project-owned rules outside the Harness Kit markers. When changing environment configuration, deployment, architecture, or specialist assignments, load only the applicable references from the installed Harness Kit Skill.
- Keep feature requirements and acceptance criteria in the existing specs (docs/prd by default), significant decisions in docs/decision, and repeatable verification methods in docs/verification. Use existing task records or Harness work tasks for progress and handoffs. Refer to those sources on demand.
- Memory, decisions and development records may be committed to private Git; keep them internal by default.
- Keep executable tests in framework-native locations. Acceptance documents link tests and commands rather than duplicating assertions.
- Use scripts for orchestration and framework output directories for reports. Avoid documents that add no information to a small change.
- Use harness doctor to diagnose onboarding, harness check to check conventions, and harness run to execute configured tasks. Missing tests do not mean tests passed.
- Match the workflow to the change: establish scope and acceptance, preserve existing frameworks, reproduce failures, distinguish implementation errors from environment blockers, then fix and verify.
- Extract coding style and architecture habits from explicitly selected projects when requested. Store profiles and rules in docs/decision/coding-style by default. Apply only adopted RULES.md rules relevant to this task; candidate rules are references. Preserve project configuration and do not scan or rewrite other projects automatically.
- Delegate only when authorized by the user or applicable project instructions and supported by actual tools. Give each subagent a name that identifies its responsibility, such as tester or checkout-frontend. Use the host’s name field when available; otherwise, include the label in the task brief. Assign independent writable files, interfaces and acceptance; the lead integrates changes and checks actual evidence.
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
/${sharedGuidePath}
/${legacyGuidePath}
/docs/structure.md
MEMORY.md
memory/
memories/
decision/
decisions/
` : '');
}
