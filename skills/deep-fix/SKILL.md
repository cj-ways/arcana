---
name: deep-fix
description: 'Structured debugging for non-obvious bugs — reproduces, isolates root cause, verifies hypothesis before fixing, and adds regression tests. Prevents the shotgun-fix pattern where agents edit randomly until tests pass. Use when stuck on a bug, facing a cryptic error, or when a previous fix attempt failed. Manual via /deep-fix.'
argument-hint: "<error-message, file, or bug description>"
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Agent, WebSearch
effort: high
---

# Deep Fix — Structured Debugging

A disciplined debugging workflow that prevents the most common AI agent failure mode: looping on failed fixes without understanding the root cause. Every fix must be preceded by a verified hypothesis.

**Input**: $ARGUMENTS (error message, file path, bug description, or test failure)

## Gotchas

1. **Editing code before understanding the bug.** The #1 failure mode. If the fix attempt fails, the agent makes another guess, creating a loop of random edits. NEVER edit code until Step 3 (Hypothesize) produces a concrete, testable hypothesis.
2. **Reading the error message without reading the stack trace.** The error message says WHAT failed. The stack trace says WHERE. Read the full trace — the root cause is usually 3-5 frames deep, not at the top.
3. **Fixing the symptom instead of the cause.** Adding a null check to silence a TypeError is a patch, not a fix. Ask: WHY is this value null? Trace the data flow backward to the source.
4. **Not reproducing before fixing.** If the bug can't be reproduced, the fix can't be verified. A fix without reproduction evidence is a guess.
5. **Declaring victory without a regression test.** A fix that passes existing tests but adds no new test will break again. Every fix gets a test that would have caught the original bug.

---

## Step 1: Reproduce

Establish that the bug exists and is reproducible.

1. **Parse the input**: Extract the error message, stack trace, failing test, or behavioral description from `$ARGUMENTS`
2. **Reproduce the failure**:
   - If a test fails: run it — `npm test`, `pytest`, `go test`, etc.
   - If a runtime error: identify the trigger and execute it
   - If a behavioral bug: identify the minimal steps to observe it
3. **Record the reproduction**:
   - Exact command that triggers the failure
   - Full error output (not truncated)
   - Environment details if relevant (Node version, OS, etc.)

If the bug **cannot be reproduced**, stop. Report: "Could not reproduce. Here is what was tried: [list]. Possible intermittent issue — check for race conditions, timing dependencies, or environment-specific factors."

If the bug **is reproduced**, state: "Reproduced. Trigger: [command]. Error: [one-line summary]." Proceed to Step 2.

---

## Step 2: Isolate

Narrow down exactly where the failure occurs.

1. **Read the stack trace** — identify the deepest application frame (skip framework/library frames)
2. **Read the source file** at the failing line and 50 lines of surrounding context
3. **Trace the data flow**:
   - What inputs reach the failing line?
   - Where do those inputs come from? (function arguments, API responses, database queries, config)
   - At what point does the data become incorrect?
4. **Check recent changes**: `git log --oneline -10 <file>` and `git diff HEAD~5 <file>` — did a recent change introduce this?
5. **Check sibling context**: Read the calling function, the module's imports, and any middleware/decorators

Produce an **isolation statement**: "The failure occurs at `file:line` because `[variable/value]` is `[actual]` when it should be `[expected]`. The incorrect value originates from `[source]`."

---

## Step 3: Hypothesize

Form a concrete, testable hypothesis about the root cause.

**Hypothesis format**: "The bug is caused by [specific mechanism] in [specific location]. This can be verified by [specific test]."

**Hypothesis quality check** — reject and re-investigate if:
- The hypothesis is vague ("something is wrong with the data")
- The hypothesis blames external code without evidence ("the library must have a bug")
- The verification step is "apply the fix and see if tests pass" — that is guessing, not verifying

**Common root cause patterns** (check each against the evidence):
- Missing null/undefined check after a lookup that can return empty
- Async operation not awaited — data used before it's available
- Stale closure capturing an old value
- Off-by-one in loop bounds or array indexing
- Type coercion producing unexpected results
- Race condition between concurrent operations
- Config/environment difference between where it works and where it fails
- Import order or circular dependency causing undefined at load time

---

## Step 4: Verify Hypothesis

Confirm the hypothesis is correct BEFORE writing the fix.

**Verification methods** (use at least one):
- Add a temporary `console.log` / `print` / `fmt.Println` at the suspected point — does the output confirm the hypothesis?
- Write a minimal failing test that isolates the exact condition the hypothesis describes
- Use `git bisect` if the bug was introduced by a specific commit
- Check if the same pattern exists elsewhere in the codebase — if so, does it fail there too?

If verification **confirms** the hypothesis: state "Hypothesis confirmed: [evidence]." Proceed to Step 5.

If verification **disproves** the hypothesis: state "Hypothesis disproved: [evidence]. Returning to isolation." Go back to Step 2 with the new information.

---

## Step 5: Fix

Apply the minimal fix that addresses the root cause.

**Fix principles:**
- Fix the cause, not the symptom. If a value is null, fix WHY it's null — don't just add `?? defaultValue`
- Minimal change. Only modify what is necessary. Do not refactor, clean up, or "improve" surrounding code
- Match existing patterns. If the codebase handles similar cases with a specific pattern, use the same pattern
- Remove temporary debug code (console.log, print statements) added during verification

**After applying the fix:**
1. Run the original reproduction command — does the error stop?
2. Run the full test suite — does anything else break?
3. If tests fail, the fix is wrong or incomplete. Do NOT layer another fix on top. Return to Step 3.

---

## Step 6: Regression Test

Write a test that would have caught the original bug.

1. The test must **fail without the fix** and **pass with the fix**
2. The test must target the **root cause**, not the surface symptom
3. Name the test descriptively: `"handles null response from API"` not `"fix bug #123"`
4. Follow existing test patterns — detect framework, match style (same rules as generate-tests)

Run the test to confirm it passes with the fix applied.

---

## Step 7: Report

Present the debugging results:

```
## Deep Fix Report

**Bug:** [one-line description]
**Root cause:** [what was actually wrong and why]
**Fix:** [what was changed, file:line references]
**Regression test:** [test name and file]
**Confidence:** high / medium (medium if hypothesis verification was indirect)

### Debug trace
1. Reproduced: [command and error]
2. Isolated to: [file:line, data flow]
3. Hypothesis: [what was suspected]
4. Verified by: [how hypothesis was confirmed]
5. Fixed: [minimal change description]
6. Tested: [test name, pass/fail status]
```

**If the bug could not be fixed**, report honestly:
- What was tried
- What was learned
- Remaining hypotheses to investigate
- Suggest `/deep-review` if the issue may be architectural

**If the fix revealed related issues**, mention: "Consider running `/generate-tests` to cover similar patterns in the codebase."

## Rules

- NEVER edit code before completing Step 3 (Hypothesize)
- NEVER declare a fix without reproduction evidence (Step 1) and a regression test (Step 6)
- NEVER layer fix attempts — if a fix doesn't work, return to hypothesis, don't add another patch
- If 3 hypotheses fail in sequence, step back and re-read the full module from scratch
- Remove all temporary debug code before reporting
- Match existing code style and test patterns
