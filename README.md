# Arcana

Universal agent skills CLI. Install, manage, and sync battle-tested skills across **Claude Code, Codex CLI, Cursor**, and any agent that reads SKILL.md.

7 skills + 1 agent. Stack-agnostic. Multi-agent ready.

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
  > All (7 skills + 1 agent)
  > Custom (pick specific)
```

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
