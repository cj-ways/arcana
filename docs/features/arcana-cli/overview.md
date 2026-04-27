# Arcana CLI — Overview

## What It Is

A CLI tool that installs, manages, and syncs curated agent skills across Claude Code and Codex CLI. Published on npm as `@cj-ways/arcana`.

## Architecture

<!-- generated:OVERVIEW_ARCHITECTURE:start -->
Entry point: `bin/arcana.js` (Commander.js). 15 public commands plus 1 internal hook entrypoint, 20 utility modules, 4 dependencies (commander, inquirer, chalk, fs-extra). 2 dev dependencies (`vitest`, `@vitest/coverage-v8`).
<!-- generated:OVERVIEW_ARCHITECTURE:end -->

### Skill Categories

**Development Workflow** (lifecycle order):

<!-- generated:OVERVIEW_WORKFLOW:start -->
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
<!-- generated:OVERVIEW_WORKFLOW:end -->

**Utility** (use anytime):

<!-- generated:OVERVIEW_UTILITY:start -->
| Skill | What it does |
| --- | --- |
| `/security-check` | Quick security scan — hardcoded secrets, common vulnerabilities, dependency issues. |
| `/persist-knowledge` | Persists codebase patterns, conventions, or architectural knowledge to CLAUDE.md, MEMORY.md, or .claude/rules/. |
| `/agent-audit` | Audits Claude Code agent configuration against latest best practices. |
| `/import-skill` | Adapts an imported or external agent skill to match Arcana quality standards — rewrites frontmatter, tone, structure, and adds missing sections. |
| `/skill-scout` | Scouts major skill providers for skills that match the current project — fetches catalogs, analyzes the codebase, cross-matches, and recommends with evidence. Critical assessment, not a dump of everything available. |
| `/pressure-test` | Stress-tests an idea, plan, proposal, claim, or request - finds missing assumptions, weak evidence, and asymmetric tradeoffs without manufacturing low-value objections. |
<!-- generated:OVERVIEW_UTILITY:end -->

### Supported Agents

| Agent        | Skills directory              | Detection                        |
| ------------ | ----------------------------- | -------------------------------- |
| Claude Code  | `.claude/skills/`             | `CLAUDE.md` or `.claude/` exists |
| Codex CLI    | `.agents/skills/`             | `AGENTS.md` or `.codex/` exists  |
| Multi (both) | `.agents/skills/` (canonical) | Both detected                    |

Multi-agent mode uses `.agents/skills/` as the canonical source and mirrors to `.claude/skills/`.

See [capabilities.md](capabilities.md) for the feature-depth differences between Claude Code and Codex CLI.

### Utility Modules

<!-- generated:OVERVIEW_UTILITIES:start -->
| Module | Purpose |
| --- | --- |
| `agents-md.js` | AGENTS.md discovery block generation |
| `catalog.js` | Catalog-backed inventory, summaries, and generated-doc inputs |
| `cli-errors.js` | Shared actionable error messaging and next-step hints |
| `command-manifest.js` | Single command inventory for CLI wiring and generated docs |
| `copy.js` | File copying, ownership checks, conflict detection, and markers |
| `detect.js` | Agent auto-detection (Claude, Codex) |
| `feedback-hooks.js` | Claude Code auto-feedback hooks, cooldowns, and session state |
| `feedback-eval-drafts.js` | Feedback-derived local eval draft generation and promotion scaffolds |
| `feedback-eval-promotion.js` | Review-first promotion of feedback-derived drafts into committed eval scenarios |
| `feedback.js` | Skill feedback capture, transcript analysis, and reports |
| `frontmatter.js` | Shared frontmatter parser for built-in and imported skills |
| `import-metadata.js` | Imported-skill provenance metadata, trust-state inspection, and overwrite review helpers |
| `import-adaptation.js` | Static import-adaptation heuristics, raw-vs-adapted comparison, and installed imported-skill inspection |
| `migrations.js` | Skill rename and removal migrations |
| `paths.js` | Path resolution and scoped install location discovery |
| `skill-scaffold.js` | Shared first-party skill scaffolding and catalog-order planning |
| `release-quality.js` | Release-facing quality summary over scorecards, trigger runs, and feedback-derived local cases |
| `trigger-evals.js` | Layer 1 trigger-pack discovery and validation helpers |
| `trigger-boundaries.js` | Layer 1 same-topic boundary-suite discovery and validation helpers |
| `verbosity.js` | Shared verbose/debug logging for CLI troubleshooting surfaces |
<!-- generated:OVERVIEW_UTILITIES:end -->

### Feedback System

Arcana includes a local-first feedback loop for explicit skill improvement:

- `feedback <skill>` captures a 3-state rating: helpful, partly helpful, not helpful
- Negative and partial feedback collect structured reason tags based on the skill family
- Optional transcript analysis extracts follow-up context the user had to add later and turns it into recommendations
- `feedback-report [skill]` aggregates ratings, reasons, and recurring improvement suggestions
- `feedback-triage [skill]` clusters repeated negative feedback into candidate eval follow-ups
- `feedback-triage <skill> --write-drafts` materializes repeated complaints into local draft eval packs for maintainer review
- `feedback-promote <skill> <signal>` validates a reviewed draft, copies it into `evals/scenarios/`, and archives the original draft out of the open queue
- `feedback-hooks install` enables an opt-in Claude Code hook flow that asks for feedback automatically after explicit Arcana slash-skill sessions when the user corrects the skill

### Imported Skill Verification

Imported skills now preserve the raw imported baseline in `.arcana-import.raw.md`.

- `info <skill>` compares the current adapted skill against that raw baseline with static frontmatter, structure, tone, and safety heuristics
- `doctor` surfaces the same adaptation summary alongside provenance and trust state
- `npm run eval:imports` evaluates shipped raw/adapted fixture pairs or a locally installed imported skill against its preserved raw baseline

### Release Summary

Phase 2 adds a single operator-facing artifact for release readiness:

- `npm run eval:release-summary` writes `evals/release-quality/latest.json` and `latest.md`
- the summary condenses scorecard coverage, latest trigger-run coverage, and local feedback-derived draft/candidate counts
- `node evals/build-release-summary.js --check` exits non-zero when release evidence is missing or stale
