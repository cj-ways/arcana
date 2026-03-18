---
name: persist-knowledge
description: 'Persists codebase patterns, conventions, or architectural knowledge to CLAUDE.md, MEMORY.md, or .claude/rules/. Auto-invokes when the user states a convention like "we always do X," "the pattern is," "from now on," or corrects a project-wide pattern. Manual via /persist-knowledge.'
argument-hint: '[focus: patterns|decisions|memory|claude]'
allowed-tools: Read, Edit, Glob, Grep, Write
---

# Persist Knowledge

Two modes of operation:

1. **Auto-invocation** — Agent detects the user sharing a global pattern/convention/rule mid-conversation and persists it immediately (lightweight, single-finding).
2. **Manual invocation** (`/persist-knowledge`) — Full session scan at end of session, consolidates all findings.

## Auto-Invocation Mode

**When to trigger:** The agent should invoke this skill when the user states something that looks like a **global codebase convention, pattern, or rule** — not a one-off task instruction. Signals include:

- "We always do X in this project"
- "The convention is X"
- "Never do X, always do Y"
- "From now on, X"
- "The pattern for X is Y"
- "Every X should have Y"
- User corrects the agent on a pattern that applies project-wide
- User explains a non-obvious codebase-wide behavior or constraint
- User states a naming convention, file organization rule, or architectural principle

**When NOT to trigger:**

- One-off task instructions ("use X for this file")
- Questions or discussions without a stated rule
- Information already documented in CLAUDE.md, MEMORY.md, or `.claude/rules/`
- Personal preferences that don't affect the codebase ("I like dark mode")

**Workflow (auto-invoke):**

1. Extract the specific pattern/rule/convention from what the user said
2. Classify it using the Documentation Hierarchy table below
3. Read the target file to check for duplicates
4. If new: write it to the correct location, matching surrounding style
5. Report briefly: `Persisted to <target>: "<one-line summary>"`
6. If already documented: report `Already documented in <target> (line N)` — do not duplicate

Keep it lightweight — no full session scan, no summary table, no commit message suggestion.

## Manual Mode (`/persist-knowledge`)

### Arguments

```
/persist-knowledge [focus]
```

| Arg         | Effect                                   |
| ----------- | ---------------------------------------- |
| _(none)_    | Full scan — all categories               |
| `patterns`  | Only new code patterns -> CLAUDE.md      |
| `decisions` | Only architectural decisions -> MEMORY.md|
| `memory`    | Only update MEMORY.md                    |
| `claude`    | Only update CLAUDE.md                    |

### Phase 1: Scan the Current Session

Read the current conversation context and identify findings across these categories:

**Code patterns** — Are there any naming conventions, file structure rules, import conventions,
type/interface patterns, or coding style rules that were established or confirmed?

**Architectural decisions** — Were any decisions made about module structure, service design,
data model design, state management, API design, or system boundaries?

**User preferences** — Any style preferences, comment conventions, workflow preferences,
or tool preferences stated by the user?

**Corrections** — Did any existing documentation turn out to be wrong, misleading,
or incomplete?

**Project status** — Were any milestones reached, phases completed, or significant
decisions resolved?

For each finding, determine:

1. Is it **new**? (not already in any target file)
2. Is it **stable**? (expected to persist beyond this session)

### Phase 2: Check Existing Docs

Before writing, read the relevant sections of each target file to detect duplicates
and find the right insertion point:

1. **Read CLAUDE.md** — specifically Code Patterns, Architecture, and Code Style sections
2. **Read MEMORY.md** — all sections
3. **Read `.claude/rules/*.md`** — any file relevant to the findings

For each finding:

- **Already documented correctly** -> skip, mark as "Confirmed existing"
- **Documented but needs correction/expansion** -> update in place, mark as "Updated"
- **Not documented** -> write, mark as "Added"

### Phase 3: Write Updates

Write findings to target files. For each write:

#### Writing to CLAUDE.md

- Insert into the most specific matching section
- If no section fits, add a new `###` subsection under the most relevant `##` section
- Format: bullet list, one-liners, match surrounding style exactly
- No decorative comments, no rationale unless the logic is genuinely non-obvious
- Example of correct style (match this):
  ```
  - All API responses use camelCase keys — never snake_case in JSON output
  ```

#### Writing to MEMORY.md

- Find the matching existing topic group
- If no group fits, add a new `## Topic Name` section above `# currentDate`
- Format: bullet points, one-liners
- Date architectural decisions: append `(YYYY-MM-DD)` to the section header or the bullet
- Example of correct style:
  ```
  - Switched from REST to GraphQL for all client-facing APIs (2026-03-18)
  ```

#### Writing to `.claude/rules/<topic>.md`

- Only when a new multi-line topic needs its own reference (>15 lines on one topic)
- Create the file only if it does not exist
- Use the same markdown structure as existing rules files

### Phase 4: Report

Present a summary table of all findings:

```
## Session Learnings — YYYY-MM-DD

| Finding | Category | Target | Action |
|---------|----------|--------|--------|
| API responses always camelCase | Code pattern | CLAUDE.md | Added |
| Services use constructor injection | Code pattern | CLAUDE.md | Confirmed existing (line 42) |
| Migrated auth to OAuth2 | Arch decision | MEMORY.md | Added |
| Test naming uses describe/it blocks | Code pattern | CLAUDE.md | Updated |

Total: N added, M updated, P confirmed existing (skipped)
```

If no new learnings found: output "No new patterns or decisions to persist from this session."

Suggested commit message if files were modified:

```
docs(claude): consolidate session learnings from <feature/topic> session
```

## Documentation Hierarchy

Before writing anything, understand where each type of finding belongs:

| Content                                                                                  | Target                              | Rule                                                                               |
| ---------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Stable project-wide code patterns (naming, structure, return types, conventions)         | `CLAUDE.md` — Code Patterns section | Must be confirmed across multiple files or explicitly stated by user as convention |
| Topic-specific deep reference (>15 lines on one topic)                                   | `.claude/rules/<topic>.md`          | When CLAUDE.md section becomes too long                                            |
| Session decisions, per-session learnings, user preferences, status updates               | `MEMORY.md`                         | Everything else — must be < 200 lines total                                        |

## Rules

- NEVER duplicate content that already exists in any target file — read first, always
- NEVER create new files (other than new `.claude/rules/<topic>.md` when genuinely needed)
- NEVER exceed 200 lines in MEMORY.md — warn if approaching limit, suggest pruning stale entries
- NEVER add rationale/comments unless the logic is non-obvious (match the project style)
- ALWAYS read target files before writing to verify no duplicates
- ALWAYS match the exact bullet style and formatting of surrounding content
- ALWAYS include session date `(YYYY-MM-DD)` for architectural decisions in MEMORY.md
- If the session had no new learnings: report this honestly, do not invent content
- Only use these tools: Read, Edit, Glob, Grep, Write (only for new `.claude/rules/<topic>.md`)

## Output

**Auto-invocation:** Single line — `Persisted to <target>: "<summary>"` or `Already documented in <target>`.

**Manual invocation:**

1. Summary table (findings -> target -> action)
2. Suggested commit message (if files were modified)
