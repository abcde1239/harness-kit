# Multi-agent collaboration and reusable prompts

Use delegation only when the user or applicable project instructions authorize it and the host provides real subagent tools. Work serially when tools are unavailable, the task is too small, or file ownership cannot be separated. An unresolved interface blocks implementation that depends on it; independent investigation, interaction sketches, and test design can still proceed in parallel. These prompts guide work; they do not provide a scheduler or additional permissions.

## Ownership and dependencies

The lead owns the goal, interfaces, task dependencies, file ownership, integration, and final acceptance. Independent modules, read-only investigation, suitable tests, and independent review may run in parallel. Resolve shared contracts before starting dependent implementation. Assign one writer per file at a time; the lead or a named owner manages shared types, configuration, and entry points.

Independent modules do not make conflicting installs, migrations, build outputs, or Git operations safe to run concurrently. Define write scopes in shared directories. Use existing worktrees according to project rules; creating or cleaning them must preserve user changes.

Every assignment includes the goal, inputs, read/write scope, interface dependencies, verification commands, and stop conditions. After delivery, the lead checks the actual diff and contracts and runs integration verification. Reviewers report findings rather than silently changing another owner's code.

For product, UX/UI, architecture, frontend, backend, QA, code review, documentation, or Agent behavior improvement, use the [role catalog](roles.md). Load only relevant profiles and combine them with the assignment boundaries. A role need not be a separate Agent, and no role mandates a technology stack. Keep reusable instructions and delegation prompts in English; preserve original user requirements and code as evidence, and communicate with the user in their requested language.

For durable handoff, the lead creates a work task and criterion IDs through `task start`. Include the work ID, assigned criteria, and evidence in each assignment. `run --work <work-id>` links full verification; after checking real evidence, accept each criterion and finish. Use each host's actual tools: a shared work ID is not a shared Agent ID or a cross-host delegation API.

## Lead agent prompt

```text
Act as integration lead for: <user goal>.
Read applicable project instructions, relevant memory, existing plans, and unfinished changes.
Work task: <existing ID, or create with task start when durable tracking is needed>.
Acceptance: <criterion IDs and observable outcomes>.

Multi-agent collaboration is authorized for this assignment. Split only independently assessable work.
Resolve shared interfaces before dependent implementation; independent research or test design may start earlier.
For each assignment provide the goal, input dependencies, exclusive writes, read-only scope, output contract, verification commands, and stop conditions.
Select the professional profiles needed and pass their prompts with confirmed project context.
Shared entry points, types, and configuration belong to <owner>. Allow one writer per file at a time.
Coordinate requests to change files outside an assignment; preserve all unrelated changes.
Sequence dependent work. If no delegation tools are available, work serially and do not claim subagents were created.

Check actual diffs, integrate deliveries, and consolidate relevant memory before final verification.
When a work task exists, run harness run --work <work-id>; do not present partial checks as complete acceptance.
Verify each criterion's evidence before task accept. Use task finish only with current full verification and all acceptance satisfied.
Diagnose failures and bound retries; report behavior changes, actual evidence, and remaining limitations.
```

## Implementation agent prompt

```text
Task: <one independently assessable result>.
Work task: <ID, or explicitly unused>. Assigned acceptance: <criterion IDs and expected behavior>.
Project: <verified absolute root>.
Inputs: <requirements, existing interfaces, relevant files, and necessary context>.
Dependencies: <confirmed interfaces, pending deliveries, and wait conditions>.
Exclusive writes: <files or directories>.
Read-only: <shared entry points, configuration, and other modules>.
Output contract: <exports, arguments, results, errors, and compatibility requirements>.
Verification: <observable behavior, commands, working directory, permitted artifacts>.
Stop conditions: <missing decisions, scope conflicts, unavailable dependencies, or retry budget>.

Implement only the assigned result. Preserve others' changes; do not expand scope or delegate further.
If a shared file must change, a contract is invalid, or a dependency is blocked, report the issue and smallest proposal so the lead can coordinate ownership.
Use the existing framework and report missing tools, unrun checks, and failures honestly.
Return work/criterion IDs, changed files and behavior, interface changes, actual commands and results, uncovered paths, and integration needs.
The lead owns manual acceptance, active-task changes, and finish; a subtask report does not complete the whole task.
```

## Read-only reviewer prompt

```text
Review whether <implementation scope> satisfies <original requirements and acceptance>.
Work task: <ID>. Focus criteria: <criterion IDs and original requirements>.
Readable inputs: <relevant code, task records, and verification evidence>.
Do not modify files or run commands that write to the project.
Independently inspect implementation and callers for behavior errors, compatibility, authorization/data boundaries, and missing validation.
Use code and actual execution evidence for conclusions; treat implementer reports as leads.
Report actionable findings with severity, exact file/location, trigger, impact, recommendation, and evidence.
If no findings are found, state reviewed scope and unverified behavior; no findings is not a claim that tests passed.
```

If tests require caches, reports, or fixtures, the lead must explicitly authorize their output directories and test scope. Do not combine absolute read-only requirements with commands that may write to the project.

## Handoff and recovery prompt

```text
Continue task: <goal>, preserving existing work and previously verified progress.
Work task: <ID>. Read task status/resume first; do not automatically execute recovery steps.
Read: <latest user requirements, task records, applicable instructions, relevant memory>.
Current changes: <files and behavior>.
Confirmed interfaces: <contracts>. Unresolved decisions: <questions>.
Verification evidence: <commands, scope, results, records>.
Acceptance: <criterion IDs, human evidence, current or stale state>.
Blockers and attempts: <cause, previous attempts, and stop reason>.
Next action: <smallest useful step>.
Exclusive writes: <scope>. Other files are read-only; coordinate with <lead>.

Check the actual diff and harness doctor before resuming. Reverify stale evidence and reassess acceptance.
Do not infer that an external side effect has not happened from old state, and never manufacture completion or passing evidence.
```

## Completion checks

- Deliveries match real files, remain in scope, and preserve user changes.
- Callers and shared contracts agree, and the lead has run necessary integration checks.
- Reports distinguish passed, failed, blocked, unrun, and uncovered behavior.
- Keep durable engineering lessons in project memory; do not copy every message, log, or subagent report.
