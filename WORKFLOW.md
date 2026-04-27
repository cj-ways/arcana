# Arcana — Development Workflow

How to use Arcana's skills through a real development lifecycle.

## The Flow

```
Plan → Analyze → Design → Implement → Test → Fix → Refactor → Review → Release
```

Each phase has a skill. You don't need all of them every time — pick what fits.

## Phase 1: Plan

**Skill:** `/idea-audit`

You have a project idea. Before writing code, pressure-test it.

```
/idea-audit "A CLI tool that manages AI agent skills across multiple coding assistants"
```

What it does:
- Analyzes your idea critically (not cheerleading)
- Researches competitors and market
- Identifies technical risks
- Scaffolds the project with CLAUDE.md, OpenSpec, and phased plan
- Picks an AI-optimized tech stack

**When to skip:** You already know what you're building and have a plan.

## Phase 2: Analyze

**Skill:** `/feature-audit <feature>`

You're building a feature. Audit it before, during, or after implementation.

```
/feature-audit auth
/feature-audit billing
/feature-audit search
```

What it does:
- Maps your implementation across the codebase
- Researches how competitors handle the same feature
- Walks through 13 universal perspectives (security, UX, reliability, etc.)
- Discovers feature-specific angles via web research
- Can stay interactive when you want to unpack findings or priorities in dialogue
- Produces documentation and a roadmap

**When to skip:** Quick bug fixes or trivial changes.

## Phase 3: Design The Behavior

**Skill:** `/feature-design <feature-or-workflow>`

You know the product area. Now decide how the feature should actually work before writing code.

```
/feature-design "team invite approvals"
/feature-design "subscription pause flow"
```

What it does:
- Clarifies the design problem and constraints
- Compares 2-3 viable approaches when the design is still open
- Asks one focused question at a time when needed
- Produces a concrete design direction and draft spec

**When to skip:** The work is still “what is weak or missing overall?” Use `/feature-audit` first. Or the direction is already stable and you only need UI prompts.

## Phase 4: Design The UI

**Skill:** `/v0-design`

You need UI. Generate optimized prompts for v0.dev.

```
/v0-design "dashboard for monitoring API usage"
/v0-design "redesign the settings page"
```

What it does:
- Analyzes your project's existing design patterns
- Asks targeted questions about the design
- Generates a ready-to-paste v0.dev prompt
- 5 modes: Greenfield, Redesign, Component, Multi-page, Design System

**When to skip:** Backend-only work, or you're designing manually.

## Phase 5: Implement

**Skill:** `/orchestrate <feature-or-initiative>`

The feature is too large for one clean session. Break it into phases, worker packets, and review gates before implementation drifts.

```
/orchestrate "team invite approvals"
/orchestrate "subscription recovery rollout"
```

What it does:
- Reads the feature brief, audit, and repo context
- Persists a canonical orchestration state file so context survives compaction
- Splits the feature into phased worker packets with explicit ownership and output paths
- Writes handoff files for manual worker sessions and resume files for blocker resolution
- Forces a review loop with `/deep-review`, local standards, and project-specific drift checks when available

**When to skip:** Small changes that one focused implementation session can finish safely.

## Phase 6: Test

**Skill:** `/generate-tests`

You wrote code. Generate tests that match your existing patterns.

```
/generate-tests src/utils/copy.js
/generate-tests
```

What it does:
- Detects your test framework (Jest, Vitest, Mocha, pytest, etc.)
- Reads existing tests to match your style
- Assesses complexity to determine coverage depth
- Generates tests with edge cases

**When to skip:** You prefer writing tests manually, or TDD (write tests first).

## Phase 7: Fix

**Skill:** `/deep-fix`

Something is broken or a previous fix attempt failed. Slow down and debug with discipline.

```
/deep-fix "TypeError in auth middleware when refresh token expires"
```

What it does:
- Reproduces the failure before editing code
- Isolates the bad state and traces it to the source
- Forces a testable hypothesis before applying a fix
- Adds regression coverage after the fix lands

**When to skip:** Trivial typo fixes where the cause is already obvious.

## Phase 8: Refactor

**Skill:** `/refactor-plan`

You need to change structure across multiple files without leaving the repo half-broken.

```
/refactor-plan "extract provider-specific billing logic into separate modules"
```

What it does:
- Maps the change surface before editing
- Breaks work into dependency-aware batches
- Uses tests between batches to keep the repo stable
- Avoids sweeping edits that fail halfway through

**When to skip:** Small, local refactors with no cross-file dependency risk.

## Phase 9: Review

**Skills:** `/quick-review` or `/deep-review`

Code is ready. Get it reviewed before merging.

**Quick review** — for most PRs:
```
/quick-review
```
Single-pass review focused on runtime errors, data corruption, security breaches. Strong false-positive suppression — only flags real issues.

**Deep review** — for critical changes:
```
/deep-review
```
Launches 3 parallel specialist reviewers (security, correctness, architecture). Consolidates into a unified report with confidence gating.

**When to use which:**
- Routine changes, small PRs → `/quick-review`
- Security-critical code, major refactors, pre-release → `/deep-review`

## Phase 10: Release

**Skills:** `/create-pr` then `/release-check`

**Create the PR:**
```
/create-pr
/create-pr staging
```
Auto-generates title, description, and affected-area summary. Detects GitHub vs GitLab.

**Prepare the deploy:**
```
/release-check
/release-check develop main
```
Analyzes the diff for env vars, migrations, new services, dependencies, schema changes, breaking changes. Produces pre-release and post-release checklists with risk prioritization.

## Utility Skills

These aren't tied to a phase — use them anytime:

**`/security-check`** — Run before any release, or when you suspect vulnerabilities.
```
/security-check
```

**`/persist-knowledge`** — When you discover a pattern worth saving. Also auto-triggers when you state conventions like "we always do X."

**`/agent-audit`** — Tune your Claude Code setup. Run after major config changes.
```
/agent-audit
/agent-audit skills
```

**`/import-skill`** — Bring in a skill from outside Arcana and adapt it to Arcana's quality standards.

**`/skill-scout`** — Research the broader skills ecosystem and recommend outside skills worth importing for the current project.

## Example: Full Lifecycle

```
# 1. Plan the idea
/idea-audit "real-time collaborative markdown editor"

# 2. Scaffold and start building...

# 3. Analyze the core feature
/feature-audit editor

# 4. Design how the feature should work
/feature-design "collaborative editing permissions and invite flow"

# 5. Design the UI
/v0-design "collaborative editor with live cursors and presence"

# 6. Write code, then generate tests
/generate-tests src/editor/

# 7. Fix a bug or unstable area if needed
/deep-fix "presence disconnects after reconnect"

# 8. Refactor if the feature needs structural cleanup
/refactor-plan "separate presence transport from editor domain logic"

# 9. Review before merge
/quick-review

# 10. Create the PR
/create-pr

# 11. Prepare for deploy
/release-check

# 12. Security scan before release
/security-check
```

Not every project needs every step. Use what fits.
