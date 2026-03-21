---
name: refactor-plan
description: 'Plans and executes safe multi-file refactoring — maps dependency graph, batches changes into atomic commits, runs tests between batches. Prevents the cascading-breakage pattern where agents make sweeping changes that fail halfway. Use for renames, extractions, moves, or structural changes across multiple files. Manual via /refactor-plan.'
argument-hint: "<refactoring description>"
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Agent
effort: high
---

# Refactor Plan — Safe Multi-File Refactoring

Breaks a refactoring request into a dependency-aware execution plan with atomic batches and test gates. Prevents the most dangerous AI agent failure mode: sweeping multi-file changes that leave the codebase in a broken intermediate state.

**Input**: $ARGUMENTS (what to refactor — rename, extract, move, restructure, etc.)

## Gotchas

1. **Editing files before mapping the dependency graph.** Renaming a function used in 30 files without first finding all 30 call sites guarantees broken imports. ALWAYS map before modifying.
2. **Making all changes in one commit.** If a 15-file refactor breaks at file 8, the developer has to revert everything or debug a half-refactored codebase. Batch into atomic commits that each leave the codebase in a working state.
3. **Forgetting transitive dependents.** File A imports from File B, File C imports from File A. If File B's export changes, File C breaks indirectly. Trace at least 2 levels deep.
4. **Not running tests between batches.** Each batch must pass tests before proceeding to the next. A failing test in batch 2 is cheap to fix. A failing test discovered after batch 5 is expensive.
5. **Refactoring and improving simultaneously.** The refactoring should change structure, not behavior. Do not fix bugs, add features, or "improve" code in the same batch. Behavior-preserving changes are verifiable. Mixed changes are not.

---

## Step 1: Understand the Request

Parse `$ARGUMENTS` to determine:

1. **Refactoring type**: classify as one of:
   - **Rename** — symbol, file, or directory rename
   - **Extract** — pull code into a new function, module, or package
   - **Move** — relocate files or modules to a different directory
   - **Inline** — collapse an abstraction back into its callers
   - **Restructure** — change module boundaries, split/merge modules
   - **Signature change** — modify function parameters, return types, or interfaces

2. **Scope**: estimate number of files affected (read the codebase first — do not guess)

3. **Risk level**:
   - **Low**: <5 files, single module, no public API changes
   - **Medium**: 5-20 files, cross-module, internal API changes
   - **High**: 20+ files, public API changes, or database schema involved

If risk is High, present the scope assessment and ask for confirmation before proceeding.

---

## Step 2: Map the Dependency Graph

Before touching any code, build a complete map of what depends on what.

### 2a. Identify the refactoring target
- Read the file(s) or symbol(s) being refactored
- Extract: exported names, types, interfaces, class methods

### 2b. Find all direct dependents
For each exported symbol being changed:
- Grep for import statements referencing the target file/module
- Grep for direct usage of the symbol name across the codebase
- Check barrel files (index.ts/index.js) that re-export the target
- Check import aliases defined in tsconfig.json paths, webpack aliases, package.json imports

### 2c. Find transitive dependents (one level)
For each direct dependent found in 2b:
- Check if IT re-exports the changed symbol
- If yes, find dependents of that re-export

### 2d. Check non-code references
- Config files that reference the target (webpack config, jest config, CI files)
- Documentation that references the target (README, CLAUDE.md, JSDoc)
- Test files that import or reference the target
- Scripts and Makefiles

### 2e. Produce the dependency map

```
## Dependency Map

**Target:** [what's being refactored]
**Direct dependents:** [N files]
**Transitive dependents:** [N files]
**Non-code references:** [N files]
**Total affected:** [N files]

| File | Dependency Type | Change Needed |
|------|----------------|---------------|
| src/utils/foo.ts | Direct import | Update import path |
| src/services/bar.ts | Uses exported type | Update type reference |
| tests/foo.test.ts | Test file | Update import + test names |
| tsconfig.json | Path alias | Update alias target |
```

---

## Step 3: Design the Batch Plan

Split the refactoring into ordered batches. Each batch must leave the codebase in a **compilable, test-passing state.**

### Batch design principles:

1. **Infrastructure first** — new files, directories, or config changes that don't break anything
2. **Dual-write / backward-compatible changes** — add the new path while keeping the old one working (re-exports, aliases, deprecation wrappers)
3. **Migrate dependents** — update consumers to use the new path/name, one logical group at a time
4. **Remove the old** — delete deprecated re-exports, old files, old aliases
5. **Clean up** — remove backward-compatibility shims, update docs

### Batch plan format:

```
## Refactoring Plan: [description]

**Type:** [rename/extract/move/inline/restructure/signature]
**Risk:** [low/medium/high]
**Total batches:** [N]
**Estimated files:** [N]

### Batch 1: [title] — Infrastructure
- [ ] [specific file change]
- [ ] [specific file change]
- **Test gate:** `[test command]`

### Batch 2: [title] — Backward-compatible bridge
- [ ] [specific file change]
- **Test gate:** `[test command]`

### Batch 3: [title] — Migrate dependents (group 1)
- [ ] [specific file change]
- [ ] [specific file change]
- **Test gate:** `[test command]`

### Batch 4: [title] — Remove old paths
- [ ] [specific file change]
- **Test gate:** `[test command]`
```

Present the batch plan to the user. Wait for confirmation before executing.

---

## Step 4: Execute Batches

For each batch:

1. **Apply the changes** listed in the batch
2. **Run the test gate** — the specified test command
3. **If tests pass**: commit with message `refactor: [batch title]` and proceed to next batch
4. **If tests fail**:
   - Read the failure output
   - Identify what broke — is it a missed dependent? A transitive import? A type mismatch?
   - Fix within this batch (do not proceed to next batch with failures)
   - Re-run tests
   - If the fix requires changing the plan for later batches, update the plan and inform the user

### Commit message format per batch:
```
refactor: [batch description]

Part [N] of [total]: [one-line summary of what this batch does]
```

---

## Step 5: Verify

After all batches complete:

1. **Run the full test suite** — not just the targeted test gate, the full suite
2. **Run the build** — if a build command exists (TypeScript compilation, Go build, etc.)
3. **Run the linter** — if configured (ESLint, golangci-lint, etc.)
4. **Diff review** — run `git diff [start-commit]..HEAD --stat` to verify total scope matches the plan

If any step fails, identify which batch introduced the issue and fix it.

---

## Step 6: Report

```
## Refactoring Report

**Request:** [original $ARGUMENTS]
**Type:** [rename/extract/move/inline/restructure/signature]
**Batches executed:** [N]
**Files modified:** [N]
**Tests:** [all passing / N failures noted]

### Batch Summary
| # | Title | Files | Status |
|---|-------|-------|--------|
| 1 | Infrastructure | 2 | Done |
| 2 | Bridge | 1 | Done |
| 3 | Migrate dependents | 8 | Done |
| 4 | Remove old | 3 | Done |

### Changes
[grouped by batch, one-line per file change]
```

**If the refactoring revealed code quality issues**, mention: "Consider running `/quick-review` to verify the refactored code for correctness."

**If the refactoring was large and touched critical paths**, mention: "Consider running `/deep-review` for a full security and architecture check on the changed files."

## Rules

- NEVER modify code without completing the dependency map (Step 2)
- NEVER proceed to the next batch with failing tests
- NEVER mix behavior changes with structural changes in the same batch
- ALWAYS present the batch plan for user confirmation before executing
- ALWAYS commit after each successful batch — atomic commits enable easy revert
- If the scope exceeds 50 files, strongly recommend splitting into multiple refactoring sessions
- Match existing code style — a refactoring that changes indentation or formatting alongside structural changes is harder to review
