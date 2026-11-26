# Environment configuration

Apply when adding or changing runtime variables, environment files, validation, or secret injection.

1. Find the application or deployment unit that consumes each value. Confirm its loader, working directory, precedence, and build-time or runtime use before moving files.
2. Keep variable definitions, parsing, validation, and safe defaults with the application. Validate required values at startup without printing credentials. Keep `.env.example` beside its consumer with names, descriptions, and placeholder values.
3. Keep real local values in ignored files. Supply production credentials through the runtime or an existing secret manager. Keep confidential environment settings, task notes, and outputs out of public configuration and artifacts.
4. When introducing or renaming a variable, update its example and consuming launch paths. Check required and missing values, override precedence, and the target environment using placeholders or authorized test credentials.

For Compose interpolation and deployment wiring, use [deployment and operations](deployment.md). For directory enforcement, add a project-owned `files.layout` rule for specific template names and accepted paths. Path rules do not inspect values or detect secrets.
