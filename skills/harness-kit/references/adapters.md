# Technology adapters

Harness Kit keeps project execution technology-neutral. The built-in registry identifies project roots for common manifests, while configured tasks remain the authority for commands, dependencies, services and acceptance.

## Built-in project markers

Discovery recognises common roots for Python (`pyproject.toml`, `setup.py`, `tox.ini`), Rust (`Cargo.toml`), JVM (`pom.xml`, Gradle settings/build files), .NET (`.sln`, `.csproj`, `.fsproj`, `.vbproj`), PHP (`composer.json`, PHPUnit files), Ruby (`Gemfile`, `.gemspec`), C/C++ (`CMakeLists.txt`, `CMakePresets.json`), Dart (`pubspec.yaml`), Elixir (`mix.exs`) and Swift (`Package.swift`). It records a workspace and asks for a test command when no explicit task is known. It does not execute, import or evaluate project configuration.

Go and JavaScript package scripts retain their existing task discovery because their module and package-manager semantics are more specific. All adapter results merge through one registry and can coexist in a shared directory.

## Project-owned adapters

For a stack or repository layout that needs explicit discovery, add `harness.adapters.json` at the project root:

```json
{
  "schemaVersion": 1,
  "recipes": [
    {
      "id": "elixir",
      "markers": ["**/mix.exs"],
      "exclude": ["vendor/**"],
      "nested": "outermost",
      "tests": { "detect": ["**/*_test.exs"], "include": ["test/**/*_test.exs"] },
      "tasks": [
        { "id": "test", "argv": ["mix", "test"], "timeoutMs": 120000 }
      ]
    }
  ]
}
```

`markers` locate workspace roots; `exclude` removes paths before matching; `nested` can be `all` or `outermost`. A recipe task is copied for each matching workspace, and its `id` and `dependsOn` values are namespaced to that workspace. `argv`, `cwd`, timeout and task kind use the same configuration contract as `harness.config.json`.

`tests.detect` controls static test-file classification only. `tests.include`, `exclude` and `artifacts` control lint findings; they never rewrite the native test runner's own discovery. If a recipe has no task, Harness Kit asks for one. Use a real command in the task, or explicitly answer that tests are unconfigured.

Project recipes are read as data, validated before planning, and included in plan freshness. Changing `harness.adapters.json` after a plan or verification makes the result stale and requires re-planning or re-running. Existing explicit `harness.config.json` remains authoritative; adapter output appears as drift suggestions.

Programmatic integrations can pass an adapter registry to the discovery API. Each synchronous adapter implements `discover(root, files)` and returns arrays named `facts`, `questions`, `workspaces` and `tasks`; the same path, ID and task validation applies. The `adapters` option replaces the registry, so include the built-ins when extending it:

```js
import {inspect} from './src/discovery.mjs';
import {builtinAdapters} from './src/adapters/registry.mjs';
import {recipeAdapter} from './src/adapters/recipes.mjs';

const custom = recipeAdapter({
  id: 'custom',
  markers: ['**/project.custom'],
  tasks: [{id: 'test', argv: ['custom-tool', 'test']}]
});
const result = inspect(projectRoot, {adapters: [...builtinAdapters, custom]});
```

The paths above refer to a source checkout. Use `harness.adapters.json` for installed Skills or plugins; they expose the same declarative recipes through the bundled CLI without importing source modules. A recipe using a built-in ID replaces that adapter for this project. Replacing Go or JavaScript discovery also replaces its command inference, so include every command the project requires.
