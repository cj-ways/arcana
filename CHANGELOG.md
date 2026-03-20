# Changelog

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
