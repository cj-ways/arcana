# Changelog

## v1.7.1 (2026-03-21)

### Fixed
- **CRITICAL: marketplace.json nested plugin version** — `plugins[0].version` was stuck at 1.5.0. Release script now uses `replaceAll` to catch all version fields including nested ones.
- **Feature docs updated** — roadmap and todo were stale after 3 releases in one session. Now reflect v1.7.x state.

## v1.7.0 (2026-03-21)

### Added
- **`skill-scout` skill** — scouts major skill providers (Anthropic, OpenAI, Google, Vercel) for skills that match the current project. Fetches catalogs, analyzes codebase, cross-matches gaps, recommends with evidence. Critical assessment — SKIP is the most common rating.
- 14th skill in the collection.

### Changed
- Skill count updated across README, CLAUDE.md, package.json, plugin manifests (13 → 14).

## v1.6.1 (2026-03-21)

### Added
- **`arcana import` CLI command** — fetch skills from GitHub repos (`owner/repo skill-name`), GitHub tree URLs, raw .md URLs, or local paths. Lists available skills, validates frontmatter, detects quality gaps, adds source attribution.
- **Rewritten `import-skill` SKILL.md** — now focuses on quality adaptation pipeline (Step 1-5: locate → audit → assess → adapt → verify). Works on any already-installed skill, not just freshly imported ones.
- **Import tests** — 9 tests covering GitHub fetch, local import, conflict detection, force overwrite, quality gap detection.

### Changed
- **`import-skill` description** — updated to reflect two-step flow: `arcana import` fetches, `/import-skill` adapts.
- **README** — import section now shows CLI examples instead of just skill usage.
- **CLI** — 10 commands (was 9), added `import` with `--force`, `--agent`, `--scope` options.

## v1.6.0 (2026-03-20)

### Breaking Changes
- **Dropped Cursor and Gemini support** — Arcana now targets Claude Code and Codex CLI only

### Added
- **Migration system (`migrations.json`)** — handles skill renames and removals across versions
- **Release script (`scripts/release.js`)** — bumps version across 3 files in one command
- **`allowed-tools` on all 13 skills** — standardized comma-separated format
- **Feature documentation** — `docs/features/arcana-cli/`
- **npm provenance** — added `--provenance` to publish workflow

### Changed
- **Renamed `new-project-idea` to `idea-audit`** — consistent `*-audit` naming family
- **README rewritten** — why-first positioning, workflow + toolkit skill split
- **`update` now triggers `sync`** — multi-agent mirrors stay in sync automatically
- **`update` now covers `~/.agents/skills/`** — previously missing user-level path

### Fixed
- **`copy.js` frontmatter parsing** — regex instead of `split("---")`
- **Rules conflict detection** — no longer silently overwrites
- **README accuracy** — correct agent count, no Cursor/Gemini references

## v1.5.0 (2026-03-20)

### Added
- **v0-design: Design System mode** — new 5th mode for generating design system prompts (color palettes, typography scales, spacing, component styling). Full end-to-end support across all 7 steps.
- **v0-design: Role principle** — "Prompt Architect" behavioral boundary (structural decisions yours, aesthetic decisions v0's) prevents agents from overstepping into design research
- **v0-design: v0 ecosystem integration** — references v0 Design System registries, saved Instructions, and Design Mode for iteration
- **v0-design: Design system prompt template** — 800-1200 word comprehensive template covering colors, typography, spacing, shadows, component styling, and interaction patterns

### Enhanced
- **Gotchas relocated to near-top in 10 skills** — moved from bottom of file to after Arguments section per Arcana's own SKILL-AUTHORING-REFERENCE.md (instruction priority: early rules > late rules). Affected: deep-review, deploy-prep, feature-audit, find-unused, generate-tests, new-project-idea, persist-knowledge, quick-review, security-check, v0-design
- **Gotchas naming standardized** — "Common Agent Gotchas" renamed to "Gotchas" across all skills for consistent terminology
- **v0-design: Gotchas expanded** — merged Gotchas + Anti-Patterns into unified 10-item section with mode-scoped guidance (e.g., "Over-constraining colors in page prompts" vs "defining tokens in Design System mode")

### Fixed
- **v0-design description field** — "researches design references" → "researches user-specified design references" (prevented agents from proactively researching design systems)
- **v0-design theme question** — rephrased from "Fresh theme or match existing project colors?" to "Should v0 design within your existing color palette, or choose its own?" (keeps v0 positioned as aesthetic decision-maker)
- Plugin version sync — plugin.json and marketplace.json now match package.json (were stuck at 1.4.0)

## v1.4.1 (2026-03-20)

### Fixed
- **CRITICAL**: Legacy Arcana skills (pre-1.4.0) were falsely detected as "custom" conflicts — improved `isArcanaManaged()` with frontmatter name matching fallback
- Rules warning no longer fires when existing rules are Arcana's own rules from a prior install

### Added
- Interactive conflict resolution during `init`: Override all / Rename my skills / Skip
- `arcana add --force` flag to bypass conflict detection
- `renameExistingSkill()` and `renameExistingAgent()` utilities for the rename flow
- CI test script (`npm test` runs CLI smoke tests)

## v1.4.0 (2026-03-20)

### Added
- `deep-review` skill — multi-perspective code review with 3 parallel specialized reviewers
- `quick-review` skill — fast single-pass review (code-reviewer agent converted to skill format)
- `v0-design` skill — generate optimized v0.dev prompts for UI design
- `review-team` agent — agent team that spawns security, correctness, and architecture reviewers
- Effort levels (`effort:` frontmatter) on all 13 skills for optimal reasoning depth
- Worktree isolation (`isolation: worktree`) on review skills for safe analysis
- Project memory (`memory: project`) on review skills for cross-session learning
- Gotchas sections added to 10 skills (40+ documented agent failure patterns)

### Enhanced
- `feature-audit` — 13 universal perspectives + dynamic feature-specific discovery via WebSearch
- `new-project-idea` — WebSearch for competitive landscape + phase plan validation
- `security-check` — CVE research via WebSearch + context-aware false positive guidance
- `deploy-prep` — risk prioritization matrix (CRITICAL/HIGH/MEDIUM/LOW) + user confirmation
- `find-unused` — confidence-based output tiers (SAFE TO DELETE / LIKELY UNUSED / VERIFY FIRST)
- `generate-tests` — complexity assessment + test quality checklist
- `persist-knowledge` — auto-invocation quality check + gotchas

### Fixed
- Plugin marketplace.json updated with required `owner` field
- README updated: 7 → 13 skills, accurate descriptions

## [1.3.0] - 2026-03-19

### Added
- `import-skill` skill — import external skills from GitHub/URL/local and adapt to Arcana quality standards
- `SKILL-AUTHORING-REFERENCE.md` — evidence-based guide for writing agent skills (22 cited sources)
- `allowed-tools` frontmatter to all skills that were missing it
- `argument-hint` frontmatter to agent-audit, find-unused, create-pr, deploy-prep
- `tools` restriction to code-reviewer agent (read-only enforcement)
- Expanded secret detection patterns: Slack, Google Cloud, Twilio, SendGrid, updated GitHub/GitLab tokens
- Expanded vulnerability detection: ORM raw query injection, SSRF, path traversal
- Limitations section to security-check (transparency about grep-based heuristics)

### Fixed
- CRITICAL: Added `disable-model-invocation: true` to feature-audit and new-project-idea (prevent auto-triggering heavy workflows)
- CRITICAL: Removed XML `<example>` tags from create-pr description (spec violation)
- Rewrote all descriptions in third person per Anthropic best practices
- Added trigger phrases to find-unused and persist-knowledge descriptions
- Removed hardcoded "Desktop/Additional Projects" path from new-project-idea
- Trimmed new-project-idea description (removed redundant trigger phrases since manual-only)

## [1.2.0] - 2026-03-18

### Added
- `security-check` skill — hardcoded secrets, common vulnerabilities, dependency audit
- `generate-tests` skill — auto-detect framework, match existing patterns, generate tests
- Gemini CLI support (`.gemini/skills/`) — init, add, sync, list, remove, doctor
- `arcana sync --clean` flag — remove stale skills from mirrors not in canonical
- Smart mirror targets — sync only creates dirs for agents you actually use

### Changed
- Multi-agent mode now includes Gemini (Claude + Codex + Cursor + Gemini)
- Agent choices expanded: claude, codex, gemini, multi

## [1.1.0] - 2026-03-18

### Added
- `arcana doctor` command — validate installation health and sync status
- `arcana info <skill>` command — show skill metadata without full content
- Global error handler — friendly messages instead of stack traces
- `--dry-run` support detection in init
- Existing installation detection in init (warns before overwriting)
- User-level skill search in remove command
- CHANGELOG.md

### Fixed
- `arcana add` with no arguments no longer silently installs everything
- `--agent invalid` now shows clear error instead of silently defaulting to claude
- AGENTS.md skill discovery block now lists actual skill names
- Skill/agent lists now discovered dynamically from filesystem (no hardcoded arrays)
- `remove` now searches user-level directories too
- `use` error message now shows dynamic skill list
- `sync` uses path.relative() for cross-platform paths
- Exit codes: commands now exit non-zero on failure

### Removed
- Empty templates/ directory
- Dead `getHomeDir()` export
- Unused `detectExistingAgents` import in add.js

## [1.0.1] - 2026-03-18
- Fix bin path for npm (remove ./ prefix)

## [1.0.0] - 2026-03-18
- Initial release: 7 skills + 1 agent + CLI
