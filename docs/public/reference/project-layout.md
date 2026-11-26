# Project layout after onboarding

This document describes the target project, not Harness Kit's own source tree. Onboarding adds governance configuration to an existing project; the project retains its business architecture and framework.

## Managed files and state

The CLI's plan/apply workflow manages `harness.config.json`, selected native host instruction files, `docs/agent_guide.md`, `docs/structure.md`, and `.gitignore`. It adds a public entry point when the root `README.md` is missing. Managed sections in existing host files preserve surrounding text and user edits. Existing project READMEs are preserved. Differences in existing gitignore or directory documentation produce conflict guidance. Default directories include `docs/prd`, `docs/decision`, `docs/verification`, `docs/public/guides`, `docs/public/reference`, `docs/public/examples`, and `scripts`. Empty directories are not automatically tracked by Git.

Use `--hosts` to select `codex`, `claude`, `gemini`, `cursor`, `opencode`, or `dsh`. DSH means DeepSeek Harness, also accepted as `deepseek-harness`. Codex, OpenCode, and DSH share `AGENTS.md`; Claude uses `CLAUDE.md`, Gemini uses `GEMINI.md`, and Cursor uses `.cursor/rules/harness-kit.mdc`. An explicit selection in a new project generates only those entries; the default is Codex. Previous selections accumulate, so choosing fewer hosts during later onboarding does not delete files. Selection is stored in onboarding state, without adding `hosts` to the config schema. DSH also reads `CLAUDE.md` and local overlays by default. It deduplicates same-group content only when identical after trimming; review differing existing content. See [configuration](configuration.md) for plugin and Skill discovery boundaries.

Gemini CLI defaults to `GEMINI.md`. Keep one copy of the project rules in Gemini's effective context. If `context.fileName` also includes `AGENTS.md`, both host entries can contribute the same rules. Check `/memory list` for loaded files and `/memory show` for assembled context. Repeated `read_file` calls for the same path without intervening edits point to an agent behavior issue. Check custom `@` imports separately.

Apply maintains `.harness/managed.json`; the wizard saves `.harness/plan.json`. Skill answers may be saved in `.harness/answers.json`. Run stores input digests and validation scope in `.harness/verification.json`; doctor checks their continued applicability without writing. Recoverable tasks live in `.harness/tasks/<id>.json`, with `.harness/active-task.json` as the active pointer. Tasks do not run automatically. Treat plans and task records as internal development material.

Explicit `init --hooks` adds registrations for the supported hosts selected during onboarding. The [configuration reference](configuration.md#optional-local-hooks) covers host activation and local paths.

Digests determine whether existing managed files can be updated safely; conflicts preserve the original files. Onboarding does not generate business source, tests, framework configuration, CI workflows, or `verify.sh`, and does not configure host models or permissions. Earlier gen-new `.agent/*`, guides, and `verify.sh` remain intact; their existence does not prove business tests pass. Static instruction files do not prove a live session has loaded them. Verify host-local and global rules separately.

## What belongs in host instructions

Treat `AGENTS.md` and the equivalent native host files as entry points for agent behavior. Put durable rules that apply across tasks at the repository root, and use the host’s scoped instructions for rules that apply only to a package or directory. Write each rule as a concrete action or constraint. For example, “Run the API compatibility check when changing a public endpoint” belongs in the relevant agent instructions. “Add CSV export with these columns” belongs in the feature specification.

| Content | Source |
|---|---|
| Feature behavior, user stories, and feature acceptance criteria | Existing issue or feature spec, or `docs/prd/` |
| Architecture decisions and their rationale | The existing decision log or `docs/decision/` |
| Repeatable verification methods and test links | Existing test and verification docs, or `docs/verification/` |
| Task progress, handoffs, and verification evidence | Existing task tracker or Harness work records and managed artifacts |
| Reusable development lessons | Existing project memory such as `MEMORY.md` |

Use a short pointer when an agent needs to know when to consult a source. Read it on demand. Avoid copying requirements into multiple host entries or automatically including them through imports. Keep private material out of public entries. Write project-owned rules outside the Harness Kit markers. To reorganize existing user-authored content, review the proposed move and preserve the original source until the destination has been checked.

## Harness state and temporary Hooks

Keep executable tests, fixtures, snapshots, and runner configuration in the framework test layout. Transient test output belongs in its normal output directory or an artifact run. The `storage.state` check recognizes test files and common fixture or snapshot paths even inside `.harness/tmp/`. Use that directory only for JSON documents passed to Harness commands.

| Path | Contents |
|---|---|
| `.harness/hooks/runtime.mjs`, `.harness/hooks/state.json` | Codex runner and ownership record |
| `.harness/hooks/claude/` | Claude Code runner and ownership record |
| `.harness/hooks/dsh/` | DSH runner, ownership record, and the bridge's `hooks.json` |
| `.harness/hooks/sessions/` | Input digests and activity timestamps for all three hosts |

Session records expire after 30 days of recorded inactivity by default. Preview with `harness hooks clean` and apply with `harness hooks clean --yes`. Cleanup only removes expired session records and preserves Git-indexed, busy, malformed, and legacy undated files. Keep project-owned Hook scripts, including experiments, in `scripts/hooks/` or the project's existing Hook directory. The registrations in `.codex/hooks.json` and `.claude/settings.local.json` contain machine-specific paths. Review your local Git exclusions before sharing the project.

See [artifact management](./artifacts.md) for generated files, retention, and cleanup.

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
|-- .harness/                 CLI state
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

## Public documentation

| Content | Typical location |
|---|---|
| Entry points and navigation | `README.md`, `docs/public/index.md`, `docs/public/README.md` |
| Installation and workflow instructions | `docs/public/guides/` |
| Commands, configuration, and behavior | `docs/public/reference/` |
| Worked examples | `docs/public/examples/` |
| Changes and upgrade guidance for individual releases | `docs/public/releases/` |

Keep product requirements, decisions, and verification records under the project's internal directories, such as `docs/prd/`, `docs/decision/`, and `docs/verification/`. Use the project's own directory conventions when they differ. With a compatible CLI, configure [document location rules](configuration.md#document-location-rules) to enforce those conventions. Public and internal path policies govern publication eligibility.

When adding, editing, or moving a public page, review its intended audience, destination, and affected navigation. See the [documentation workflow](../guides/usage.md#维护公开文档) for location checks and Agent review.

## Internal files and Git

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

Discovery uses a shared registry for Go/JS and common Python, Rust, JVM, .NET, PHP, Ruby, C/C++, Dart, Elixir and Swift project markers. It does not evaluate framework configuration or infer a test command from a manifest alone. Project-owned `harness.adapters.json` recipes can add other stacks without changing the CLI; see [technology adapters](adapters.md). Static test-file recognition includes common language conventions and can be replaced with `tests.detect` per project or workspace. `tests.detect` identifies test files, while `tests.include` governs allowed paths; neither rewrites native runner discovery.

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
- Export public material to a separate new directory such as `artifacts/snapshots/public`, then check the actual manifest and files. That directory excludes private Git history. Making the original private repository public also requires history and platform review.

The tool does not upload, change visibility, or clean history automatically. Routine testing does not require a publication audit, and ordinary lint clearance does not authorize publication.
