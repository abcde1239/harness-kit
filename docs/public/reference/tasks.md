# Recoverable tasks and acceptance evidence

Create work tasks for cross-session recovery, explicit acceptance, or handoff. Complete simple changes directly with appropriate validation. Reuse OpenSpec/Spec Kit or existing requirement records; Harness tasks track goals, evidence, and validation links rather than duplicating the full specification.

Invoke `node <skill>/scripts/harness.mjs` with `--root <absolute-project-path> --json`. Examples use human short commands; Agents must use the actual available entry point rather than hard-code a host tool name.

## Complete example

```sh
harness task start login-fix --title "Fix empty-password submission" --accept "An empty password shows a validation message" --accept "Valid login remains functional" --scope src/auth --scope tests/auth
harness task note --note "Reproduced and located the validation entry" --next "Fix and run authentication tests"
harness task status
harness task resume login-fix
# Complete the actual change and consolidate relevant memory before final validation.
harness run --work login-fix
harness task accept --criterion c1 --evidence "The empty-password regression passed and showed the specified message"
harness task accept --criterion c2 --evidence "Valid-login regression passed with the expected result"
harness task finish
```

Repeat `--accept` to create criterion IDs c1, c2, etc. `--scope` accepts repeated project-relative paths and defaults to `.`. It describes collaboration ownership; it does not enforce a sandbox, expand permissions, or narrow the validation snapshot or test scope.

## Command selection

| Command | Effect |
|---|---|
| `task start <id> --title ... --accept ...` | Create a goal and criteria, select it as active, and preserve any existing task with the same ID |
| `task status [id]` | Show computed status, acceptance, linked validation, and next steps |
| `task resume [id]` | Read and select a task; reopen implementation when needed without executing project commands |
| `task note [id] --note ... --next ...` | Record verified facts, blockers, or next steps |
| `task accept [id] --criterion c1 --evidence ...` | Save human-reviewed evidence, the input digest, and the task definition digest for that criterion |
| `run --work <id>` | Run configured validation and associate results with this work task |
| `task finish [id]` | Check acceptance and validation gates, then mark complete if satisfied |

An omitted optional ID uses the active task; absence of an active task fails explicitly. `run --task <runnerID>` selects a validation task and can combine with `--work`, but partial validation is insufficient to finish a work task.

## Evidence and completion gates

Acceptance evidence is the responsible person's verified explanation, test location, or other concrete basis. Avoid empty claims such as "done" or "passed" and never invent review to satisfy a gate. The tool cannot prove that evidence text semantically satisfies the requirement.

Finish requires current human evidence for every criterion, linked full passing validation for this work task, and matching source/configuration, task-definition, acceptance, and validation digests. Full validation must include every configured task and workspace. Missing entries, validation linked only to another work task, partial tests, no configured tasks, or stale passed results are insufficient.

Acceptance binds the goal, title, scope, and criterion requirements through definitionDigest. Changes to those definitions or tracked source/configuration invalidate old evidence. Review current requirements and implementation, rerun necessary validation, and accept again; do not alter digests manually. Completed tasks with relevant changes show needs-attention. Resume can reopen them while retaining history; a currently valid completed task remains complete after resume.

## Recovery, concurrency, and storage

Tasks live in `.harness/tasks/<id>.json`; `.harness/active-task.json` is the active pointer. Both are internal by default. Status/resume restore readable context only. They do not reimplement work, rerun tests, commit, deploy, or replay external effects. Check actual state before retrying effects.

Task mutations use a file lock. On conflict, wait for the writer to finish or report to the integration lead. Remove an abandoned lock only after confirming no other writer remains; never seize ownership or bypass finish by editing JSON.

The integration lead manages the active task, acceptance, and completion in multi-Agent work. Subtasks return evidence with work-task ID, criterion, and write ownership. A work-task ID is not a host Agent ID; persistence does not provide background scheduling. See [collaboration prompts](collaboration.md).
