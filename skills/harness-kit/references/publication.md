# Publication checks on request

Use this workflow only when the user explicitly requests publication preparation, checks, or export. State the configured public scope. Never classify the entire repository as public merely to pass a check.

Use `node <skill>/scripts/harness.mjs <command> --root <project> --json`:

- `export --destination artifacts/public-snapshot --manifest-out .harness/publication.json`: write to a new directory without copying `.git` or private history, and without pushing. If the destination exists, choose another clearly named directory; do not delete an earlier result to make room.
- `publication-check --manifest .harness/publication.json`: check the actual file set, output and source SHA-256 digests, known copies of internal files, and links. Repeat after changing the output.
- `review-template --out .harness/review.json`: generate an evidence template bound to refs and policy. The reviewer, reference, remote refs, and platform declarations must reflect actual review; never invent evidence to pass a gate.
- `audit-history --evidence .harness/review.json`: inspect history reachable from all local refs, including deleted memory, side branches, and tags. Shallow history, missing objects, and uncovered LFS or submodule resources block clearance.

Making a private repository public requires more than checking HEAD files. Completeness of remote refs and review of Issues, PRs, Wiki, Releases, Actions, and similar platform data currently rely on explicit human review declarations. The tool does not authenticate platform state automatically. Renames of identical blobs can be detected; arbitrary content rewrites cannot be traced reliably.

A build manifest uses version 1, `target`, `artifactRoot`, and `entries`. Each entry contains `path`, `sha256`, and `sources`, with a path and SHA-256 for every source. Transformed outputs also need `review.reviewer` and `review.reference`. Block publication when provenance is unknown, actual files are absent from the manifest, or archive contents cannot be audited deeply enough. Do not fabricate provenance.

Passing checks does not authorize changing visibility, uploading, force-pushing, or rewriting history. Report audit coverage and gaps, and preserve the user's existing permission boundaries.
