---
name: agent-audit
description: 'Audits Claude Code agent configuration against latest best practices. Works on any project. Manual via /agent-audit.'
argument-hint: '[scope: full|hooks|permissions|claudeignore|claude-md|memory|skills|skill:<name>|agents|agent:<name>|rules]'
disable-model-invocation: true
---

# Agent Configuration Audit

Audit this project's Claude Code agent configuration against latest best practices.

## Argument Parsing

Parse `$ARGUMENTS` to determine scope. Examples:

| Invocation | Scope |
|---|---|
| `/agent-audit` | Full audit — all components |
| `/agent-audit full` | Same as above |
| `/agent-audit hooks` | Only hooks (settings.json hook config + .claude/hooks/ scripts) |
| `/agent-audit permissions` | Only permission allowlists/denylists in settings.json |
| `/agent-audit claudeignore` | Only .claudeignore |
| `/agent-audit claude-md` | Only CLAUDE.md |
| `/agent-audit memory` | Only MEMORY.md |
| `/agent-audit skills` | Deep-dive ALL skills — skip general audit |
| `/agent-audit skill:add-logs` | Deep-dive ONLY the `add-logs` skill — skip everything else |
| `/agent-audit skill:agent-audit` | Deep-dive ONLY this skill (meta-audit) |
| `/agent-audit agents` | Deep-dive ALL agents — skip general audit |
| `/agent-audit agent:code-reviewer` | Deep-dive ONLY the `code-reviewer` agent — skip everything else |

**Routing logic:**
- If argument starts with `skill:` → extract skill name → jump directly to **Skill Deep-Dive** for that one skill only. Skip Phases 1-2.
- If argument starts with `agent:` → extract agent name → jump directly to **Agent Deep-Dive** for that one agent only. Skip Phases 1-2.
- If argument is `skills` → discover all skills → run **Skill Deep-Dive** for each. Skip Phase 2 general audit.
- If argument is `agents` → discover all agents → run **Agent Deep-Dive** for each. Skip Phase 2 general audit.
- If argument is a component name (`hooks`, `permissions`, etc.) → run Phase 1 research scoped to that topic + Phase 2 checklist for that component only.
- If empty or `full` → run everything.

## Phase 1: Research Latest Best Practices

Use the Agent tool to launch **parallel research agents** (subagent_type: "general-purpose"). All agents MUST search the web for the **current year's** content:

### Agent 1: Official Claude Code Docs
Fetch latest official Claude Code documentation for:
- Hooks: events, matchers, exit codes
- Settings: permissions, deny lists, sandbox, attribution
- Memory: CLAUDE.md hierarchy, auto-memory, `.claude/rules/`
- Skills: **valid frontmatter fields** (critical — verify which fields are actually supported vs silently ignored)
- MCP, plugins, subagents

### Agent 2: Community Patterns & New Features
Search for:
- Claude Code changelog / release notes for current year
- Community best practices and patterns
- New features or deprecated settings

**When scoped to a component** (e.g., `/agent-audit hooks`): only research that component's docs, not everything.

## Phase 2: General Audit

Read and audit agent-related files. **Skip this phase entirely for `skills` or `skill:<name>` arguments.**

### Files to Check

Auto-discover — check for existence of each:
```
.claudeignore
.claude/settings.json
.claude/settings.local.json
.claude/hooks/*
.claude/commands/*
.claude/skills/*/SKILL.md (surface-level only — name, description, size)
.claude/agents/* (if exists)
.claude/rules/* (if exists)
.mcp.json (if exists)
CLAUDE.md (or claude.md)
openspec/ (if exists)
.gitignore
```

### Checklist

**`.claudeignore`**
- [ ] Excludes build artifacts (dist/, build/, node_modules/, .next/, etc.)
- [ ] Excludes secrets (.env, .keys/, certificates, *.pem)
- [ ] Excludes coverage and logs
- [ ] Excludes .git/
- [ ] No over-exclusion of files Claude needs

**`.claude/settings.json`**
- [ ] Has `$schema` for validation (if supported)
- [ ] Permission allowlists cover common safe commands
- [ ] Permission denylists block destructive commands
- [ ] Hooks are configured (PreToolUse protection, PostToolUse formatting)
- [ ] No outdated or deprecated settings

**Hooks**
- [ ] Protect-files hook covers sensitive paths (if exists)
- [ ] Hook scripts are executable (chmod +x)
- [ ] Exit codes correct (0=allow, 2=block)
- [ ] PostToolUse auto-format covers relevant extensions (if exists)
- [ ] No missing hook events that would be beneficial

**CLAUDE.md**
- [ ] Size under 15KB (if over, recommend moving sections to `.claude/rules/`)
- [ ] Contains project overview, commands, architecture, patterns
- [ ] No stale information
- [ ] No duplication with other config files

**Commands & Skills (surface-level)**
- [ ] All commands functional for current environment
- [ ] Referenced templates and files exist
- [ ] Each skill has frontmatter with `name` and `description`
- [ ] Descriptions are concise

**Memory (MEMORY.md if exists)**
- [ ] Under 200 lines
- [ ] Organized by topic
- [ ] No stale information

**.gitignore**
- [ ] Includes `.claude/settings.local.json`

## Phase 3: Skill Deep-Dive

**Triggered by:** `skills` (all), `skill:<name>` (one), or during `full` audit if a skill looks problematic in surface-level check.

### Discovery
1. List all skills: `ls .claude/skills/*/SKILL.md`
2. If `skill:<name>` — find the matching skill directory
3. Read each target skill's SKILL.md fully

### Complexity Assessment (for `skills` argument only)
Before auditing each skill, assess if it needs a separate agent:

**Use a separate agent when ANY of these are true:**
- SKILL.md exceeds 100 lines
- Skill contains inline commands (exclamation-backtick syntax) that need execution testing
- Skill references external files or scripts
- Skill has complex argument handling

**Audit inline (no separate agent) when:**
- SKILL.md is short and simple (under 100 lines)
- No inline commands or external references
- Straightforward instructions

### Skill Audit Checklist

For EVERY skill being deep-dived, check ALL of the following:

**Frontmatter**
- [ ] Only uses supported fields (from Phase 1 research — verify against latest docs)
- [ ] `name` is lowercase with hyphens
- [ ] `description` is concise — long descriptions bloat every session's system prompt
- [ ] No unsupported fields silently ignored

**Content & Structure**
- [ ] SKILL.md under 500 lines
- [ ] Clear separation of conventions vs workflow
- [ ] Examples provided for non-trivial behavior
- [ ] Supporting files (if any) exist and are referenced

**Technical Correctness**
- [ ] Inline commands (exclamation-backtick syntax) are valid — execute them and verify output
- [ ] Grep/filter patterns match current codebase naming conventions
- [ ] Referenced file paths and directories exist
- [ ] No hardcoded absolute paths
- [ ] No project-specific assumptions that should be generalized (for user-level skills)

**Codebase Alignment**
- [ ] Conventions match CLAUDE.md and project rules
- [ ] No contradictions with project patterns
- [ ] File naming patterns reflect current state
- [ ] Filter patterns cover all relevant file types

**Invocation & UX**
- [ ] Description clearly signals manual-only if intended
- [ ] `$ARGUMENTS` handling documented
- [ ] Output format specified (what user sees after skill runs)
- [ ] Error cases handled (e.g., no files match, empty diff)

**Security**
- [ ] No secrets in skill content
- [ ] Inline commands don't expose sensitive data
- [ ] Doesn't bypass protect-files hook

### Skill Deep-Dive Report (per skill)
```
### Skill: <skill-name>
**Lines:** N | **Complexity:** low/medium/high | **Agent used:** yes/no
**Checks Passed:** X/Y

| Category | Check | Status | Detail |
|----------|-------|--------|--------|
| Frontmatter | Supported fields only | PASS/FAIL | ... |
| Frontmatter | Description concise | PASS/FAIL | ... |
| Technical | Inline commands valid | PASS/FAIL | ... |
| Technical | Patterns match codebase | PASS/FAIL | ... |
| Alignment | Matches CLAUDE.md | PASS/FAIL | ... |
| Security | No secrets exposed | PASS/FAIL | ... |
```

## Phase 3b: Agent Deep-Dive

**Triggered by:** `agents` (all), `agent:<name>` (one), or during `full` audit.

### Discovery
1. List all agents: `ls .claude/agents/*.md`
2. If `agent:<name>` — find the matching agent file
3. Read each target agent file fully

### Agent Audit Checklist

For EVERY agent being deep-dived, check ALL of the following:

**Frontmatter**
- [ ] Has `name` and `description`
- [ ] `model` is appropriate for the agent's complexity (sonnet for fast tasks, opus for complex)
- [ ] Description examples match the project's domain and conventions

**Codebase Alignment**
- [ ] Tech stack references match actual project
- [ ] Review dimensions are relevant to this project's stack
- [ ] Convention checklist matches CLAUDE.md and project rules
- [ ] Architecture checks reflect actual patterns
- [ ] No references to frameworks, libraries, or patterns not used in this project

**Content Quality**
- [ ] Clear review process / workflow steps
- [ ] Output format specified
- [ ] Edge cases handled
- [ ] Guidelines are actionable and specific

**Security**
- [ ] No secrets in agent content
- [ ] No instructions that could bypass safety measures

### Agent Deep-Dive Report (per agent)
```
### Agent: <agent-name>
**Lines:** N | **Model:** sonnet/opus
**Checks Passed:** X/Y

| Category | Check | Status | Detail |
|----------|-------|--------|--------|
| Frontmatter | Has name + description | PASS/FAIL | ... |
| Frontmatter | Model appropriate | PASS/FAIL | ... |
| Alignment | Tech stack matches project | PASS/FAIL | ... |
| Alignment | Conventions match CLAUDE.md | PASS/FAIL | ... |
| Content | Clear workflow | PASS/FAIL | ... |
| Security | No secrets | PASS/FAIL | ... |
```

## Phase 4: Report

### Full/Component Audit Report
```
## Agent Configuration Audit Report
**Date:** YYYY-MM-DD
**Project:** <project name from CLAUDE.md or directory name>
**New Features Found:** [any new Claude Code features from research]

### Score: X/10

### What's Working Well
- ...

### Issues Found
| # | Severity | Component | Issue | Recommendation |
|---|----------|-----------|-------|----------------|

### Recommendations (Priority Ordered)
1. [HIGH] ...
2. [MEDIUM] ...
3. [LOW] ...
```

## Phase 5: Implementation Plan

If actionable improvements found:
1. Write concrete plan with exact file changes
2. Wait for user approval
3. On approval, implement changes

If no issues: report "All clear — configuration is up to date" and skip planning.

## Rules

- NEVER modify files without user approval
- ALWAYS search latest docs — do not rely on cached knowledge
- Be specific — include exact file paths and code snippets in recommendations
- Flag deprecated or silently-ignored settings/fields
- If CLAUDE.md exceeds 15KB, recommend moving sections to `.claude/rules/`
- Adapt to whatever project structure exists — don't assume any specific stack
- Check for both project-level AND user-level skills/rules conflicts
