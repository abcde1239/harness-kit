# Architecture

Apply to changes that affect module ownership, contracts between components, data flow, or failure and migration behavior across a system.

1. Trace current callers, owners, inputs, and failure paths. Reuse project decisions, interfaces, and deployment boundaries when they meet the requirement.
2. State the smallest change that meets the requirement. Define contracts, ownership, compatibility, and acceptance. Review state transitions, retries, migration, authorization, and recovery where they affect the change.
3. Record material decisions where the project keeps them. Put durable behavior and interfaces in their canonical source. Keep temporary implementation progress in the current task record.
4. Verify through normal entry points and the affected component boundaries. Use the [architecture role prompt](roles/architect.md) if a specialist review or assignment is needed.
