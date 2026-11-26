# Configuration and non-interactive invocation

For technology-neutral discovery and custom stack recipes, see [technology adapters](adapters.md). The adapter registry suggests workspaces and tasks; explicit `harness.config.json` and real project commands remain authoritative.

Resolve all relative path arguments against `--root`. Do not write target-project answers into the Skill directory.

## Installed Skill entry point

Standalone and plugin Skill distributions include a complete `scripts/harness.mjs`. Locate the Skill root from the SKILL.md actually loaded by the host, then run `node <installed-skill-directory>/scripts/harness.mjs <command> --root <absolute-project-path> --json`. No setup, global harness command, or Harness Kit PATH change is required. Node.js >= 22.12.0 or Bun >= 1.3.4 must be executable; choose the available runtime and substitute bun for node when appropriate. Packages include parser libraries but no runtime. Release v0.6.0 and later packages support either runtime; older v0.5.0 archives still require Bun. Git features also require Git. Do not assume a fixed plugin cache path or depend on a source checkout. The script under the source skills/harness-kit directory is a development entry point; install a ZIP or packaged output rather than copying that source directory alone.

The examples below omit this shared prefix; supply the actual paths when invoking them. Users can request onboarding, development, or validation in their preferred language. The optional source `bun run setup` only provides short commands for human terminals. Plugin installation names and Skill invocation names may have host namespaces; use the actual discovered names.

For a single workspace, prefer `init --private --test "bun test ./tests" --yes`. Omit `--test` when an existing script is discoverable. Explicitly use `--no-tests` only when testing is intentionally not configured; missing information does not imply no tests. Use answers/plan for complex configuration or separate review.

Select hosts with `init --hosts claude,gemini,cursor,opencode,dsh`; codex is also supported. dsh means DeepSeek Harness, with deepseek-harness as an alias; use `init --hosts dsh --private --yes` for it alone. Explicit selection in a new project creates only those entries; the default is Codex. Existing projects retain prior selections and add new ones. Complex answers can include `hosts: ["claude", "dsh"]`. Selection belongs to plan.hosts and managed state, not harness.config.json; do not invent config.hosts.

DeepSeek Harness remains a developer preview. Project onboarding generates/merges AGENTS.md and reuses tasks and validation; it does not install dsh or configure its plugins, model, or permissions. Native plugin installation is a separate [installation workflow](../guides/installation.md). The default dsh-base agent-instructions plugin reads AGENTS.md and CLAUDE.md, followed by AGENTS.local.md/CLAUDE.local.md. Files in the same candidate group are deduplicated only when their trimmed contents match exactly; Codex AGENTS.override.md semantics do not apply. Custom profiles, filesystem providers, candidate names, root markers, and maxBytes affect loading. External edits reconcile after later structured file operations or resume; there is no continuous watcher. Confirm sources and budget notices in a real session rather than inferring loading from file existence.

Skill discovery is separate. With dsh-skill and dsh-skill-filesystem enabled, place the complete self-contained Skill under `<projectRoot>/.dsh/skills/harness-kit` or `<projectRoot>/.agents/skills/harness-kit`. User discovery defaults also include `~/.dsh/skills` and `~/.agents/skills`, subject to environment and provider settings. Directory Skills must be direct children of a discovery root. Top-level `<name>.md` flat Skills are supported, but arbitrary nested trees are not scanned recursively. Keep this Skill's scripts/references together. Confirm harness-kit appears in the session catalog before loading it through the host's actual mechanism. CLI short commands do not depend on Skill discovery; `$harness-kit` is not universal host syntax.

```json
{
  "visibility": "private",
  "testCommands": { "root": ["bun", "test"] }
}
```

`managers` maps workspace IDs to bun/pnpm/npm/yarn. Add only reviewed and resolved issue IDs to `acknowledge`. A complete `config` can replace discovery suggestions; start from inspect.suggestedConfig and preserve applicable project fields.

## schemaVersion 1

- repository: visibility is private/public/unknown; unknown blocks repository publication checks.
- workspaces: array of id, project-relative root, and optional `tests`, `documents`, and `files` policies.
- documents: defaultAudience: internal, publicRoots/internalRoots, publicPatterns/internalPatterns. Internal rules take precedence; child workspaces cannot weaken root publication policy. Only explicitly public paths may be published. Use optional `artifactAllowlist` for exact paths of maintained documentation files flagged by `documents.artifacts`. Optional `layout` rules control document locations. Paths in `artifactAllowlist` and `layout` are project-relative at the root and workspace-relative under a workspace.
- hooks: `sessionRetentionDays` for inactive managed Hook snapshots, default 30 (1–3650). This setting does not enable Hooks.
- artifacts: `retentionDays` for completed managed runs, default 14 (1–3650). See [artifact management](./artifacts.md).
- files: optional `layout` rules for project-owned file paths.
- tests: include/exclude globs, artifacts paths, requireConfiguredTask. Preserve native framework discovery. Globs support `*`, `**`, and `?`.
- tasks: id, workspace, argv array, cwd relative to the workspace, dependsOn, kind (test/lint/typecheck/build/custom), required, enabled, timeoutMs, and covers (workspace coverage). Tasks deduplicate by ID and cycles are rejected. Use covers for the actual scope of an existing aggregate task; avoid separately running the same underlying tests twice.
- publicationTargets: id and manifest; needed only for publication checks.
- rules: tests.layout, tests.configured, tests.artifacts, documents.links, documents.artifacts, documents.layout, files.layout, tasks.graph, storage.state, artifacts.layout; values error/warning/off. `storage.state`, `documents.artifacts`, `documents.layout`, and `files.layout` default to error; `artifacts.layout` defaults to warning. From v0.8.1, the CLI also supports `documents.artifactReferences` (default `warning`) for concrete temporary run paths in documentation. Changing the rule severity leaves cleanup’s reference protection active.
- baseline: fingerprints of ordinary historical findings; publication violations cannot be exempted.

Omitted fields use defaults; unknown fields and versions are rejected. Root README.md is public by default. Without existing governance configuration, newly generated generic host entries may be suggested as public; existing entries and explicit policies are not automatically broadened. Detailed public content belongs under docs/public/guides, reference, and examples. Default internal paths include docs/prd, docs/decision, docs/verification, .harness, docs/structure.md, and docs/agent_guide.md. The CLI also protects the [shared Agent guide](project-layout.md#shared-agent-guide) at `.agent/guide.md`. Explicit arrays replace defaults for that field: review and merge new conventions when adapting old configuration, and check custom Agent instructions for internal information. Do not invent schema fields.

## Document location rules

`documents.layout` requires v0.8.1 or later. Each rule has a unique `id` within its scope, one or more `match` and `allow` patterns, and optional `exclude` patterns. A file selected by `match` and omitted from `exclude` must match at least one `allow` pattern. If several rules select a file, it must satisfy each rule. The glob syntax is `*`, `**`, and `?`, as in the test layout rules.

For example, keep public pages in named sections and decision records in `docs/decision/`:

```json
{
  "documents": {
    "layout": [
      {
        "id": "public-pages",
        "match": ["docs/public/**/*.md", "docs/public/**/*.mdx"],
        "exclude": ["docs/public/.vitepress/**"],
        "allow": [
          "docs/public/index.md", "docs/public/README.md",
          "docs/public/guides/**", "docs/public/reference/**",
          "docs/public/examples/**", "docs/public/releases/**"
        ]
      },
      {
        "id": "decision-records",
        "match": ["docs/**/ADR-*.md", "docs/**/ADR-*.mdx"],
        "exclude": ["docs/public/.vitepress/**"],
        "allow": ["docs/decision/**"]
      }
    ]
  }
}
```

`harness check` and `harness run` report `documents.layout` findings with the file path, rule ID, and allowed patterns. Violations are errors by default. Set `rules["documents.layout"]` to `warning` when introducing the rules in an existing project, or `off` to disable them. Configurations without `documents.layout` retain their existing checks. Root rules use project-relative paths and apply across the project. Rules under `workspaces[].documents.layout` use workspace-relative paths and apply in addition to matching root rules. Publication eligibility is still determined by the public and internal path policies.

## File location rules

`files.layout` requires v0.8.1 or later.

Use `files.layout` to check deployment files, environment templates, or other project-owned inputs. It uses the same `id`, `match`, `allow`, and `exclude` patterns as [document location rules](#document-location-rules). Root rules use project-relative paths. Rules in `workspaces[].files.layout` use workspace-relative paths and apply alongside root rules.

Merge the following fields into an existing configuration after confirming the project layout. This example checks root Compose files and Compose files under `deploy/`, and keeps environment examples with their consumers. Change the patterns to match the files and entry points the project owns.

```json
{
  "files": {
    "layout": [
      {
        "id": "compose-placement",
        "match": [
          "compose*.yaml",
          "compose*.yml",
          "docker-compose*.yaml",
          "docker-compose*.yml",
          "deploy/**/compose*.yaml",
          "deploy/**/compose*.yml",
          "deploy/**/docker-compose*.yaml",
          "deploy/**/docker-compose*.yml"
        ],
        "allow": [
          "deploy/local/**",
          "deploy/production/**"
        ]
      },
      {
        "id": "environment-examples",
        "match": [
          "**/.env.example"
        ],
        "allow": [
          "apps/*/.env.example",
          "deploy/local/.env.example"
        ]
      }
    ]
  },
  "rules": {
    "files.layout": "warning"
  }
}
```

`harness check` and `harness run` report misplaced files as `files.layout` findings. Omit `rules["files.layout"]` to use the default severity of `error`, use `warning` during migration, or use `off` to disable the check. A path rule checks location only. Test the actual tool invocation after a move and manage secret values using the deployment environment.

## Commands

Use `node <skill>/scripts/harness.mjs`, adding `--root <project> --json` to each command:

- `inspect`: read-only discovery returning facts, questions, and suggestedConfig.
- `init --answers .harness/answers.json --yes`: apply onboarding and run first validation by default; `--skip-verify` explicitly defers it.
- `plan --answers .harness/answers.json --out .harness/plan.json`: save exact proposed content and precondition digests.
- `apply --plan .harness/plan.json`: apply an unchanged plan; conflicts preserve original files.
- `check`: read-only governance; also checks the Git index for public repositories. Compatibility alias: lint.
- `run` or `run --task <id>`: execute configured tasks and save evidence. Unselected scope is not-selected. Compatibility alias: verify.
- `doctor`: read-only diagnosis of configuration, entries, and current evidence. It neither runs tasks nor confirms live host loading.
- `baseline`: propose entries without modifying configuration automatically.

Manage work tasks with `task start/status/resume/note/accept/finish`; see [tasks](tasks.md). `run --work <work-task-id>` associates validation, while `run --task <runner-task-id>` still selects a validation task. Keep those IDs distinct. Task scope describes collaboration, not validation or permissions.

Everyday help shows the primary entry points; `help --all` includes advanced and compatibility interfaces. Low-level apply does not run first validation, so follow it with run. Evidence is saved in `.harness/verification.json`. Source/configuration changes invalidate prior results; never write passing evidence manually.

## Optional local Hooks

Run `harness init --hosts codex,claude,dsh --hooks --yes` in an existing configured project. Use one host or a comma-separated list. Without `--hosts`, setup uses the project's selected hosts, with Codex as the default for new projects. Provide any missing onboarding answers for a new project. Hook setup supports Codex, Claude Code, and DeepSeek Harness.

| Host | Registration file | Activate in the host |
|---|---|---|
| Codex | `.codex/hooks.json` | In a new trusted local session, review and approve the handlers with `/hooks`. |
| Claude Code | `.claude/settings.local.json` | Reopen the trusted project and check the handlers with `/hooks`. |
| DeepSeek Harness | `.harness/hooks/dsh/hooks.json` | Mount the official Claude Code Hook bridge in the selected profile, use the absolute `configPath` printed by setup, and restart the profile. |

For DSH, make the bridge available to the selected profile and merge this entry into that profile’s `cordis.patch.yml`. If the profile already mounts the bridge for this project, update that entry’s `configPath`. Use the generated path for your project. The bridge reads it at startup and executes commands through the profile's shell executor. The generated command expects PowerShell on Windows and a POSIX shell on macOS and Linux.

```yaml
- insert:
    - id: harness-kit-project-hooks
      name: "@deepseek-ai/dsh-hooks-claude-code"
      config:
        configPath: D:/project/.harness/hooks/dsh/hooks.json
```

[DSH Hook bridge reference](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/experimental/hooks-claude-code/README.md)

Setup preserves third-party handlers and settings, and reports conflicts when a managed handler or runner has been edited. It respects a local Codex `features.hooks = false` or Claude Code `disableAllHooks: true`. Keep registration files with absolute machine paths local. Re-run setup after moving the project, changing the runtime or machine, or upgrading, then reload or review the Hooks as required by the host. `doctor` checks the files on disk. DSH reports `profile-required` because project setup leaves the profile to its owner.

`SessionStart` records the first input digest for a session and provides project verification context. `Stop` requests a continuation when the digest has changed and complete passing evidence is missing or stale. It runs no project commands. Codex and Claude use the host's `stop_hook_active` signal to avoid another continuation in the same stop cycle. The DSH bridge always sends false, so its runner persists a per-session request until it observes fresh passing evidence. The DSH runner only acts inside its configured project. Use the same Node or Bun runtime for setup and verification because evidence includes the runtime version. Missing tasks or a missing start snapshot produce a status message without forcing a continuation. DSH logs those messages. Hooks support the verification workflow and leave permissions to the host.

Exit 0 means the requested gates are satisfied; 1 indicates rule/task failure; 2 indicates configuration, tool, or execution-condition errors. not-configured is not a test pass. Successful ordinary lint does not replace publication checks.
