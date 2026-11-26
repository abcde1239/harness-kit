# Public documentation

Apply this review to all maintained public documentation, including README files, user guides, reference pages, public examples, and release notes. Use the project's public path policy to include additional public entry points. Skip generated site output and assets without reader-facing prose when inventorying sources.

## Define the review scope

- **Add or edit a public page:** Before changing it, identify its intended reader, purpose, destination, and applicable project rules. Read the page or its closest related entry point. Review each complete changed page together with affected navigation, links, and prerequisites. Use the same review for a move or rename.
- **Audit public documentation:** Inventory and read every maintained public document in scope, including unlinked pages. Include public entry points outside the main docs directory. Record the paths reviewed, excluded sources and their reasons, and any unread files. Report findings by path, reader impact, and proposed correction. Keep the inventory and findings in the task response or internal records.

## Classify the content before writing

| Audience | Content | Typical location |
|---|---|---|
| External users, operators, and integrators | Product purpose, supported workflows, configuration, examples, behavior, interfaces, and architecture or design principles that help readers understand or use the product | README, public guides and references, examples, release notes |
| Internal developers and maintainers | Requirements, design alternatives and decision records, implementation history, task progress and handoffs, test and review evidence, development conversations, and repository-specific release operations | Existing specs, decision records, verification records, task records, or other internal locations |

Classify by the purpose of the paragraph and its intended reader. When an internal source contains facts relevant to external readers, verify them and write a standalone product explanation. Keep the source, discussion, alternatives, and evidence internal. If the audience or publication scope is unclear, keep the material internal until clarified.

| Internal record | Public explanation |
|---|---|
| An implementation note describing when the Skill entry point and CLI were split and what was tried first | The Skill supplies host guidance. The bundled CLI runs configured project tasks and records results. |
| A report listing test counts, fixture versions, and outstanding maintainer review | Supported versions, prerequisites, known limitations, and a way to confirm that the installed product works. |
| A release checklist asking maintainers to change visibility and inspect staged changes | The publication command's inputs, checks, outputs, and limits for a reader's project. |

## Write and review

1. Identify the intended reader and the task the page supports. A first-time user needs purpose, prerequisites, and a working start. An operator needs expected results and recovery steps. An integrator needs verified interfaces or relevant product structure.
2. Organize content in the reader's order of work. Use descriptive headings, one subject per section, and numbered steps for ordered actions. State prerequisites before commands and keep examples consistent with the supported version and host.
3. Use direct, neutral prose. Prefer explicit subjects such as the CLI, the command, or the project. In instructions, use short imperatives such as `Run harness doctor`. Avoid first-, second-, and third-person personal pronouns in explanatory prose when the actor is clear. Preserve quotations, executable examples, and copyable prompts that need an explicit speaker.
4. Check headings, prose, examples, link targets, and source comments for internal material. Use fictional or sanitized examples when documenting task records, verification, or publishing features. Explain actual prerequisites and limitations that affect readers.
5. Before finishing, reread each complete page in scope as its intended reader. Check whether its entry point is findable and the steps have clear results and recovery guidance where needed. Every section must answer a reader question or support an action. Move developer-only material to an internal source. Verify links, commands, terminology, and claims against the applicable version. Check source changes against the published version before presenting a new feature as available to installed users.
6. Run the project's document location and link or site build checks when available. Report their results separately from readability findings. Keep unresolved checks and assumptions in the task response or an internal record.
