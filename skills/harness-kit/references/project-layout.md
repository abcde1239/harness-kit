# Project layout after onboarding

This document describes the target project, not Harness Kit's own source tree. Onboarding adds governance configuration to an existing project; the project retains its business architecture and framework.

## Managed files and state

The CLI's plan/apply workflow manages `harness.config.json`, selected native host instruction files, `docs/agent_guide.md`, `docs/structure.md`, and `.gitignore`. It adds a public entry point when the root `README.md` is missing. Managed sections in existing host files preserve surrounding text and user edits. Existing project READMEs are preserved. Differences in existing gitignore or directory documentation produce conflict guidance. Default directories include `docs/prd`, `docs/decision`, `docs/verification`, `docs/public/guides`, `docs/public/reference`, `docs/public/examples`, and `scripts`. Empty directories are not automatically tracked by Git.

Use `--hosts` to select `codex`, `claude`, `gemini`, `cursor`, `opencode`, or `dsh`. DSH means DeepSeek Harness, also accepted as `deepseek-harness`. Codex, OpenCode, and DSH share `AGENTS.md`; Claude uses `CLAUDE.md`, Gemini uses `GEMINI.md`, and Cursor uses `.cursor/rules/harness-kit.mdc`. An explicit selection in a new project generates only those entries; the default is Codex. Previous selections accumulate, so choosing fewer hosts during later onboarding does not delete files. Selection is stored in onboarding state, without adding `hosts` to the config schema. DSH also reads `CLAUDE.md` and local overlays by default. It deduplicates same-group content only when identical after trimming; review differing existing content. See [configuration](configuration.md) for plugin and Skill discovery boundaries.

Apply maintains `.harness/managed.json`; the wizard saves `.harness/plan.json`. Skill answers may be saved in `.harness/answers.json`. Run stores input digests and validation scope in `.harness/verification.json`; doctor checks their continued applicability without writing. Recoverable tasks live in `.harness/tasks/<id>.json`, with `.harness/active-task.json` as the active pointer. Tasks do not run automatically. Treat plans and task records as internal development material.

Explicit `init --hooks` also merges `.codex/hooks.json` and generates project runners, ownership records, and session summaries under `.harness/hooks`. This adapter is for trusted local Codex sessions, includes machine paths, and belongs in local configuration. Default initialization does not write hooks.

Digests determine whether existing managed files can be updated safely; conflicts preserve the original files. Onboarding does not generate business source, tests, framework configuration, CI workflows, or `verify.sh`, and does not configure host models, permissions, or non-Codex hooks. Earlier gen-new `.agent/*`, guides, and `verify.sh` remain intact; their existence does not prove business tests pass. Static instruction files do not prove a live session has loaded them. Verify host-local and global rules separately.

## Single-project example

This layout suits a private source repository. Optional entries exist as needed; empty directories and a full document set are not required for every change.

```text
project/
|-- harness.config.json       Workspaces, document boundaries, test paths, tasks, baseline
|-- README.md                 Root project guide; public by default
|-- .gitignore                Dependencies, outputs, local environment, temporary records
|-- AGENTS.md / CLAUDE.md / GEMINI.md  Selected host entries; managed sections preserve user text
|-- .cursor/rules/            harness-kit.mdc when Cursor is selected
|-- MEMORY.md                 Optional internal development lessons
|-- .harness/
|   |-- managed.json          Apply-managed digests
|   |-- answers.json          Optional Skill answers
|   |-- plan.json             Reviewable plan
|   |-- verification.json     Local validation evidence bound to current inputs
|   |-- active-task.json      Optional active task pointer
|   `-- tasks/                Recoverable goals, manual acceptance, notes, validation links
|-- docs/
|   |-- agent_guide.md        Collaboration and validation conventions
|   |-- structure.md          Directory responsibilities and boundaries; internal
|   |-- prd/                  Internal requirements; optional task tables
|   |-- decision/             Internal significant decisions
|   |-- verification/         Internal acceptance methods linked to tests and commands
|   `-- public/               Public documentation
|       |-- guides/           Usage guides
|       |-- reference/        Interfaces, commands, configuration
|       `-- examples/         Examples and supporting explanations
|-- src/                      Existing business code and framework-compatible adjacent tests
|-- tests/                    Framework-specific integration tests, E2E, fixtures, etc.
|-- scripts/                  Optional orchestration that reuses real runners
`-- artifacts/, coverage/    Outputs according to actual framework configuration
```

Default public paths are the root `README.md` and `docs/public`. Without existing governance configuration, newly generated generic host instructions may be included in proposed public rules. Existing host files and explicit `publicPatterns` are not broadened automatically; review before merging scope. Classify custom instructions containing internal material separately rather than allowing the whole file. Protected paths such as `MEMORY.md`, memory, and decision records can never be public. Default internal scope includes `docs/prd`, `docs/decision`, `docs/verification`, `docs/structure.md`, `docs/agent_guide.md`, and `.harness`. Add other process directories, task records, and Agent context to `internalRoots` or `internalPatterns`. Broad public rules do not replace classification.

The supplied gitignore excludes dependencies, common root build directories, outputs, local env files while retaining `.env.example` and `.env.sample`, logs, OS temporary files, and local Harness answers and plans. Private repositories may commit internal documents and `managed.json`. Declaring a repository public additionally ignores default internal documents, memory/decision records, and all of `.harness`. Custom internal paths need corresponding ignore rules. Existing gitignore files are preserved, with differences merged by the Agent.

Internal material may be tracked in private Git. In an already public repository, move it to a private companion repository or outside the checkout. For local-only storage, keep it untracked and inspect existing history. Directory names, gitignore, and passing ordinary lint cannot clean history.

## Keep tests in framework-native locations

| Existing project | Code location | Harness integration |
|---|---|---|
| Go | Package-local `*_test.go`; fixtures commonly in package `testdata` | Declare tasks per Go module; do not assume a root command covers every module |
| TS + Vitest/Jest | Existing adjacent tests under src or framework test directories | Invoke existing package scripts; verify path mappings before configuring them |
| Native Bun tests | Existing test/spec files and directories | Use the project's own bun test command and state its scan scope |
| Playwright/E2E | Existing framework e2e/tests directories and dedicated configuration | Use separate tasks; declare service dependencies, conditions, and timeouts as needed |
| Other stacks | Existing framework conventions | Configure workspace, argv, cwd, dependencies, and outputs explicitly |

Use `docs/verification` for acceptance methods and links to commands or tests, framework directories for executable tests, and output directories for reports. Scripts orchestrate rather than duplicate assertions. Vite is not a test framework, and discovering a dependency does not prove its framework is configured.

The current discovery logic recognizes common Go/JS entry points and framework dependencies. It does not execute arbitrary framework configuration or fully interpret include/exclude settings. Static test-file recognition covers `.test.*`, `.spec.*`, and `_test.go`; actual runners and project-specific lint handle other names. `tests.include` governs paths and does not rewrite the framework's own discovery configuration.

When multiple stacks share a directory, recipes without path restrictions remain unrestricted. For strict layouts, list every applicable path. `not-configured` means tests are not configured, not that they passed.

## Monorepo example

```text
repo/
|-- harness.config.json       One root governance configuration listing workspaces
|-- docs/, .harness/          Shared document policy and plans
|-- apps/web/                Frontend source, existing tests, framework configuration
|-- services/api/            Backend module, package tests, testdata
|-- packages/shared/         Shared libraries and their tests
`-- tools/custom/            Custom stack and validation entry points
```

The apps/services/packages names are examples; do not move existing directories. Each `workspace.root` points to a real directory, and a task's cwd is relative to its workspace. Workspace test rules may override root test rules; root internal-document protection still applies.

Choose per-package tasks or an existing root aggregate task. Use `covers` on an aggregate to declare which workspaces it validates. `covers` does not disable child tasks with different IDs. Do not configure both an aggregate and children that repeat the same tests. The dependency graph runs each task ID only once per invocation.

## Unified validation and publication

- `harness check` checks project conventions; for public repositories it also checks the Git index.
- `harness run` combines convention checks with configured tasks and retains workspace results and local validation records.
- `harness doctor` diagnoses onboarding and evidence applicability; it does not run tests or confirm live-session loading.
- When `scripts/verify.sh` or a package verify entry exists, define which entry calls the other to avoid recursion. A `test` script must invoke a real test runner.
- CI uses the same configuration and checks. The CLI does not generate workflows automatically. Install a compatible runtime and task-specific tools in CI, and provide an available Harness Kit CLI.
- Export public material to a separate new directory such as `artifacts/public-snapshot`, then check the actual manifest and files. That directory excludes private Git history. Making the original private repository public also requires history and platform review.

The tool does not upload, change visibility, or clean history automatically. Routine testing does not require a publication audit, and ordinary lint clearance does not authorize publication.
