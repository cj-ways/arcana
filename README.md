# Arcana

[![npm version](https://img.shields.io/npm/v/@cj-ways/arcana)](https://www.npmjs.com/package/@cj-ways/arcana)
[![license](https://img.shields.io/npm/l/@cj-ways/arcana)](https://github.com/cj-ways/arcana/blob/main/LICENSE)

Universal agent skills CLI. Install, manage, and sync battle-tested skills across **Claude Code, Codex CLI, Cursor**, and any agent that reads SKILL.md.

13 skills + 1 agent. Stack-agnostic. Multi-agent ready.

## Install

```bash
npx @cj-ways/arcana init
```

Or install globally:

```bash
npm install -g @cj-ways/arcana
arcana init
```

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

## Init Flow

```
$ arcana init

? Where are you installing?
  > Project level (this repo)
  > User level (global, all projects)

? Which agent(s)?
  > Claude Code
  > Codex CLI
  > Multi-agent (Claude + Codex + Cursor)

? Which skills?
  > All (13 skills + 1 agent)
  > Custom (pick specific)
```

### Quality Rules (Optional)

During `arcana init`, you can optionally install Arcana's quality rules — research-first, evidence-based patterns that improve AI agent behavior across your project.

```bash
arcana init  # asks "Apply Arcana quality rules?"
```

Rules are installed to `.claude/rules/` as 3 focused files:
- `arcana-quality.md` — verify before output, no false positives
- `arcana-research.md` — research before acting, evidence-based
- `arcana-methodology.md` — multi-perspective, dynamic analysis

Run `/agent-audit rules` to check for conflicts with your existing project rules.

### What each mode sets up

| Mode | Skills location | Mirrors | Config |
|------|----------------|---------|--------|
| Claude | `.claude/skills/` | -- | Auto-discovered |
| Codex | `.agents/skills/` | -- | AGENTS.md updated |
| Multi-agent | `.agents/skills/` (canonical) | `.claude/skills/` + `.cursor/skills/` | Both configs |

## Skills

| Skill | Description |
|-------|-------------|
| `agent-audit` | Audit Claude Code config against latest best practices |
| `feature-audit` | Interactive business audit -- gaps, competitors, roadmap |
| `new-project-idea` | Analyze idea critically, scaffold full project |
| `find-unused` | Find dead code: unused exports, orphaned files, dead deps |
| `persist-knowledge` | Auto-save patterns/conventions to CLAUDE.md |
| `create-pr` | Create PR/MR with auto-generated description (GitHub + GitLab) |
| `deploy-prep` | Release analysis with deployment checklists |
| `deep-review` | Multi-perspective deep code review with 3 parallel reviewers |
| `quick-review` | Fast single-pass review with false-positive suppression |
| `v0-design` | Generate optimized v0.dev prompts for UI design |
| `import-skill` | Import skills from GitHub, URLs, or local files |
| `generate-tests` | Auto-generate tests matching existing patterns |
| `security-check` | Security scan for secrets, vulns, dependencies |

## Agent

| Agent | Description |
|-------|-------------|
| `code-reviewer` | Zero-context multi-pass code review. PASS / NOTES / NEEDS CHANGES. |

## Use Without Installing

Print any skill to stdout without writing files:

```bash
arcana use find-unused
arcana use deploy-prep | pbcopy   # copy to clipboard
```

## Multi-Agent Workflow

After init with multi-agent mode:

1. Edit skills in `.agents/skills/` (the canonical source)
2. Run `arcana sync` to mirror to `.claude/skills/` + `.cursor/skills/`
3. All agents see the same skills

## Also Works as Claude Plugin

```bash
/plugin marketplace add cj-ways/arcana
/plugin install arcana@cj-ways-skills
```

## License

MIT
