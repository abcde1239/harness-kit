# Development, repair, review, and recovery

Reuse the project's testing tools and development process. Complete short tasks in the current session. For recovery or handoff, use [persistent tasks](tasks.md) to save goals, acceptance, and next steps, reusing existing specifications rather than writing duplicate task JSON.

## Before changing code

Confirm the user's goal, affected scope, and acceptance method. Read relevant code and existing plans. Continue an existing OpenSpec change, Spec Kit task, or team record instead of creating a second plan. Inspect unfinished changes and establish ownership of files and contracts.

Read existing style conventions. If `docs/decision/coding-style/RULES.md` exists, apply only adopted rules within this task's scope; candidate rules are reference material. Personal preferences do not override current explicit user requirements, applicable project instructions, or existing tool configuration. Escalate material conflicts to the lead. Use [style distillation](coding-style.md) only when requested to derive, update, or transfer rules; ordinary development does not scan other projects automatically. Include applicable rule IDs and scope in implementation and review briefs.

For an onboarded project, run `doctor` to understand configuration, host entries, and evidence. Use `init` only when configuration is missing or needs adjustment, not for every task. Diagnosis does not run tests; missing or stale evidence is not a test result.

Choose proportionate work:

- Small changes with clear acceptance: implement and run relevant checks; do not force a PRD, multiple Agents, or new tests.
- Behavior changes or bug fixes: validate observable outcomes and add meaningful coverage where existing tests are insufficient. Follow TDD when the project requires it; avoid assertions that merely mirror implementation.
- Cross-module work or material alternatives: record the goal, contracts, steps, and acceptance. Use [multi-Agent collaboration](collaboration.md) when authorized and independently separable.

When professional responsibilities are requested or useful, select [role prompts](roles.md), carrying existing requirements, interfaces, and file ownership. Do not add a full fixed workflow merely to use roles. For an observed Agent behavior problem or an explicit request to improve Agent output, use the [Agent expert](roles/agent-expert.md) to assess evidence and proportionate changes. This is an optional diagnostic role, not a mandatory stage for every task.

Use `bun <skill>/scripts/harness.mjs` with `--root <project> --json`. Start with meaningful local validation via `run --task <runnerID>`; after integration run the project's required full `run`. If a work task exists, associate results with `run --work <work-task-id>`. `--task` still selects a runner task. Report partial scope and never call unselected workspaces verified.

## Failed validation

Identify the cause before acting:

| Cause | Next action |
|---|---|
| Behavioral assertion failure | Reproduce the symptom, compare expectation and implementation, fix the cause, then rerun relevant tests |
| Configuration, path, or dependency error | Check cwd, argv, workspace, and dependencies; make the smallest correction and validate again |
| Missing tools, services, or credentials | Report the missing condition and continue independent work; do not make required tasks optional to manufacture success |
| Timeout, cancellation, or instability | Preserve the cause and examine resources/services; change timeouts or retry only with new evidence |
| User-file conflict | Compare the proposal with current content, merge within authorization, and preserve unrelated edits |

Limit evidence-based repair attempts for the same cause to two rounds unless the user specifies another budget. If still failing or needing new permissions/external conditions, stop automatic retries and report the diagnosis, attempts, and required conditions. Do not merely rerun, delete failing tests, weaken required checks, or edit evidence files.

## Recovery and handoff

For recovery, define acceptance before recording progress:

```sh
harness task start auth-fix --title "Fix authentication boundaries" --accept "The specified boundary behavior can be reproduced and passes" --scope src/auth
harness task note --note "Located the cause" --next "Fix and run authentication regression tests"
harness task resume auth-fix
```

On resume, reread current user requirements, task status/resume, relevant diff, and `doctor`. Check what changed since validation and replace stale evidence. Resume presents context and switches the active task; it does not run tests or other actions. A completion note cannot prove an external effect was executed only once if no durable completion record exists. Check actual state before retrying commits, deployment, or other external actions.

## Review and completion

Review requirements, failure branches, compatibility, validation scope, and existing changes. Do not substitute Agent claims for source or actual results. Independent multi-Agent review can use the reviewer prompt in the collaboration reference.

Inspect actual changes and acceptance, consolidate necessary memory, then run required validation. Persistent tasks require full `run --work <id>`, individually verified `task accept --criterion <id> --evidence ...`, then `task finish`. Acceptance declarations and execution evidence remain distinct; gates cannot automatically prove the semantics of human evidence.

`.harness/verification.json` is a local record tied to source/configuration scope, not a signature, automatic review, or public report. Never edit it to manufacture success. After relevant inputs change, rerun validation and reassess acceptance. An old doctor result is not current evidence.

Report behavior changes, executed scope, results, and limitations. Deduplicate or retire obsolete memory. Do not place raw stdout, temporary guesses, or private material in public documentation. If tracked memory or any other tracked input changes after validation, revalidate and reassess acceptance before finishing the task.
