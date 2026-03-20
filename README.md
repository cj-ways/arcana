# Arcana

[![npm version](https://img.shields.io/npm/v/@cj-ways/arcana)](https://www.npmjs.com/package/@cj-ways/arcana)
[![CI](https://github.com/cj-ways/arcana/actions/workflows/ci.yml/badge.svg)](https://github.com/cj-ways/arcana/actions)
[![license](https://img.shields.io/npm/l/@cj-ways/arcana)](https://github.com/cj-ways/arcana/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@cj-ways/arcana)](https://nodejs.org)

Curated agent skills for **Claude Code** and **Codex CLI**.

13 skills, 2 agents, 3 quality rules — all hand-authored against [SkillsBench](https://arxiv.org/abs/2602.12670) data (7,308 trajectories, +16.2pp improvement over no-skill baselines). Not scraped, not AI-generated.

## Why Arcana

- **Quality over quantity.** 13 battle-tested skills backed by 22 cited sources. SkillsBench shows curated skills improve agent performance by +16.2pp — self-generated skills show -1.3pp (no benefit).
- **Multi-agent sync.** One skill set, synced across Claude Code and Codex CLI. Edit once in `.agents/skills/`, mirror everywhere with `arcana sync`.
- **Extensible.** Need a skill Arcana doesn't ship? `import-skill` pulls from GitHub, URLs, or local files and adapts them to Arcana's quality standards.

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

| Phase | Skill | What it does |
|-------|-------|-------------|
| Ideate | `/idea-audit` | Validate project idea, competitive analysis, scaffold |
| Validate | `/feature-audit` | Interactive business audit — gaps, competitors, roadmap |
| Design | `/v0-design` | Generate optimized v0.dev prompts for UI |
| Test | `/generate-tests` | Auto-generate tests matching existing patterns |
| Review | `/quick-review` | Fast single-pass review with false-positive suppression |
| Review | `/deep-review` | 3 parallel specialist reviewers (security, correctness, architecture) |
| Ship | `/create-pr` | PR/MR with auto-generated description (GitHub + GitLab) |
| Ship | `/deploy-prep` | Release checklists — env vars, migrations, breaking changes |

## Toolkit Skills

Use anytime, not tied to a specific phase:

| Skill | What it does |
|-------|-------------|
| `/security-check` | Scan for secrets, vulnerabilities, dependency issues |
| `/find-unused` | Dead code detection with confidence tiers (SAFE / LIKELY / VERIFY) |
| `/persist-knowledge` | Auto-save patterns and conventions to project docs |
| `/agent-audit` | Audit agent configuration against latest best practices |
| `/import-skill` | Bring external skills into the Arcana ecosystem |

## Agents

| Agent | What it does |
|-------|-------------|
| `code-reviewer` | Single-pass review. PASS / NOTES / NEEDS CHANGES. |
| `review-team` | Spawns 3 parallel specialist reviewers for deep analysis. |

## Extend with import-skill

Arcana ships 13 skills. When you need something it doesn't have, `import-skill` is the bridge:

```bash
arcana use import-skill   # see what it does
```

Import any skill from GitHub, a URL, or a local file. The skill gets adapted to Arcana's quality standards — proper frontmatter, gotchas near the top, constraint-based design, and allowed-tools declarations.

## Commands

```bash
arcana init                     # Interactive setup (agent, scope, skills)
arcana add <skill...>           # Add specific skill(s)
arcana add --all                # Add all skills + agents
arcana remove <skill...>        # Remove skill(s)
arcana list                     # Show installed vs available
arcana sync                     # Multi-agent: sync canonical to mirrors
arcana update                   # Update installed skills to latest
arcana use <skill>              # Print skill to stdout (no install)
arcana doctor                   # Check installation health
arcana info <skill>             # Show skill metadata
```

## Multi-Agent Setup

After `arcana init` with multi-agent mode:

1. Skills live in `.agents/skills/` (the canonical source)
2. Run `arcana sync` to mirror to `.claude/skills/`
3. Both Claude Code and Codex CLI see the same skills

| Mode | Skills location | Mirrors | Config |
|------|----------------|---------|--------|
| Claude | `.claude/skills/` | -- | Auto-discovered |
| Codex | `.agents/skills/` | -- | AGENTS.md updated |
| Multi | `.agents/skills/` (canonical) | `.claude/skills/` | Both configs |

## Quality Rules

Optionally install 3 quality rules during `arcana init` that improve AI agent behavior:

- **arcana-methodology.md** — multi-perspective, dynamic analysis
- **arcana-quality.md** — verify before output, no false positives
- **arcana-research.md** — research before acting, evidence-based

## Use Without Installing

```bash
arcana use find-unused              # preview a skill
arcana use deploy-prep | pbcopy     # copy to clipboard
```

## Also Works as Claude Plugin

```bash
/plugin marketplace add cj-ways/arcana
/plugin install arcana@cj-ways-skills
```

## License

MIT
