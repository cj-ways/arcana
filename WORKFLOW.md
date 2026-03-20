# Arcana — Development Workflow

How to use Arcana's skills through a real development lifecycle.

## The Flow

```
Ideate → Validate → Design → Test → Review → Ship
```

Each phase has a skill. You don't need all of them every time — pick what fits.

## Phase 1: Ideate

**Skill:** `/idea-audit`

You have a project idea. Before writing code, validate it.

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

## Phase 2: Validate

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
- Interactive — debates with you, one question at a time
- Produces documentation and a roadmap

**When to skip:** Quick bug fixes or trivial changes.

## Phase 3: Design

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

## Phase 4: Test

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

## Phase 5: Review

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

## Phase 6: Ship

**Skills:** `/create-pr` then `/deploy-prep`

**Create the PR:**
```
/create-pr
/create-pr staging
```
Auto-generates title, description, and affected-area summary. Detects GitHub vs GitLab.

**Prepare the deploy:**
```
/deploy-prep
/deploy-prep develop main
```
Analyzes the diff for env vars, migrations, new services, dependencies, schema changes, breaking changes. Produces pre-release and post-release checklists with risk prioritization.

## Toolkit Skills

These aren't tied to a phase — use them anytime:

**`/security-check`** — Run before any release, or when you suspect vulnerabilities.
```
/security-check
```

**`/find-unused`** — After refactors, or periodic cleanup.
```
/find-unused
/find-unused deps
```

**`/persist-knowledge`** — When you discover a pattern worth saving. Also auto-triggers when you state conventions like "we always do X."

**`/agent-audit`** — Tune your Claude Code setup. Run after major config changes.
```
/agent-audit
/agent-audit skills
```

**`/import-skill`** — Bring in a skill from outside Arcana and adapt it to Arcana's quality standards.

## Example: Full Lifecycle

```
# 1. Validate the idea
/idea-audit "real-time collaborative markdown editor"

# 2. Scaffold and start building...

# 3. Audit the core feature
/feature-audit editor

# 4. Design the UI
/v0-design "collaborative editor with live cursors and presence"

# 5. Write code, then generate tests
/generate-tests src/editor/

# 6. Review before merge
/quick-review

# 7. Create the PR
/create-pr

# 8. Prepare for deploy
/deploy-prep

# 9. Security scan before release
/security-check
```

Not every project needs every step. Use what fits.
