# Arcana

[![npm version](https://img.shields.io/npm/v/@cj-ways/arcana)](https://www.npmjs.com/package/@cj-ways/arcana)
[![CI](https://github.com/cj-ways/arcana/actions/workflows/ci.yml/badge.svg)](https://github.com/cj-ways/arcana/actions)
[![license](https://img.shields.io/npm/l/@cj-ways/arcana)](https://github.com/cj-ways/arcana/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@cj-ways/arcana)](https://nodejs.org)

Curated developer workflow skills for **Claude Code** and **Codex CLI**.

Project owner or maintainer? Start with [OWNER-GUIDE.md](OWNER-GUIDE.md).

<!-- generated:README_STATS:start -->
18 skills, 5 agents, 3 quality rules — all hand-authored against [SkillsBench](https://arxiv.org/abs/2602.12670) data (7,308 trajectories, +16.2pp improvement over no-skill baselines). Not scraped, not AI-generated.
<!-- generated:README_STATS:end -->

## Why Arcana

- **Quality over quantity.** Battle-tested skills backed by 22 cited sources. SkillsBench shows curated skills improve agent performance by +16.2pp — self-generated skills show -1.3pp (no benefit).
- **Multi-agent sync.** One skill set, synced across Claude Code and Codex CLI. Edit once in `.agents/skills/`, mirror everywhere with `arcana sync`.
- **Extensible.** Need a skill Arcana doesn't ship? `arcana import` pulls from GitHub, URLs, or local files, then `/import-skill` adapts it to Arcana's quality standards.

## Quick Start

```bash
npx @cj-ways/arcana init
```

Or install globally:

```bash
npm install -g @cj-ways/arcana
arcana init
```

## Development Workflow

Skills map to your development lifecycle:

<!-- generated:README_WORKFLOW:start -->
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
<!-- generated:README_WORKFLOW:end -->

## Utility Skills

Use anytime, not tied to a specific phase:

<!-- generated:README_UTILITY:start -->
| Skill | What it does |
| --- | --- |
| `/security-check` | Quick security scan — hardcoded secrets, common vulnerabilities, dependency issues. |
| `/persist-knowledge` | Persists codebase patterns, conventions, or architectural knowledge to CLAUDE.md, MEMORY.md, or .claude/rules/. |
| `/agent-audit` | Audits Claude Code agent configuration against latest best practices. |
| `/import-skill` | Adapts an imported or external agent skill to match Arcana quality standards — rewrites frontmatter, tone, structure, and adds missing sections. |
| `/skill-scout` | Scouts major skill providers for skills that match the current project — fetches catalogs, analyzes the codebase, cross-matches, and recommends with evidence. Critical assessment, not a dump of everything available. |
| `/pressure-test` | Stress-tests an idea, plan, proposal, claim, or request - finds missing assumptions, weak evidence, and asymmetric tradeoffs without manufacturing low-value objections. |
<!-- generated:README_UTILITY:end -->

## Agents

<!-- generated:README_AGENTS:start -->
| Agent | What it does |
| --- | --- |
| `code-reviewer` | Single-pass code reviewer. Follow the quick-review skill instructions exactly. |
| `feature-auditor` | Persistent feature audit agent. Follow the feature-audit skill instructions exactly, keep the same feature and effort in context across follow-up turns, and only exit audit mode when the user clearly changes topic or asks to stop. |
| `feature-designer` | Persistent feature design agent. Follow the feature-design skill instructions exactly, keep the same feature and design decision in context across follow-up turns, and only exit design mode when the user clearly changes topic or asks to stop. |
| `feature-orchestrator` | Persistent feature orchestration agent. Follow the orchestrate skill instructions exactly, keep the same feature state and packet plan in context across follow-up turns, and treat the markdown state file as canonical when chat history is incomplete. |
| `review-team` | Multi-pass review orchestrator. Follow the deep-review skill instructions exactly. |
<!-- generated:README_AGENTS:end -->

## Extend with import

Arcana ships a curated first-party skill set. When you need something it doesn't have, import it:

```bash
arcana import openai/skills .curated/gh-address-comments   # nested GitHub catalog path
arcana import owner/repo skill-name            # any repo with skills/
arcana import ./my-local-skill                 # local path
arcana import https://example.com/SKILL.md     # raw URL
```

Imported skills land in your skills directory. Then run `/import-skill <name>` to adapt them to Arcana's quality standards — proper frontmatter, tone, structure, gotchas, and allowed-tools.

Arcana now tracks imported-skill provenance locally:

- each imported skill gets a `.arcana-import.json` record with source ref, checksum, import date, and Arcana version
- each imported skill also preserves the raw imported baseline in `.arcana-import.raw.md` for later adaptation comparison
- `arcana import --review` previews overwrite risk before any files are written
- `arcana info <skill>` shows provenance, trust state, checksum, install location, and an adaptation-quality comparison when a raw baseline is available
- `arcana doctor` and `arcana update` warn when an imported skill was edited locally or still uses legacy attribution-only metadata
- `npm run eval:imports` compares shipped raw/adapted fixture pairs or an installed imported skill against its preserved raw baseline

Example review flow:

```bash
arcana import ./my-local-skill --review
arcana import openai/skills .curated/gh-address-comments --review
arcana import openai/skills .curated/gh-address-comments --force
```

## Commands

<!-- generated:README_COMMANDS:start -->
```bash
arcana init                                                      # Interactive setup — choose agent, scope, and skills
arcana init --dry-run                                            # Preview setup decisions and planned writes without changing files
arcana add <skill...>                                            # Add specific skill(s) to the current setup
arcana add --all                                                 # Add all skills + agents
arcana add <skill...> --dry-run                                  # Preview install and mirror actions without writing files
arcana remove <skill...>                                         # Remove skill(s) from the current setup
arcana list                                                      # Show installed and available skills
arcana list --json                                               # Output installed inventory and imported skills as JSON
arcana sync                                                      # Multi-agent: sync canonical to mirrors
arcana sync --dry-run --clean                                    # Preview sync targets and stale-skill cleanup without writing files
arcana sync --verbose --clean                                    # Show target selection and stale-entry cleanup decisions
arcana update                                                    # Update managed installs that have changed
arcana update --force                                            # Restore packaged versions over local edits
arcana use <skill>                                               # Print skill to stdout (no install)
arcana import <source>                                           # Import skill from GitHub, URL, or local
arcana import <source> <skill-name> --review                     # Preview provenance and overwrite risk before forcing an overwrite
arcana import <source> --verbose                                 # Show resolved paths, fetch attempts, and target selection details
arcana doctor                                                    # Check installation health
arcana doctor --json                                             # Emit a machine-readable health report
arcana info <skill>                                              # Show skill metadata
arcana info <skill> --json                                       # Output skill, agent, or imported-skill metadata as JSON
arcana feedback <skill>                                          # Record structured feedback for a skill
arcana feedback-report [skill]                                   # Summarize collected feedback
arcana feedback-triage [skill]                                   # Turn repeated feedback into eval candidates
arcana feedback-triage <skill> --write                           # Write a local triage report for the current project
arcana feedback-triage [skill] --json                            # Output candidate eval follow-ups as JSON
arcana feedback-triage <skill> --write-drafts                    # Write local draft eval packs derived from repeated feedback
arcana feedback-hooks install                                    # Install or inspect Claude Code auto-feedback hooks
arcana feedback-promote <skill> <signal>                         # Promote a reviewed feedback-derived draft into evals/scenarios
arcana feedback-promote <skill> <signal> --dry-run               # Validate a reviewed draft before copying it into the scenario corpus
arcana feedback-promote <skill> <signal> --scenario-name <name>  # Promote into a renamed scenario directory after review
```
<!-- generated:README_COMMANDS:end -->

## Feedback Loop

Arcana now ships a local-first feedback flow designed for skill improvement, not vanity metrics:

- `arcana feedback <skill>` uses a **3-state rating**: `Helpful`, `Partly helpful`, `Not helpful`
- Negative or partial feedback captures **reason tags** tuned to the skill family
- With explicit consent, Arcana can analyze a provided **conversation transcript** and suggest what the skill was missing
- `arcana feedback-report [skill]` aggregates ratings, reasons, and recurring recommendations
- `arcana feedback-triage [skill]` turns repeated negative feedback into concrete eval follow-ups
- `arcana feedback-triage <skill> --write-drafts` turns repeated complaints into local draft eval packs under `.arcana/feedback/triage/drafts/`
- `arcana feedback-promote <skill> <signal>` validates a reviewed draft, promotes it into `evals/scenarios/`, and archives the original draft out of the open queue
- `arcana feedback-hooks install` enables **Claude Code auto-prompts** for explicit Arcana slash-skill sessions when the user corrects the skill, with cooldowns and optional sampling

Example:

```bash
arcana feedback feature-audit
arcana feedback deep-fix --rating not-helpful --reasons wrong-assumptions,not-actionable --notes "Assumed the wrong service"
arcana feedback feature-audit --transcript ./session.jsonl --analyze-transcript
arcana feedback-report feature-audit
arcana feedback-triage deep-fix --write
arcana feedback-triage deep-fix --write-drafts --draft-limit 1
arcana feedback-promote deep-fix wrong-assumptions --dry-run
arcana feedback-hooks install
arcana feedback-hooks status
```

Notes:

- Auto-feedback is **opt-in** and **Claude Code only**
- Automatic prompts are tied to **explicit Arcana slash skills** like `/feature-audit` or `/deep-fix`
- Transcript analysis still requires the user to explicitly include `analyze transcript` in the feedback reply
- Local feedback state is stored in `.arcana/feedback/`
- Triage reports and draft eval packs are written locally and are meant to be reviewed before turning them into committed eval cases
- `feedback-promote` archives the promoted draft under `.arcana/feedback/triage/promoted/` so release summaries stop counting it as an open draft

## Quality Operations

Phase 2 adds operator-facing quality artifacts on top of the eval and feedback systems:

- `npm run eval:imports` measures whether Arcana-style adaptation improved imported skills over their preserved raw baseline
- `npm run eval:boundaries` measures whether overlapping topics still route cleanly across neighboring skills like `feature-audit`, `feature-design`, and `pressure-test`
- `npm run eval:release-summary` generates a single release summary over stored scorecards, latest trigger runs, and local feedback-derived draft cases
- `node evals/build-release-summary.js --check` exits non-zero when release evidence is missing or stale

## Host Support

<!-- generated:README_CAPABILITIES:start -->
| Capability | Claude Code | Codex CLI | Notes |
| --- | --- | --- | --- |
| Install, list, inspect, import, update, and sync skills | Yes | Yes | Arcana CLI manages both hosts. Multi-agent mode keeps `.agents/skills/` canonical and mirrors skills to Claude Code. |
| Use shipped first-party and imported skills | Yes | Yes | Both hosts read installed skills from their own skills directory after `arcana init`, `add`, `import`, or `sync`. |
| Install shipped Arcana agent wrapper files | Yes | No | Arcana agents install to `.claude/agents/` only. Codex CLI does not have a separate agent directory. |
| Manual feedback capture, reports, and triage | Yes | Yes | `arcana feedback`, `feedback-report`, and `feedback-triage` are CLI features, not host-native UI integrations. |
| Manual transcript analysis with explicit consent | Yes | Yes | Requires an explicit transcript path. Arcana will not read conversation history automatically. |
| Automatic in-session feedback prompts | Yes | No | Implemented through Claude Code hooks via `arcana feedback-hooks install`. |
| Host-native hook/session integration | Yes | No | Current automation depends on Claude Code hook events and `transcript_path` support. |
| Live eval and trigger runners | Yes | No | Current eval harness shells out to Claude CLI. Codex parity would require a second runner. |
<!-- generated:README_CAPABILITIES:end -->

## Multi-Agent Setup

After `arcana init` with multi-agent mode:

1. Skills live in `.agents/skills/` (the canonical source)
2. Run `arcana sync` to mirror to `.claude/skills/`
3. Both Claude Code and Codex CLI see the same skills

| Mode   | Skills location               | Mirrors           | Config            |
| ------ | ----------------------------- | ----------------- | ----------------- |
| Claude | `.claude/skills/`             | --                | Auto-discovered   |
| Codex  | `.agents/skills/`             | --                | AGENTS.md updated |
| Multi  | `.agents/skills/` (canonical) | `.claude/skills/` | Both configs      |

## Quality Rules

Optionally install 3 quality rules during `arcana init` that improve AI agent behavior:

- **arcana-methodology.md** — multi-perspective, dynamic analysis
- **arcana-quality.md** — verify before output, no false positives
- **arcana-research.md** — research before acting, evidence-based

## Use Without Installing

```bash
arcana use deep-fix                 # preview a skill
arcana use release-check | pbcopy   # copy to clipboard
```

## Also Works as Claude Plugin

```bash
/plugin marketplace add cj-ways/arcana
/plugin install arcana@cj-ways-skills
```

## License

MIT
