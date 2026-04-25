# Arcana CLI — Feature Documentation

> Last updated: 2026-04-16

## Overview

Arcana is a curated agent skills CLI for Claude Code and Codex CLI. Skills are research-backed — authored against SkillsBench data (7,308 trajectories, +16.2pp improvement over no-skill baselines) with 22 cited sources in the authoring reference.

## Documents

| Document | Contents |
|----------|----------|
| [overview.md](overview.md) | Architecture, data model, skill lifecycle |
| [capabilities.md](capabilities.md) | Claude Code vs Codex CLI capability matrix |
| [boundaries.md](boundaries.md) | What Arcana does NOT do, and why |
| [roadmap.md](roadmap.md) | Strategic improvements and planned features |
| [todo.md](todo.md) | Small fixes, tweaks, polish |

## Changelog

- 2026-04-16: Added `feedback-promote` — a review-first promotion path that validates feedback-derived draft eval packs, copies them into `evals/scenarios/`, and archives promoted drafts out of the open queue.
- 2026-04-16: Completed Phase 2 — local feedback triage can now generate draft eval packs, imported skills preserve raw baselines for adaptation verification, and release-quality summaries now condense scorecards, trigger runs, and feedback-derived cases.
- 2026-04-16: Added frontmatter coverage for `---` inside description values, mocked import-network tests for rate limiting and timeout paths, and a dedicated package migrations-path helper.
- 2026-04-16: Added a host capability matrix, `feedback-triage` feedback-to-eval workflow, and next-step guidance on common CLI failures. Marked Phase 1 complete.
- 2026-04-15: Added `--verbose` and `--debug` troubleshooting output for `import` and `sync`, including fetch attempts, target selection, and stale-entry preservation details.
- 2026-04-09: Added `--dry-run` preview mode for `init`, `add`, and `sync`, with previews driven by the same install/mirror/rule logic as real writes.
- 2026-04-09: Added `--json` machine-readable output for `list`, `info`, and `doctor`, including imported-skill trust data and doctor findings.
- 2026-04-09: Import governance implemented — imported skills now persist provenance metadata, expose trust state in `info`/`doctor`/`update`, and support `arcana import --review` before overwrite.
- 2026-04-08: Strategic re-audit — reset roadmap around measured quality, trust, import governance, and day-2 UX. Aligned lifecycle docs with current phase taxonomy.
- 2026-03-21: Re-audit — doc drift fixes, agent/skill overlap resolved, competitive intel updated
- 2026-03-20: Initial feature audit and documentation
