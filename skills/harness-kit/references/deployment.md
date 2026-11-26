# Deployment and operations

Apply when changing container build inputs, deployment manifests, release jobs, environment wiring, or operational procedures.

- Keep delivery files with the deployable application or under `deploy/` by deployment target. Keep infrastructure definitions under `infra/` and reusable backup, restore, or inspection scripts under `ops/` when the project owns those concerns. Adopt an existing layout first.
- Preserve discovery paths required by tools, such as `.github/workflows/`. For inputs with explicit paths, update all callers and keep one documented invocation through the project scripts.
- For Compose moves, verify the file selection, environment-file path, relative mounts, project directory, build context, and Docker ignore files. Keep sensitive environment values in the appropriate runtime. Read [environment configuration](environment.md) when changing how values enter a process.
- Verify deployment changes through the project’s own rendering, validation, dry run, or non-production smoke checks as applicable. Confirm target environment and rollback or recovery when the change affects runtime state. Deploy or run state-changing operational commands only within the user’s authorization.

For an agreed layout, use `files.layout` in the root or owning workspace. Match specific file classes and explicitly preserve tool-required locations. Use `harness check` to validate paths and `harness run` for configured native checks.
