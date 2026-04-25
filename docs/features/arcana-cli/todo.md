# Arcana CLI — Todo

> Last updated: 2026-04-16

## Completed

- [x] Fix marketplace.json nested plugin version not updated by release script
- [x] Add `--provenance` to npm publish in release checklist
- [x] Extract shared frontmatter parser (was duplicated in info.js and import.js)
- [x] Fix `arcana add` exits 0 on unknown skills (now exits 1)
- [x] Fix `arcana remove` exits 0 with no args (now exits 1)
- [x] Fix update auto-sync not cleaning stale mirrors (now passes --clean)
- [x] Replace curl with native fetch() in import command
- [x] Add `arcana import` to README commands section
- [x] Align `WORKFLOW.md` with the current lifecycle model
- [x] Replace the old "No Telemetry" boundary with explicit "No Silent Telemetry" language
- [x] Extend `evals/run-eval.js` to compare `with skill` vs `no skill` runs and aggregate repeated runs
- [x] Add per-skill eval scorecards and release-comparison artifacts under `evals/scorecards/`
- [x] Strengthen report-style eval scenarios with artifact-backed files and source immutability traps
- [x] Add explicit read-only workspace assertions for review and planning evals
- [x] Add structured contextual finding assertions for read-only audit reports
- [x] Add scorecard regression gates that block overwriting stored baselines on regressions
- [x] Define eval manifest v2 in `evals/README.md` with route, process, and outcome scoring dimensions
- [x] Extend `scripts/new-skill.js` to scaffold eval stubs for first-party skills
- [x] Require every first-party skill to ship with at least one runnable eval scenario
- [x] Add imported-skill registry metadata: source, ref, checksum, imported-at, Arcana version
- [x] Add import/update review mode with risk summary before overwriting imported skills
- [x] Audit docs for remaining hardcoded counts and stale statements
- [x] Add `--json` output for `list`, `info`, and `doctor`
- [x] Add `--dry-run` for `init`, `add`, and `sync`
- [x] Add `--verbose`/`--debug` flag for troubleshooting (fetch URLs, HTTP status, detailed errors)
- [x] Add a capability matrix that states clearly which features are Claude-only vs cross-agent
- [x] Add a feedback-to-eval triage loop so repeated user feedback becomes new eval cases
- [x] Generate local feedback-derived eval draft packs from `feedback-triage`
- [x] Preserve raw imported skill baselines and verify adaptation quality against them
- [x] Generate a release-quality summary over scorecards, trigger runs, and feedback-derived local cases
- [x] Audit all error messages so each one suggests a fix action
- [x] Add test case for frontmatter with `---` in description values
- [x] Add test for GitHub API rate limiting / timeout in import.js
- [x] Mock network calls in import tests to avoid CI flakiness
- [x] Add `getPackageMigrationsPath()` helper to remove indirect migration path resolution

## Open

- No queued todo items. Use the roadmap for the next phase definition.
