# Arcana CLI — Roadmap

> Last updated: 2026-03-21

## Planned

### Skills

**Develop `import-skill` quality pipeline** — Approved
The `arcana import` CLI command works. The `/import-skill` quality adaptation pipeline needs real-world testing and iteration on edge cases (skills with `---` in content, non-standard frontmatter, oversized skills).

### Testing

**Layer 2 eval execution** — Approved
Framework and 3 scenarios exist in `evals/`. Needs actual `--run` execution against Claude to validate detection rates and establish baselines.

### CLI Polish

**Error messages audit** — Proposed
Ensure all errors suggest a fix action.

**`--dry-run` for init, add, sync** — Proposed
Let users preview changes before applying.

**`--json` output for list, info, doctor** — Proposed
Enable CI integration and scripting.

---

## Completed

**`skill-scout` skill** — 2026-03-21
14th skill. Scouts major providers for skills matching the current project.

**`arcana import` CLI command** — 2026-03-21
Fetch skills from GitHub, URLs, or local paths. 10th CLI command.

**`import-skill` rewrite** — 2026-03-21
Refocused on quality adaptation pipeline (audit → assess → adapt → verify).

**Doctor integrity check** — 2026-03-20
Hash installed skills against package source. Reports local modifications.

**Layer 2 eval framework** — 2026-03-20
3 scenarios (security-check, find-unused, generate-tests). Manual invocation.

**Layer 1 unit tests** — 2026-03-20
168 tests across 6 suites. Vitest. Runs in CI on Node 20/22.

**WORKFLOW.md** — 2026-03-20
Skill lifecycle guide: Ideate → Validate → Design → Test → Review → Ship.

**Drop Cursor/Gemini support** — 2026-03-20
Focus on Claude Code + Codex CLI.

**Migration system** — 2026-03-20
`migrations.json` handles skill renames/removals across versions.

**Rename `new-project-idea` → `idea-audit`** — 2026-03-20
First migration applied.

**`allowed-tools` on all skills** — 2026-03-20
Comma-separated format standardized.

**README rewrite** — 2026-03-20
Why-first positioning, workflow split, quantified claims.

**Release script** — 2026-03-20
`scripts/release.js` bumps version across all files including nested fields.

**Bug fixes** — 2026-03-20
Frontmatter parsing, rules conflict detection, update triggers sync.

**Release script nested version fix** — 2026-03-21
Fixed `marketplace.json` `plugins[0].version` not being updated by release script.

---

## Dropped

**Publish skills to external marketplaces** — Dropped 2026-03-20
Arcana is a self-contained toolkit. `import-skill` is the bridge.

**Enterprise features** — Dropped 2026-03-20
Wrong stage.

**Additional agent support (Copilot, Antigravity, Windsurf)** — Dropped 2026-03-20
Focus on Claude Code + Codex CLI first.

---

## Competitive Intelligence

- **skills.sh (Vercel)**: 89K+ skills, 2.4M+ installs. Quiet week (no new features since Feb).
- **Claude Code March 19**: Added `effort` frontmatter — Arcana already ships this on all 14 skills.
- **shadcn/skills**: New official skills for shadcn/ui v4. Relevant to `v0-design`.
- **SkillPort** (gotalab): New entrant using MCP server approach. Different angle from Arcana.
- **Nobody competes on quality.** Market still in quantity phase.

## Audit History

- 2026-03-20: Initial feature audit. 13 universal + 4 feature-specific perspectives. Full competitive landscape.
- 2026-03-21: Re-audit. Found marketplace.json version drift bug. Updated all docs. No new strategic gaps.
