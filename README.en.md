# Harness Kit

[简体中文](README.md) · [Documentation (Chinese)](https://abcde1239.github.io/harness-kit/) · [Releases](https://github.com/abcde1239/harness-kit/releases)

Harness Kit connects coding agents to existing projects, runs the project's own tests and checks, and can save goals, progress, and acceptance records so a later session can pick up the work.

It can generate project instructions for Codex, Claude Code, Gemini CLI, Cursor, OpenCode, and DeepSeek Harness. Plugins are available for Codex and Claude Code, with experimental native plugin support for DeepSeek Harness. See the [installation guide](docs/public/guides/installation.md) and [host capabilities](docs/public/reference/capabilities.md) in Chinese for host-specific details.

Requires **Node.js ≥ 22.12.0 or Bun ≥ 1.3.4**. Git features also require Git. Skills and plugins bundle the CLI. Running `bun setup` is unnecessary, and the terminal shortcut is optional.

## Let your agent install a released version

Send this request to your agent. A repository link selects the latest stable release. Use a Release link to pin a version.

```text
Read https://github.com/abcde1239/harness-kit/blob/main/INSTALL.md.
Install Harness Kit from https://github.com/abcde1239/harness-kit for the current host.
First ask whether I want the default installation location or a custom directory.
```

## Quick start

After installing, start a new session in the target project and ask:

```text
Use harness-kit to onboard this project, preserve its existing conventions, and run its existing tests.
```

- The [usage guide (Chinese)](docs/public/guides/usage.md) covers onboarding, verification, diagnosis, and handoffs.
- [Specialist roles](docs/public/reference/roles.md) covers role prompts and native role configuration by host.
- [Project layout and artifacts](docs/public/reference/project-layout.md) explains where to put project instructions, `.harness/` state, and generated files.
- [Coding style distillation (Chinese)](docs/public/guides/coding-style.md) explains how to derive coding and architecture conventions from projects you maintain.
