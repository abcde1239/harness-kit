# Harness Kit

[简体中文](README.md) · [English](README.en.md)

Harness Kit connects coding agents to existing projects, runs the project's tests, and saves the context needed to continue work later. Install a Skill or plugin, then describe your goal in the Agent session.

[Quick start](#quick-start) · [Installation guide (Chinese)](docs/public/guides/installation.md) · [Usage guide (Chinese)](docs/public/guides/usage.md) · [Downloads](https://github.com/abcde1239/harness-kit/releases)

## What it helps with

- **Onboard existing projects.** Add instructions for your chosen Agent while preserving frameworks, test layouts, and user edits.
- **Resume unfinished work.** Save goals, acceptance criteria, notes, and next steps for another session or Agent.
- **Verify changes.** Run existing tests and checks. Changes to source or configuration make earlier verification evidence stale.
- **Document your coding conventions.** Derive scoped style and architecture rules from selected projects, with code evidence and counterexamples. See the [coding-style workflow](skills/harness-kit/references/coding-style.md).

Implement and verify small changes directly. Save plans, assignments, and handoffs when the work warrants them. Keep using Superpowers, OpenSpec, or your team's existing process.

**Availability:** The v0.5.0 downloads below do not include coding-style distillation, specialist role profiles (including the Agent expert), or the link-install entry point. Build a distribution from current source to use coding-style distillation and specialist roles. See below for link installation of released packages.

## Quick start

Requires **Bun >= 1.3.4** in the Agent's execution environment. Git checks also require Git. Skills and plugins include the CLI; no `bun setup` or global `harness` command is needed.

### Install the Skill

Download [harness-kit-skill-0.5.0.zip](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-skill-0.5.0.zip). Put the complete `harness-kit` directory in your host's Skill directory. For a Codex user installation:

```text
~/.agents/skills/harness-kit/
├── SKILL.md
├── scripts/
├── references/
└── agents/
```

Start a new session and confirm the Skill is available, then ask:

```text
Use harness-kit to onboard this project, preserve its framework, and run its existing tests.
```

Continue with a development task:

```text
Use harness-kit to implement pagination and save the task and acceptance criteria for the next session.
```

### Install a plugin

| Host | Package |
|---|---|
| Codex / Claude Code | [Marketplace ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-marketplace-0.5.0.zip) |
| DeepSeek Harness | [Native DSH plugin ZIP](https://github.com/abcde1239/harness-kit/releases/download/v0.5.0/harness-kit-dsh-0.5.0.zip) |

Extract the package and run the commands for your host. Replace the paths with the extracted directories' absolute paths:

```sh
# Codex: use the extracted marketplace directory
codex plugin marketplace add "<absolute-marketplace-path>"
codex plugin add harness-kit@harness-kit-local

# Claude Code: use the same marketplace package
claude plugin marketplace add "<absolute-marketplace-path>"
claude plugin install harness-kit@harness-kit-local

# DeepSeek Harness: use the extracted harness-kit package root
dsh plugin --profile <actual-profile> add "<absolute-harness-kit-package-path>"
```

Keep the extracted directories. DSH support is experimental; use your actual profile and the Desktop-bundled CLI for Desktop. Restart the host or start a new session as required, then confirm that the Skill is available. The [installation guide (Chinese)](docs/public/guides/installation.md) covers compatibility and troubleshooting. GitHub's **Source code** archives are for source development; use the installation assets above.

## How it works

1. **Connect the project.** Discover workspaces, existing instructions, and test commands. Add host entry points while preserving existing content.
2. **Carry out the task.** Implement the requested change using the project's conventions. Save goals, acceptance criteria, and handoff information when needed across sessions or Agents.
3. **Verify the result.** Run checks and assess acceptance criteria. A tracked work task can finish only with current complete verification and individually confirmed acceptance.

Multi-agent collaboration includes [role prompts and assignment briefs](skills/harness-kit/references/roles.md) for product management, UX/UI, architecture, frontend, backend, QA, code review, documentation, and Agent behavior improvement. Delegation uses the host's actual tools and requires authorization. See [capabilities and limits (Chinese)](docs/public/reference/capabilities.md).

Maintained Agent instructions and prompt templates are in English. User-facing replies can follow your preferred language; original user text and code are preserved.

## Supported Agents

| Agent | Project instruction entry | Native plugin |
|---|---|---|
| Codex | AGENTS.md | Supported |
| Claude Code | CLAUDE.md | Supported |
| Gemini CLI | GEMINI.md | Not available |
| Cursor | .cursor/rules/harness-kit.mdc | Not available |
| OpenCode | AGENTS.md | Not available |
| DeepSeek Harness | AGENTS.md | Experimental |

Gemini CLI, Cursor, and OpenCode can use `init --hosts` to generate project instructions. See the [usage guide (Chinese)](docs/public/guides/usage.md). The DSH plugin targets a developer-preview interface; installation in a real DSH profile has not been verified. Check the compatibility range in the installation guide before trying it.

## Let your Agent install a released version

Give your Agent the repository link. It reads the [installation entry point](INSTALL.md), asks for a default or custom location, then downloads, validates, and configures a released plugin. You do not need to extract archives manually or run `bun setup`.

Copy this request. To pin a version, replace the repository link with the corresponding Release link:

```text
Read https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md.
Install the Harness Kit plugin from https://github.com/abcde1239/harness-kit.
First ask whether I want the default installation location or a custom directory, then install and configure it for the current host.
```

The Agent shows the full installation path, preserves existing edits, and checks the host's plugin status. A custom location stores persistent plugin source files; caches remain host-managed. A restart or new session may be required.

The installer comes from repository source; the plugin package comes from the latest stable Release, currently v0.5.0. Link installation does not add unreleased source features to older packages.

## Terminal usage

For optional terminal shortcuts, run `bun run setup` in the source directory. Then, from your project:

```sh
harness init      # Connect the project and run initial verification
harness run       # Check conventions and run configured tasks
harness check     # Check project conventions only
harness doctor    # Diagnose setup and verification evidence
```

Running `harness` without arguments opens a Chinese menu. Use `harness help --all` for advanced commands. The [usage guide (Chinese)](docs/public/guides/usage.md) covers configuration, monorepos, persistent tasks, and optional hooks.

## Documentation and development

- [Documentation index (Chinese)](docs/public/README.md)
- [Multi-agent collaboration](skills/harness-kit/references/collaboration.md)
- [Persistent tasks](skills/harness-kit/references/tasks.md)
- [v0.5.0 release notes (Chinese)](docs/public/releases/v0.5.0.md)

Validate and package from the source directory:

```sh
bun run verify
bun run harness check --json
bun run package:distribution <new-output-directory>
```
