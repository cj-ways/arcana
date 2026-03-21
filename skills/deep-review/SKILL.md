---
name: deep-review
description: 'Multi-perspective deep code review using 3 specialized parallel reviewers (security, correctness, architecture). Consolidates into unified report with confidence gating. Use for pre-release audits or security-critical changes. Manual via /deep-review.'
argument-hint: "[files or branch]"
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Agent
effort: high
isolation: worktree
memory: project
---

<command-name>deep-review</command-name>

You are orchestrating a **multi-pass deep code review**. You will launch 3 specialized reviewer agents in parallel, then consolidate their findings into a single unified report.

## Gotchas

1. **Flagging project conventions as bugs.** Always read CLAUDE.md and project rules in Step 0. If the project says "we use X pattern," that pattern is not a bug. Reviewers that skip Step 0 produce the worst false positives.
2. **Embedding too much code overwhelms agents.** Enforce the 500-line limit per file. When a 2000-line file is pasted in full, agents lose focus and hallucinate issues in the unchanged portions. Summarize long files and include only the changed hunks with context.
3. **Not checking sibling files for context.** A function that appears to lack auth may inherit it from a parent module, middleware, or decorator on the class. Agents should use the Read tool to check the surrounding module for guards, middleware, or base class decorators before flagging missing auth.
4. **Reporting style issues as correctness bugs.** Naming conventions, comment style, import ordering, and formatting are never correctness bugs. If it compiles and runs correctly, it is not a correctness finding.
5. **Missing that a "bug" is already handled by a framework feature.** Many frameworks provide automatic behavior: TypeORM auto-rollback on failed transactions, Rails automatic CSRF protection, Next.js automatic static optimization, Django ORM lazy evaluation. Before reporting missing error handling or missing cleanup, verify the framework doesn't already handle it.

## Step 0: Understand Project Context

Before reviewing any code, read the project's context files:

1. **Read `CLAUDE.md`** (if it exists) — extract tech stack, conventions, safe patterns, auth model, and architecture rules.
2. **Read `README.md`** (if it exists) — understand what the project does and its high-level structure.
3. **Scan `.claude/rules/`** (if it exists) — pick up any enforcement rules that might affect what counts as a bug vs. a convention.

Store this context as a **project profile** containing:
- Tech stack (e.g., NestJS, Rails, Next.js, Django, Go, Rust)
- Auth model (guards, middleware, decorators, etc.)
- Known safe patterns and conventions the project explicitly allows
- Architecture rules and module boundaries

This profile will be embedded in every reviewer agent's prompt to prevent false positives.

## Step 1: Collect the Diff and Changed Files

Determine what to review. Run these commands:
```bash
git diff
git diff --cached
git log --oneline -10
```

If the user specified particular files, a branch, or a worktree path, adapt accordingly.

**CRITICAL: Identify ALL changed and new files.** Run:
```bash
git diff --name-only
git diff --cached --name-only
git ls-files --others --exclude-standard
```

Then **read every changed/new file** using the Read tool. You need the full content of each file to pass to the reviewers. For modified files, also capture the diff hunks showing what changed.

**500-line limit:** If any single file exceeds 500 lines, include only the changed hunks plus 50 lines of surrounding context. Summarize the remainder ("File is N lines total; full content omitted; relevant sections included above"). Embedding too much code overwhelms agents and degrades review quality.

Build a **review package** containing:
1. The list of changed/new files
2. The diff output (for modified files)
3. The full content of each new/changed file (or summarized if >500 lines)
4. The **project profile** from Step 0

## Step 2: Launch 3 Specialized Reviewers in Parallel

Launch ALL THREE agents simultaneously using the Agent tool. **Include the full diff, file contents, and project profile directly in each agent's prompt** — do NOT tell agents to run git commands themselves. This ensures they review the correct code regardless of working directory state.

**CRITICAL EMBEDDING RULES:**
- Paste the COMPLETE diff and file contents directly into each agent's prompt — not a summary, not a reference
- Do NOT include phrases like "run git diff" or "check the repo" — agents must work exclusively from embedded code
- Each agent MUST receive the project profile so they can respect project conventions
- Each agent MUST receive identical code to ensure consistent review scope

**Agent 1 — Security Reviewer:**
```
prompt: "You are a security-focused code reviewer. Review the following code changes for security vulnerabilities. Focus ONLY on: injection (SQL, command, path traversal, template), authentication/authorization gaps, IDOR, secrets exposure, XSS, unsafe deserialization.

IMPORTANT: All code to review is provided below. Do NOT run any git commands. Use the Read tool ONLY to check sibling files for context (e.g., existing auth guards in parent modules, middleware definitions, entity definitions).

## Project Profile
[paste the project profile from Step 0 — tech stack, auth model, conventions, safe patterns]

## Audit Tables
Based on the tech stack, produce these audit tables:
[Generate project-appropriate audit tables — see Dynamic Audit Table Discovery below]

## Changed Files
[paste the list of changed files]

## Diff
[paste the full diff output]

## Full File Contents
[for each new/changed file, paste: === filename ===\n<content>]"
```

**Agent 2 — Correctness Reviewer:**
```
prompt: "You are a correctness-focused code reviewer. Review the following code changes for correctness bugs. Focus ONLY on: null safety, missing await/async, unloaded relations, transaction boundaries, migration correctness, logic bugs, resource leaks, race conditions, off-by-one errors.

IMPORTANT: All code to review is provided below. Do NOT run any git commands. Use the Read tool ONLY to check sibling files for context (e.g., entity definitions for eager relations, service method signatures, type definitions).

## Project Profile
[paste the project profile from Step 0 — tech stack, conventions, safe patterns]

## Audit Tables
Based on the tech stack, produce these audit tables:
[Generate project-appropriate audit tables — see Dynamic Audit Table Discovery below]

## Changed Files
[paste the list of changed files]

## Diff
[paste the full diff output]

## Full File Contents
[for each new/changed file, paste: === filename ===\n<content>]"
```

**Agent 3 — Architecture Reviewer:**
```
prompt: "You are an architecture-focused code reviewer. Review the following code changes for architecture violations and performance problems. Focus ONLY on: cross-module boundary violations, circular dependencies, tier violations, unbounded queries, N+1 patterns, expensive operations in loops.

IMPORTANT: All code to review is provided below. Do NOT run any git commands. Use the Read tool ONLY to check sibling files for context (e.g., module imports, dependency registrations, route/middleware definitions).

## Project Profile
[paste the project profile from Step 0 — tech stack, architecture rules, module boundaries]

## Changed Files
[paste the list of changed files]

## Diff
[paste the full diff output]

## Full File Contents
[for each new/changed file, paste: === filename ===\n<content>]"
```

### Dynamic Audit Table Discovery

Based on the tech stack detected in Step 0, generate project-appropriate audit tables for each reviewer. Examples by framework:

| Tech Stack | Security Audit Tables | Correctness Audit Tables |
|---|---|---|
| **NestJS** | Auth guard audit (check `@UseGuards`), Injectable scoping audit, SQL interpolation audit | Null-check audit, Await audit, Resource cleanup audit |
| **Rails** | `before_action` auth audit, Strong params audit, CSRF protection audit | ActiveRecord callback audit, Transaction audit, N+1 query audit |
| **Next.js** | Middleware auth audit, API route protection audit, CSRF audit | Data fetching audit (SSR vs client), Cache invalidation audit |
| **Django** | Permission/decorator audit, ORM injection audit, CSRF middleware audit | QuerySet evaluation audit, Transaction audit, Signal handler audit |
| **Express** | Middleware auth audit, Input validation audit, CORS audit | Async error handling audit, Connection pool audit |
| **Go** | Handler auth middleware audit, SQL interpolation audit | Error check audit, Goroutine leak audit, Defer audit |

If the tech stack doesn't match any of the above, detect project-specific audit patterns from CLAUDE.md and the codebase, then create relevant audit tables.

## Step 3: Consolidate Findings

Once all 3 agents return, produce a **unified report** following these consolidation rules:

### Deduplication
- Same file + overlapping lines + same underlying problem → keep the higher severity version
- If two agents flag the same code for different reasons (e.g., security flags missing auth, architecture flags tier violation), keep BOTH as separate findings — they are different problems

### Merge Audit Tables
Combine all audit tables from all reviewers into the final report. The specific tables will vary by project — include every audit table that any reviewer produced.

### Confidence Gate
- Any finding marked `likely` that appears in only ONE agent's output → briefly re-examine it. If you agree it's real, keep it. If evidence is weak, downgrade to a "Noteworthy" section (not a formal finding).
- Findings marked `certain` from any agent → always include.
- Findings marked `likely` that are corroborated by another agent → always include.

### Convention Cross-Check
Before finalizing, verify no finding conflicts with the project profile from Step 0. Read CLAUDE.md for project conventions and safe patterns before flagging. If a project explicitly documents a pattern as intentional (e.g., specific coding conventions, allowed shortcuts, framework-specific idioms), remove that finding from the final report.

## Step 4: Output Format

Present the unified report in this format:

```markdown
# Deep Review — Multi-Pass Results

## Summary
- **Security pass:** X findings (Y critical, Z high)
- **Correctness pass:** X findings (Y critical, Z high)
- **Architecture pass:** X findings (Y critical, Z high)
- **Total after dedup:** N findings

## Findings

### [Finding number]. [Title]
- **Severity:** critical / high / medium / low
- **Category:** security / correctness / architecture / performance
- **Confidence:** certain / likely
- **Impact:** [specific impact]
- **Location:** `file:line`
- **Description:** [what and why]
- **Suggestion:**
[code fix]

---

(repeat for each finding, ordered by severity)

## Noteworthy (Low Confidence)
(Items downgraded from `likely` during confidence gate — brief mention only)

## Audit Tables
(All audit tables from all reviewers, merged and organized by category)
```

If ALL three reviewers report no issues, say:
> **Deep review complete — no issues found across security, correctness, and architecture passes.**
And still include the audit tables.

### Cross-Skill Suggestions (append when relevant)
- If architecture findings suggest structural problems beyond the diff, add: "Consider running `/feature-audit` for a full business and architecture analysis of this feature."
- If security findings are critical, add: "Consider running `/security-check` for a full project-wide security scan beyond the changed files."
- If the review is pre-release, add: "Run `/release-check` to generate deploy checklists for env vars, migrations, and infrastructure changes."

