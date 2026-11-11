# Install with an Agent

If you are helping a user install Harness Kit, follow this entry point. The user can supply a repository or Release link without cloning source, extracting archives manually, or running bun setup.

## Establish the host and location

Identify the target host from the current session and user request; ask if it is unclear. Use native plugins for Codex, Claude Code and DeepSeek Harness. Select skill when the user explicitly wants a standalone Skill. For other hosts, verify their actual Skill discovery settings; project rule adapters are not native plugins.

**Ask for the installation location before installing**, showing the expanded default absolute path. Ask in the user's preferred language:

> Install to the default location `<actual absolute path>`, or choose another directory?

Use a location already supplied in this request without asking again. Defaults: `%LOCALAPPDATA%/harness-kit/plugins/<host>` on Windows, `~/.local/share/harness-kit/plugins/<host>` elsewhere; standalone Skills default to `~/.agents/skills/harness-kit`. A custom location stores persistent plugin source files. Host caches remain host-managed; do not relocate the entire host configuration. Do not use a temporary directory as the final destination.

While awaiting the answer, you may inspect tools and release metadata, but do not assume the preselected default or execute installation. For DSH, confirm the actual profile and CLI source. Use the Desktop-bundled CLI for Desktop; the npm CLI does not manage Desktop.

## Download and run the installer

1. Check the actual Node.js (>=22.12.0) or Bun (>=1.3.4) executable and target host CLI. Do not install runtimes or change PATH, model accounts or permissions automatically.
2. Read release metadata from the supplied repository/Release. Prefer install-plugin.mjs from that Release. Inspect the script and run it as a local file; do not pipe network content into a shell. For an older Release lacking this asset, use scripts/install-plugin.mjs corresponding to this entry point and explain any source/version difference when the older Release lacks the described functionality.
3. Run with --dry-run to inspect paths, version, host commands and checksums, then repeat the same arguments without --dry-run. Once the user has selected a location, continue within that authorization without adding another approval step. Pass paths as separate arguments, never by composing arbitrary shell strings.

```text
node <absolute-path-to-downloaded-install-plugin.mjs> --source <user-repository-or-release-link> --host codex --location default --dry-run
node <absolute-path-to-downloaded-install-plugin.mjs> --source <same-link> --host codex --location default
```

Use the selected runtime; substitute bun for node if using Bun. Release v0.6.0 and later packages support either runtime. Older v0.5.0 archives still require Bun; report a missing package runtime before claiming readiness.

Use --host claude for Claude, --host dsh --profile <actual-profile> for DSH, or --host skill for a standalone Skill. Replace --location default with --location <absolute-path> for a custom directory. The script accepts GitHub repository, Release page and Release ZIP links. ZIP links pin the owning Release and select the matching host archive. Repository and documentation links resolve the latest stable Release. Downloaded source alone is not an installed Skill.

The installer checks SHA256SUMS from the same source, validates ZIP paths and complete resources, writes an isolated version directory, then registers the plugin with the actual host. Checksums establish download consistency, not an independent signature or source trust. Preserve unknown or modified files and report conflicts. Do not delete previous directories to bypass conflicts or silently switch installation types.

## Verify completion

Check every reported host command and actual native plugin status. A partial result means files were saved but configuration is incomplete. Diagnose the failed step, fix within existing authorization, and retry. For an already registered source, inspect the host list and path. Do not overwrite a same-name marketplace pointing elsewhere; explain the conflict and concrete change required.

Report installed version, storage location, host result and any required restart/new session. Registration success does not prove the current model session loaded the Skill; keep loading unconfirmed without actual session evidence. Complete authorized host trust interactions; identify any step that truly requires the user's direct interaction.

Installing a plugin alone does not authorize initializing the current project. If onboarding was also requested, use the installed Skill while preserving necessary visibility and testing choices. Users need not run bun setup or maintain a global Harness Kit command.

## User prompt

Give this page or a repository link to an Agent:

```text
Install the Harness Kit plugin from this link: <repository-or-release-link>.
First ask whether I want the default installation location or a custom directory, then install and configure it for the current host.
```
