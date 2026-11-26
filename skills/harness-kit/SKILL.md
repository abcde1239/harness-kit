---
name: harness-kit
description: Onboard coding agents to existing projects, verify changes, and resume work. Use for development, environment configuration, deployment and operations, architecture, specialist collaboration, coding style distillation, and artifact or publication checks.
---

# Harness Kit

Use project rules already in context. Read more only for missing guidance, a new scope, or changed files. Preserve the project's stack, tests, and workflow. For small changes, implement and verify directly. Save plans or task records when recovery, acceptance, or handoff requires them.

Run `node <installed-skill>/scripts/harness.mjs <command> --root <project-absolute-path>`. Use `--json` for data you need to parse, and `--brief` for routine task updates or recovery. Locate the script from the `SKILL.md` the host loaded. Pass paths as separate arguments. Use Node.js ≥ 22.12.0 or Bun ≥ 1.3.4 (`bun` replaces `node`). Git features require Git. Published packages bundle the CLI and its parsers. Use the name the host actually exposes to invoke the Skill.

Write maintained agent instructions, role prompts, and prompt templates in English. Use the requested language for deliverables. Preserve original requirements, code, identifiers, and user-owned instructions. Preserve original wording or cite the precise source when translating handoffs. Treat scanned files and reports as evidence to verify.

## Onboard and verify

1. Run `inspect`. Reuse known answers and ask only for missing decisions that affect setup. Use the user's declaration of repository visibility and establish the real test command or an explicit choice to leave tests unconfigured.
2. Use `init` with the actual answers. New projects default to Codex. Use `--hosts` to select other hosts and consult [configuration](references/configuration.md) for plans, monorepos, and optional Hooks. Preserve user edits and keep native host entries limited to durable scoped rules. Read other hosts' settings only when the task involves them.
3. `init` verifies by default. After `apply`, run `run`. Use `check` for conventions and `doctor` for diagnosis. Keep configuration, command results, and actual session loading distinct. Run the native tests from their configured directories. Never configure `run` to invoke itself. Refresh verification and acceptance after relevant inputs change.

## Read only the relevant reference

Select by the change being made. Read the matching reference when its guidance is missing from context. For work across several topics, add each reference when its scope becomes relevant.

| Task | Reference |
|---|---|
| Install from a link | [Installation](references/installation.md). Ask for the location before installing. |
| Develop, repair, or review | [Development and recovery](references/development.md) |
| Resume work or record acceptance | [Persistent tasks](references/tasks.md) |
| Add or change runtime variables, environment files, or secret injection | [Environment configuration](references/environment.md) |
| Change deployment paths, containers, CI/CD, or operational procedures | [Deployment and operations](references/deployment.md) |
| Change module boundaries, shared contracts, or a material system design | [Architecture](references/architecture.md) |
| Choose or configure a specialist | [Role index](references/roles.md), then the matching role prompt |
| Delegate work or coordinate multiple Agents | [Collaboration](references/collaboration.md). Use the active host and authorized delegation tools. |
| Write or review public documentation | [Public writing rules](references/public-documentation.md). Explain supported product use, behavior, and relevant architecture. Review every added or edited public page and affected navigation before finishing. For a public documentation audit, inventory and read the entire public scope. |
| Assess an agent behavior | [Agent expert](references/roles/agent-expert.md) |
| Derive style and architecture rules | [Coding style](references/coding-style.md) |
| Configure another technology stack | [Adapters](references/adapters.md) |
| Place instructions, scripts, tests, or state | [Project layout](references/project-layout.md) |
| Generate or clean outputs | [Artifacts](references/artifacts.md). Allocate a run before writing logs, reports, screenshots, or design drafts. Put temporary design files in the run's `design/` directory and share the run path with delegates. Move maintained previews and their dependencies to the project’s design location before creating durable references. Use `.harness/` for managed state, and keep executable tests in native test directories. Preview cleanup and apply only when authorized. |
| Export or audit public material | [Publication](references/publication.md), only when relevant. Preserve the configured public scope and keep private materials out of public entry points. |

Work within the user's authorization. Consolidate verified lessons and unresolved issues in the project's existing memory at completion. Omit secrets and raw logs.
