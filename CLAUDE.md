# Arcana — Project Intelligence

## What This Is

Arcana (`@cj-ways/arcana`) is a curated developer workflow skills CLI for Claude Code and Codex CLI. It ships hand-authored skills, agents, and quality rules backed by SkillsBench data. Published on npm under `@cj-ways/arcana`. GitHub: `cj-ways/arcana`. MIT licensed.

<!-- generated:CLAUDE_CURRENT_VERSION:start -->
**Current version:** 1.11.0 (18 skills + 5 agents + 3 quality rules)
<!-- generated:CLAUDE_CURRENT_VERSION:end -->

## Your Role

You are the project owner, solution architect, lead developer, and release manager for Arcana. You make all decisions — architecture, skill design, CLI features, release strategy, quality standards. You ship to npm, push to GitHub, and handle everything end-to-end.

## Architecture

### CLI (`bin/arcana.js`)

<!-- generated:CLAUDE_CLI:start -->
- Entry point: Commander.js, 15 public commands + 1 internal hook entrypoint
- Commands: `init`, `add`, `remove`, `list`, `sync`, `update`, `use`, `import`, `doctor`, `info`, `feedback`, `feedback-report`, `feedback-triage`, `feedback-hooks`, `feedback-promote`
- All commands in `src/commands/*.js`, utilities in `src/utils/*.js`
- Dependencies: commander, inquirer, chalk, fs-extra (minimal, intentional)
<!-- generated:CLAUDE_CLI:end -->

### Content (the actual product)

<!-- generated:CLAUDE_CONTENT:start -->
- `skills/*/SKILL.md` — 18 skills (the core value)
- `agents/*.md` — 5 agents (`code-reviewer`, `feature-auditor`, `feature-designer`, `feature-orchestrator`, `review-team`)
- `rules/*.md` — 3 quality rules (`arcana-methodology`, `arcana-quality`, `arcana-research`)
- `migrations.json` — skill rename/removal migrations across versions
- `SKILL-AUTHORING-REFERENCE.md` — evidence-based authoring guide (22 sources, SkillsBench data)
<!-- generated:CLAUDE_CONTENT:end -->

### Skills Inventory

**Development Workflow:**
<!-- generated:CLAUDE_WORKFLOW_SKILLS:start -->
| Phase | Skill | What it does |
| --- | --- | --- |
| Plan | `/idea-audit` | Analyzes a project idea critically, then scaffolds a full project with phased plan, CLAUDE.md, OpenSpec, and AI-optimized stack. |
| Analyze | `/feature-audit` | Broad feature audit with runtime depth control - quick to exhaustive analysis across product, UX, ops, reliability, competitors, and roadmap decisions. |
| Design | `/feature-design` | Design one feature or workflow before implementation - clarify the problem, compare approaches, ask one focused question at a time when needed, and turn the result into an approved design spec. |
| Design | `/v0-design` | Generates optimized v0.dev prompts for UI design — full pages, single components, design systems, or redesigns. Analyzes the project, adapts questions to context, researches user-specified design references, and outputs ready-to-copy prompts following Vercel's three-part framework. |
| Implement | `/orchestrate` | Orchestrate large feature implementation across phases and manual worker sessions: persist canonical state, write worker packet files, resolve blockers, and enforce review gates before phase closure. |
| Test | `/generate-tests` | Generate unit tests for a file or function. Detects test framework and follows existing patterns. |
| Fix | `/deep-fix` | Structured debugging for non-obvious bugs — reproduces, isolates root cause, verifies hypothesis before fixing, and adds regression tests. Prevents the shotgun-fix pattern where agents edit randomly until tests pass. |
| Refactor | `/refactor-plan` | Plans and executes safe multi-file refactoring — maps dependency graph, batches changes into atomic commits, runs tests between batches. Prevents the cascading-breakage pattern where agents make sweeping changes that fail halfway. |
| Review | `/quick-review` | Fast single-pass code review with strong false-positive suppression. Reviews git diff for runtime errors, data corruption, security breaches, operational incidents. |
| Review | `/deep-review` | Multi-perspective deep code review using 3 specialized parallel reviewers (security, correctness, architecture). Consolidates into unified report with confidence gating. |
| Release | `/create-pr` | Creates a pull request or merge request with auto-generated title, description, and affected-area summary. Auto-detects GitHub vs GitLab. |
| Release | `/release-check` | Analyzes branch diff to generate deploy checklists — env vars, migrations, new services, dependencies, schema changes, breaking changes. Works across any tech stack. |
<!-- generated:CLAUDE_WORKFLOW_SKILLS:end -->

**Utility:**
<!-- generated:CLAUDE_UTILITY_SKILLS:start -->
| Skill | What it does |
| --- | --- |
| `/security-check` | Quick security scan — hardcoded secrets, common vulnerabilities, dependency issues. |
| `/persist-knowledge` | Persists codebase patterns, conventions, or architectural knowledge to CLAUDE.md, MEMORY.md, or .claude/rules/. |
| `/agent-audit` | Audits Claude Code agent configuration against latest best practices. |
| `/import-skill` | Adapts an imported or external agent skill to match Arcana quality standards — rewrites frontmatter, tone, structure, and adds missing sections. |
| `/skill-scout` | Scouts major skill providers for skills that match the current project — fetches catalogs, analyzes the codebase, cross-matches, and recommends with evidence. Critical assessment, not a dump of everything available. |
| `/pressure-test` | Stress-tests an idea, plan, proposal, claim, or request - finds missing assumptions, weak evidence, and asymmetric tradeoffs without manufacturing low-value objections. |
<!-- generated:CLAUDE_UTILITY_SKILLS:end -->

### Agents

- `code-reviewer` — Thin wrapper that loads `quick-review` skill. Triggers on conversational review requests (model: sonnet, tools: read-only)
- `feature-auditor` — Thin wrapper that loads `feature-audit` skill. Keeps one feature audit thread active across follow-up turns.
- `feature-designer` — Thin wrapper that loads `feature-design` skill. Keeps one feature design thread active across follow-up turns.
- `feature-orchestrator` — Thin wrapper that loads `orchestrate` skill. Keeps one feature implementation orchestration thread active across follow-up turns (effort: max).
- `review-team` — Thin wrapper that loads `deep-review` skill. Triggers on deep review requests (model: sonnet, effort: high)

### Supported Agents

- **Claude Code** — `.claude/skills/`, `.claude/agents/`, `.claude/rules/`
- **Codex CLI** — `.agents/skills/`, AGENTS.md discovery block
- **Multi-agent** — canonical in `.agents/skills/`, mirrors to `.claude/skills/`

Cursor and Gemini support was removed in v1.6.0 to focus on quality over coverage.

## Publishing & Infrastructure

### npm Publishing

- Token stored in `.npmrc` (gitignored) — `npm publish --access public --provenance` works without OTP
- Token also in `.claude/settings.local.json` env as `NPM_TOKEN`
- Use `node scripts/release.js <version>` to bump version across all 3 files
- Always update `CHANGELOG.md` with the new version entry
- CI runs on push: GitHub Actions, Node 20/22, smoke tests

### Release Checklist

1. Make changes
2. `node scripts/release.js <version>` (bumps package.json, plugin.json, marketplace.json)
3. Update `CHANGELOG.md`
4. `git add` specific files (never `git add -A`)
5. Commit with descriptive message
6. `git push origin main`
7. Wait for CI to pass: `gh run list --limit 1`
8. `npm publish --access public --provenance`
9. Verify: `npm view @cj-ways/arcana version`

### File Structure

```
bin/arcana.js              — CLI entry point
src/commands/*.js          — Command implementations
src/utils/*.js             — Shared discovery, copy, parsing, feedback, catalog, and scaffold utilities
skills/*/SKILL.md          — Skill definitions
agents/*.md                — Agent definitions
rules/*.md                 — Quality rules
migrations.json            — Skill rename/removal migrations
scripts/*.js               — Release, generated-doc sync, and contributor scaffolding
docs/features/arcana-cli/  — Feature documentation from audit
.claude-plugin/            — Plugin marketplace metadata
SKILL-AUTHORING-REFERENCE.md — Authoring guide
```

## Quality Standards

### Skill Authoring (from SKILL-AUTHORING-REFERENCE.md)

- **Description field**: Third person, includes what + when + boundaries, max 1024 chars
- **New first-party skills**: Start with `npm run new:skill -- <name> --phase <phase> --feedback-profile <profile>` using `plan|analyze|design|implement|test|fix|refactor|review|release|utility`; this now creates both `skills/<name>/SKILL.md` and `evals/scenarios/<name>-primary/`, and every `TODO:` placeholder in both must be replaced before commit
- **Body**: Third-person imperative, 1000-1200 words optimal, under 500 lines
- **Section ordering**: Quick Start → Gotchas → Procedures → Decision Points → Output → Validation
- **Gotchas go near the top** — instruction priority: early rules > late rules (confirmed by SkillsBench)
- **Per-step constraint design**: Procedural steps encourage divergence, criteria steps force convergence
- **Emphasis**: CAPS on max 2-3 rules. Explain WHY for everything else
- **`allowed-tools`**: All skills must declare allowed-tools in frontmatter, comma-separated format
- **Testing**: 20 eval queries (10 should-trigger, 10 should-not), run 3+ times each
- **Trigger pack storage**: Keep those Layer 1 routing queries in `evals/triggers/<skill>.json` with 6 train + 4 validation prompts per side
- **Trigger runner**: Execute Layer 1 routing checks with `node evals/run-trigger-eval.js --skill <name> --run --runs 3`
- **Layer 2 evals**: Replace the scaffolded `*-primary` scenario with a minimal real fixture and run `node evals/run-eval.js --scenario <name>-primary --run --runs 3`
- **Eval dimensions**: First-party evals use explicit `route`, `process`, and `outcome` assertions with weighted scoring; do not add flat undimensioned scenarios
- **Eval evidence**: Prefer artifact-backed report files plus `file-unchanged` traps for audit/review/release skills; stay output-only only when the skill intentionally forbids writes before approval
- **Read-only workflows**: Use `workspace-clean` when the skill must not create or modify files at all
- **Structured reports**: For read-only audit skills that answer in chat, prefer contextual finding assertions that bind severity and issue type to a concrete `file:line`
- **Release gating**: Use `npm run eval:gate` when validating shipped first-party skill changes; the gate preserves the previous scorecard baseline if the new run regresses
- **Coverage rule**: Every shipped first-party skill must keep at least one non-placeholder runnable eval scenario under `evals/scenarios/`

### Key Findings (SkillsBench, 7,308 trajectories)

- Curated skills: +16.2pp improvement
- Optimal skill count: 2-3 skills (+18.6pp peak)
- Comprehensive docs: -2.9pp (HURTS performance)
- Detailed docs: +18.8pp (best)
- Self-generated skills: -1.3pp (no benefit)

## Known Issues

### CLI Code Quality

- Legacy pre-version-tracking installs can only be classified precisely after one metadata-refresh update
- Auto-feedback hooks are local-machine integrations; shared team installs are intentionally not the default because the hook command path is machine-specific

### Not Issues (intentional)

- Platform: Unix paths only (macOS/Linux target, not Windows)
- No dependency management between skills (intentional — skills are independent)
- No rollback (acceptable at current scale)

## Design Decisions

### v1.9.0 Changes (2026-03-21)

- **Dropped `find-unused`** — native toolchain (ESLint, TypeScript, Go compiler) handles dead code detection better
- **Renamed `deploy-prep` → `release-check`** — clearer name, pairs with `security-check` naming pattern
- **Added `deep-fix`** — structured debugging (reproduce → isolate → hypothesize → verify → fix → regression test)
- **Added `refactor-plan`** — dependency-aware multi-file refactoring with atomic batches and test gates
- **Cross-skill handoffs** — skills now suggest related skills when contextually relevant (quick-review → deep-review, deep-fix → generate-tests, etc.)
- **Init completion message** — suggests `/quick-review` as first-try skill after install
- **Portfolio focus** — confirmed as "developer workflow" niche specifically
- **Deep-review code fixes** — EISDIR crash fix, remove imported skills support, fetch diagnostics, listGitHubSkills size limit

### v1.6.0 Changes (2026-03-20)

- **Dropped Cursor/Gemini** — focus on Claude Code + Codex CLI
- **Renamed `new-project-idea` → `idea-audit`** — consistent `*-audit` naming family
- **Migration system** — `migrations.json` handles skill lifecycle changes
- **Release script** — `scripts/release.js` prevents version drift
- **README rewritten** — why-first, workflow split, quantified claims
- **Feature documentation** — `docs/features/arcana-cli/` from comprehensive audit

### v1.5.0 Changes (2026-03-20)

- **Gotchas relocated to near-top in 10 skills**
- **v0-design: Design System mode added** — 5th mode
- **v0-design: Role principle added** — "Prompt Architect"

## How to Work on This Project

### Before making changes

1. Read the relevant SKILL.md files — understand what exists
2. Read SKILL-AUTHORING-REFERENCE.md before modifying any skill
3. Check CHANGELOG.md for recent changes and patterns
4. WebSearch for latest practices before recommending changes

### When modifying skills

- Gotchas section goes near the top (after Arguments)
- Use "## Gotchas" naming (standardized)
- Keep skills under 500 lines
- All skills must have `allowed-tools` in frontmatter (comma-separated format)
- Don't add features the user didn't ask for
- Test description changes against trigger/non-trigger scenarios

### Commit style

```
feat: description          — new features
fix: description           — bug fixes
chore: description         — maintenance (gitignore, versions, CI)
```

Always include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
