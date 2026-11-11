# Professional roles and assignments

The lead chooses roles from the user's goal, existing project, and actual workload. Follow user-requested ownership; a small task may use one Agent sequentially in several roles. Create subagents only with authorization and real host tools. Do not create an Agent for every role by default.

## Choose a role

| Work needed | Role and reusable prompt | Handoff |
|---|---|---|
| Unclear requirements, scope tradeoffs, business acceptance | [Product manager](roles/product-manager.md) | Design, architecture, implementation, QA |
| User journeys, interaction, visual design, accessibility | [UX/UI expert](roles/ux-designer.md) | Frontend and QA |
| Cross-module boundaries, shared interfaces, data contracts | [Architecture expert](roles/architect.md) | Frontend, backend, integration lead |
| Pages, client UI, interaction, state | [Frontend expert](roles/frontend.md) | Integration lead and QA |
| Service logic, APIs, storage, authorization | [Backend expert](roles/backend.md) | Frontend, QA, integration lead |
| Acceptance cases, regression, automation, defect reproduction | [QA expert](roles/qa.md) | Implementers and integration lead |
| Independent conformance review | [Code reviewer](collaboration.md#read-only-reviewer-prompt) | Integration lead; read-only by default |
| README, user guides, first-user reading | [Documentation expert](roles/documentation.md) | Editor and integration lead |
| Assess or improve Agent behavior, constraints, context, tools, evaluation | [Agent expert](roles/agent-expert.md) | Instruction/tool owner and integration lead |

Read this page and the [collaboration conventions](collaboration.md), then only the selected role files. Do not load every profile or invent a context-manager, universal delegation API, or background Agent. Reusable instructions and delegation prompts are English. Preserve quoted user input and code; use the user's requested language for user-facing communication.

## Compose an assignment

Combine this brief with the chosen role's prompt. Replace placeholders and send it through the host's actual delegation tool. A role supplies a professional perspective; this brief determines ownership, authority, and acceptance.

```text
Role: <responsibility>. Mode: <implementation / review / verification>.
Goal: <one observable outcome>.
Project: <verified absolute root>.
Requirements and inputs: <user request, relevant files, confirmed decisions>.
Applicable style rules: <adopted rule IDs, scope, and location; explicitly none if absent>.
Work/criterion IDs: <existing IDs; explicitly unused when not using durable tasks>.
Exclusive writes: <specific files/directories; none for read-only review>.
Read-only/shared inputs: <other modules and shared contracts; named owner>.
Permitted verification outputs: <temporary directories, caches, reports; no writing commands if writes are prohibited>.
Dependencies: <confirmed contracts, pending deliveries, independent work allowed before them>.
Acceptance: <expected behavior, applicable commands, cwd, human inspection>.
Stop conditions: <missing decisions, scope conflicts, unavailable dependencies, retry budget>.

Deliver only the assigned outcome. Preserve the project's stack and conventions; do not replace frameworks, add dependencies, or expand requirements on your own.
Request concrete boundary/interface changes from the integration lead rather than overwriting others' work.
Do not independently delegate, commit, deploy, publish, or declare the entire work task finished.
Return assigned criteria, actual deliveries/files, interface changes, commands and results, uncovered behavior, and handoff information.
Distinguish implemented, executed, passed, and unverified. Do not report assumptions as facts.
```

A PM proposal is not user approval; a QA report is not whole-task completion; a role name grants no tool permissions. The lead owns the active-task pointer, manual acceptance, and finish.

## Compose a team

- **Small fix:** one implementer and appropriate verification; delegate independent review when useful. Do not require product, architecture, and design meetings first.
- **Frontend/backend feature:** use PM for meaningful ambiguity, UX for new interaction, and architecture for shared contract decisions. Once contracts are known, split frontend/backend by files; QA may design requirement-based cases earlier. The lead integrates and verifies real behavior.
- **Unresolved interface:** parallelize read-only investigation, interaction sketches, or case design. Dependent implementation waits. Label mocks and assumptions; mock validation is not real integration evidence.
- **Documentation:** one first reader reviews, another edits an assigned scope, then the original reader rereads actual changes. Without a distinct Agent, call it self-review.
- **Agent behavior issue:** have the Agent expert inspect the trace, requirements, prompts, and tool evidence before proposing a change. The recommendation may be no change or an improvement to context/tools/evaluation rather than another prohibition. The actual instruction/tool owner implements an authorized change and the lead checks its results.

Record task, role, file owner, prerequisite delivery, and acceptance ownership briefly. Reuse existing task/spec records instead of creating another project directory for roles.

## Reference sources

These prompts are rewritten for Harness Kit. They adapt professional concerns and handoffs, not upstream fixed languages/frameworks, model selection, coverage/performance targets, personas, or external context-manager protocols.

- [VoltAgent subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/tree/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories): reviewed frontend-developer, backend-developer, qa-expert, product-manager; adapted UI states, interface/data boundaries, risk-based testing, user goals, and scope priorities.
- [contains-studio/agents](https://github.com/contains-studio/agents/tree/a5a480c324cac64b9c569bca0b2f297d517240cb/engineering): reviewed frontend-developer and backend-architect; adapted interaction/error states, compatibility, data constraints, and implementation handoffs.
- [BMad PM](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/skills/bmad-agent-pm/SKILL.md) and [UX](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/skills/bmad-agent-ux-designer/SKILL.md): adapted proportional deliverables, reuse of requirements, and user-flow handoffs without its installer or document engine.

The Agent expert is a Harness Kit role for evidence-based behavior improvement, not a claim of upstream runtime capabilities or a benchmarked performance improvement.
