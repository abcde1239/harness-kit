# Configuration and non-interactive invocation

Resolve all relative path arguments against `--root`. Do not write target-project answers into the Skill directory.

## Installed Skill entry point

Standalone and plugin Skill distributions include a complete `scripts/harness.mjs`. Locate the Skill root from the SKILL.md actually loaded by the host, then run `node <installed-skill-directory>/scripts/harness.mjs <command> --root <absolute-project-path> --json`. No setup, global harness command, or Harness Kit PATH change is required. Node.js >= 22.12.0 or Bun >= 1.3.4 must be executable; choose the available runtime and substitute bun for node when appropriate. Packages include parser libraries but no runtime. Release v0.6.0 and later packages support either runtime; older v0.5.0 archives still require Bun. Git features also require Git. Do not assume a fixed plugin cache path or depend on a source checkout. The script under the source skills/harness-kit directory is a development entry point; install a ZIP or packaged output rather than copying that source directory alone.

The examples below omit this shared prefix; supply the actual paths when invoking them. Users can request onboarding, development, or validation in their preferred language. The optional source `bun run setup` only provides short commands for human terminals. Plugin installation names and Skill invocation names may have host namespaces; use the actual discovered names.

For a single workspace, prefer `init --private --test "bun test ./tests" --yes`. Omit `--test` when an existing script is discoverable. Explicitly use `--no-tests` only when testing is intentionally not configured; missing information does not imply no tests. Use answers/plan for complex configuration or separate review.

Select hosts with `init --hosts claude,gemini,cursor,opencode,dsh`; codex is also supported. dsh means DeepSeek Harness, with deepseek-harness as an alias; use `init --hosts dsh --private --yes` for it alone. Explicit selection in a new project creates only those entries; the default is Codex. Existing projects retain prior selections and add new ones. Complex answers can include `hosts: ["claude", "dsh"]`. Selection belongs to plan.hosts and managed state, not harness.config.json; do not invent config.hosts.

DeepSeek Harness remains a developer preview. Project onboarding generates/merges AGENTS.md and reuses tasks and validation; it does not install dsh or configure its plugins, model, or permissions. Native plugin installation is a separate [installation workflow](installation.md). The default dsh-base agent-instructions plugin reads AGENTS.md and CLAUDE.md, followed by AGENTS.local.md/CLAUDE.local.md. Files in the same candidate group are deduplicated only when their trimmed contents match exactly; Codex AGENTS.override.md semantics do not apply. Custom profiles, filesystem providers, candidate names, root markers, and maxBytes affect loading. External edits reconcile after later structured file operations or resume; there is no continuous watcher. Confirm sources and budget notices in a real session rather than inferring loading from file existence.

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
- workspaces: array of id, project-relative root, and optional tests/documents.
- documents: defaultAudience: internal, publicRoots/internalRoots, publicPatterns/internalPatterns. Internal rules take precedence; child workspaces cannot weaken root policy. Only explicitly public paths may be published.
- tests: include/exclude globs, artifacts paths, requireConfiguredTask. Preserve native framework discovery. Globs support `*`, `**`, and `?`.
- tasks: id, workspace, argv array, cwd relative to the workspace, dependsOn, kind (test/lint/typecheck/build/custom), required, enabled, timeoutMs, and covers (workspace coverage). Tasks deduplicate by ID and cycles are rejected. Use covers for the actual scope of an existing aggregate task; avoid separately running the same underlying tests twice.
- publicationTargets: id and manifest; needed only for publication checks.
- rules: tests.layout, tests.configured, tests.artifacts, documents.links, tasks.graph; values error/warning/off.
- baseline: fingerprints of ordinary historical findings; publication violations cannot be exempted.

Omitted fields use defaults; unknown fields and versions are rejected. Root README.md is public by default. Without existing governance configuration, newly generated generic host entries may be suggested as public; existing entries and explicit policies are not automatically broadened. Detailed public content belongs under docs/public/guides, reference, and examples. Default internal paths include docs/prd, docs/decision, docs/verification, .harness, docs/structure.md, and docs/agent_guide.md. Explicit arrays replace defaults for that field: review and merge new conventions when adapting old configuration, and check custom Agent instructions for internal information. Do not invent schema fields.

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

## Optional local Codex hooks

`init --hooks` merges SessionStart/Stop handlers into `.codex/hooks.json` and generates a self-contained runner and ownership record in `.harness/hooks`. Users must review and trust them through `/hooks` in a new local session; setup does not change host permissions. Preserve third-party handlers. Modified or deleted managed handlers produce conflicts. Commands bind the chosen runtime and project absolute paths; rerun init --hooks after moving, changing machines, or upgrading.

SessionStart records a session input digest and supplies validation context. Stop requests continued validation only when the session changed files and no current full passing evidence exists. It does not run project commands itself; after one automatic continuation it only reminds. Missing start snapshots or tasks are reported as gaps. This adapter is not universal enforcement. Do not trust hooks on the user's behalf or disable other hooks.

Exit 0 means the requested gates are satisfied; 1 indicates rule/task failure; 2 indicates configuration, tool, or execution-condition errors. not-configured is not a test pass. Successful ordinary lint does not replace publication checks.
