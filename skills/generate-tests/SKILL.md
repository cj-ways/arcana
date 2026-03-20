---
name: generate-tests
description: 'Generate unit tests for a file or function. Detects test framework and follows existing patterns. Use when the user asks to write tests, add tests, generate tests, or test a function. Manual via /generate-tests.'
argument-hint: '<file-path> [function-name]'
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# Generate Tests

Generate unit tests for existing code. Detects the test framework, matches existing patterns, and writes practical tests.

## Arguments

- `<file-path>` (required): the source file to generate tests for
- `[function-name]` (optional): specific function or method to test. If omitted, generate tests for all exports.

If no file path is provided, ask the user which file they want tested.

## Auto-Detection

Run these checks before generating anything:

### 1. Language
Detect from file extension: `.ts`/`.js` (JS/TS), `.go` (Go), `.py` (Python), `.rs` (Rust), `.rb` (Ruby).

### 2. Test Framework
Detect from project configuration files:

| Language | Check For | Framework |
|---|---|---|
| JS/TS | `vitest.config.*` or `"vitest"` in package.json | Vitest |
| JS/TS | `jest.config.*` or `"jest"` in package.json | Jest |
| JS/TS | Neither found | Default to Vitest |
| Go | Built-in | `go test` |
| Python | `conftest.py`, `pytest.ini`, `[tool.pytest]` in `pyproject.toml` | pytest |
| Python | None of the above | unittest |
| Rust | Built-in | `#[test]` |

### 3. Existing Test Patterns
Search for existing tests to match their style:
- Look for a sibling file: `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py`
- Look for a `__tests__/` directory in the same module
- If found, read the file and extract: import style, describe/it vs test() structure, assertion style (`expect` vs `assert`), mock/stub patterns, setup/teardown approach

### 4. Test File Location
Match the project convention:
- Co-located: `src/utils.ts` -> `src/utils.test.ts`
- Directory: `src/utils.ts` -> `src/__tests__/utils.test.ts`
- Go convention: `pkg/utils.go` -> `pkg/utils_test.go`
- Python convention: `src/utils.py` -> `tests/test_utils.py` or `src/test_utils.py`

Use whatever pattern already exists in the project. If no tests exist yet, use co-located files.

## Test Generation Strategy

### Step 1: Analyze the Target

Read the source file and extract:
- All exported functions, classes, and methods
- For each: parameter types, return type, side effects, error conditions, dependencies
- If a specific function name was given, focus only on that

**Complexity Assessment (DO NOT SKIP):**
Before generating tests, evaluate each function's complexity:
- **Line count**: Is it over 50 lines?
- **Branch count**: Does it have more than 5 if/else/switch branches?
- **Nesting depth**: Is it nested more than 3 levels deep?
- **Dependency count**: Does it require mocking more than 3 external services?

If a function is too complex (hits 2+ of the above thresholds), flag it:
```
WARNING: `functionName` is too complex to test effectively (52 lines, 7 branches, 4 mocks needed).
Recommendation: Refactor into smaller, focused functions first, then test each.
Suggested decomposition: [brief suggestion of how to split it]
```
Still generate the best tests you can, but make the refactoring suggestion explicit so the user can decide.

### Step 2: Match Existing Style

If existing test files were found in auto-detection:
- Use the EXACT same import style
- Use the EXACT same describe/it or test() structure
- Use the EXACT same assertion library and patterns
- Use the EXACT same mock/setup approach

If no existing tests exist, use the framework's standard minimal style.

### Step 3: Generate Tests

For each function/method, generate:

**Happy path** (always):
- Call with normal, expected inputs
- Assert the expected return value or behavior

**Edge cases** (pick relevant ones):
- Empty input: `""`, `[]`, `{}`
- Null/undefined (for JS/TS)
- Zero, negative numbers
- Boundary values (max int, empty collections, single-element arrays)
- Unicode / special characters if the function handles strings

**Error cases** (when the function can fail):
- Invalid input types
- Out-of-range values
- Assert the correct error type and message

**Async functions** (JS/TS, Python):
- Test successful resolution
- Test rejection/exception path

### Step 4: Test Quality Checklist (verify before presenting)

Before showing tests to the user, review every generated test against this checklist:

- [ ] **Coverage breadth**: Tests cover happy path, edge cases, AND error cases. If only happy path is covered, add error/edge cases before presenting.
- [ ] **Behavior-focused names**: Each test name describes the expected behavior, not the implementation. Good: `"returns empty array when input is empty"`. Bad: `"calls filter method"`.
- [ ] **No environment-dependent values**: No hardcoded ports, file paths, timestamps, or UUIDs that would break on a different machine or CI. Use relative paths, mock dates, and deterministic IDs.
- [ ] **Minimal mocking**: Only mock external services, databases, file system, and network calls. If a utility function can be called directly, call it — do not mock it.
- [ ] **Error paths covered**: Every function that can throw/reject has at least one test for the error case. Check for try/catch blocks, Promise rejections, and error returns.
- [ ] **Independent tests**: No test depends on another test's state. No shared mutable variables. Each test sets up its own data.

If any check fails, fix the generated tests before presenting them.

### Step 5: Present and Write

1. Show the complete test file contents to the user
2. Ask for confirmation before writing
3. On confirmation, write to the detected location
4. Run the tests via Bash:
   - JS/TS (Vitest): `npx vitest run <test-file>`
   - JS/TS (Jest): `npx jest <test-file>`
   - Go: `go test ./<package>/...`
   - Python: `pytest <test-file>` or `python -m pytest <test-file>`
   - Rust: `cargo test`
5. Report pass/fail results

## Rules

- ALWAYS check for existing test files first. If one exists for the target file, extend it — do not replace it.
- ALWAYS match the existing test style in the project. Do not introduce Jest patterns in a Vitest project or vice versa.
- NEVER generate snapshot tests unless the project already uses them.
- NEVER mock things that are easy to test directly. Only mock external services, databases, file system, network calls.
- Prefer testing behavior over implementation details. Test what the function does, not how it does it.
- Each test name should clearly describe what it verifies: `"returns empty array when input is empty"` not `"test1"`.
- Each test must be independent — no shared mutable state between tests.
- If a function is too complex to test in isolation (too many dependencies, deep coupling), note this and suggest what to refactor, but still generate the best tests you can.
- Do not over-test trivial code (simple getters, pass-through functions). Focus on logic.
- Keep generated test files clean — no commented-out code, no TODOs, no placeholder tests.
- Present tests to the user for review BEFORE writing. Do not write without confirmation.

## Common Agent Gotchas

These are frequent mistakes agents make when executing this skill. Avoid them:

1. **Testing implementation instead of behavior (brittle tests).** Do not assert that a specific internal method was called, or that a specific intermediate variable has a value. Test the PUBLIC interface: given input X, expect output Y. If refactoring the internals breaks your tests but the behavior is unchanged, the tests are bad.
2. **Using real API calls instead of mocks (flaky tests).** Never generate tests that hit real HTTP endpoints, real databases, or real file system paths. These will pass locally and fail in CI (or vice versa). Mock all external I/O. If the function makes a fetch call, mock fetch. If it reads a file, mock the file system.
3. **Not matching the existing test file naming convention.** Check what the project already uses before choosing a filename. If existing tests use `*.spec.ts`, do not create `*.test.ts`. If they use `__tests__/` directories, do not create co-located files. Inconsistent naming conventions confuse both humans and CI test runners.
4. **Forgetting to test error paths.** It is easy to generate 10 happy-path tests and zero error tests. Every function that can throw, reject, or return an error MUST have at least one test for that path. Check for try/catch, `.catch()`, error returns, and validation failures.
