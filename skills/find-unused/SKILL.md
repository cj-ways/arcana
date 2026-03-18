---
name: find-unused
description: 'Finds unused exports, dead functions/classes, orphaned files, and dead dependencies across any codebase. Use when the user mentions dead code, unused imports, cleaning up, or asks what can be deleted. Manual via /find-unused.'
argument-hint: '[scope: all|exports|functions|files|deps]'
---

# Find Unused

Scans the codebase for unreachable code, unused exports, orphaned files, and dead dependencies. Works with any language/framework by auto-detecting the project type.

## Arguments

```
/find-unused [scope]
```

Scope (optional):
- `all` (default) — Run all checks
- `exports` — Only check for unused exports
- `functions` — Only check for unused functions/classes
- `files` — Only check for orphaned files
- `deps` — Only check for dead dependencies

If `$ARGUMENTS` is provided, use it as scope filter.

## Project Detection

Before running any checks, detect the project language and framework:

1. Look for manifest files in the project root:
   - `package.json` — Node.js / TypeScript / JavaScript
   - `go.mod` — Go
   - `requirements.txt` / `pyproject.toml` / `setup.py` — Python
   - `Cargo.toml` — Rust
   - `pom.xml` / `build.gradle` — Java / Kotlin
   - `Gemfile` — Ruby
   - `composer.json` — PHP
2. Read the manifest to identify frameworks (e.g., NestJS, Next.js, Django, Flask, Gin, etc.)
3. Determine the source root (e.g., `src/`, `app/`, `lib/`, `cmd/`, `internal/`, or project root)
4. Determine the import style:
   - TS/JS: `import { X } from '...'` or `require('...')`
   - Go: `import "..."` or `import ( "..." )`
   - Python: `import X` or `from X import Y`
   - Rust: `use crate::...` or `use X::...`

Use detected language context to adjust grep patterns in all subsequent checks.

## Detection Categories

### 1. Unused Exports

Symbols exported from a file but never imported by any other file in the codebase.

**Steps:**
1. Find all export declarations:
   - TS/JS: `export class`, `export function`, `export const`, `export enum`, `export interface`, `export type`, `export default`
   - Go: capitalized top-level identifiers (functions, types, vars, consts) in non-`main` packages
   - Python: symbols in `__all__`, or public functions/classes (no `_` prefix) in modules with `__init__.py`
   - Rust: `pub fn`, `pub struct`, `pub enum`, `pub const`, `pub type`
2. For each exported symbol, search for its import/usage across the codebase
3. Exclude: the file itself, barrel/index re-exports, auto-generated files
4. Flag symbols exported but never imported anywhere

**Note:** This is the broadest and slowest check. Use Task agents for parallel searching if the codebase has 1000+ exported symbols.

### 2. Unused Functions / Classes

Functions or classes declared in a file but never referenced outside that file.

**Steps:**
1. Find all top-level function and class declarations (exported or not)
2. For each symbol, grep the entire source tree for references
3. Exclude: the declaring file itself, test files (when checking non-test code)
4. If a symbol is only referenced in its own file, flag it
5. For non-exported symbols: flag as internal dead code
6. For exported symbols that are also unused externally: flag under both this category and "Unused Exports"

**Output:** List of functions/classes with their file paths, whether exported, and reference count.

### 3. Orphaned Files

Files that no other file in the codebase imports or references.

**Steps:**
1. Glob all source files in the project (matching detected language extensions)
2. For each file, derive its possible import paths:
   - TS/JS: strip extension, check for barrel imports via parent `index.ts`
   - Go: check package-level imports
   - Python: check module-level imports
3. Search the codebase for any import/require that resolves to this file
4. Special cases to NOT flag:
   - Entry points (`main.ts`, `main.go`, `main.py`, `__main__.py`, `manage.py`, `app.ts`, `index.ts` at project root)
   - Config files (`*.config.ts`, `*.config.js`, `ormconfig.*`, `settings.py`)
   - Migration files
   - Test files (check separately if requested)
   - Files referenced in build configs, scripts, or manifest files
5. Flag files with zero inbound imports

**Output:** List of orphaned file paths with their directory context.

### 4. Dead Dependencies

Packages listed in the dependency manifest but never imported in source code.

**Steps:**
1. Read the dependency manifest:
   - TS/JS: `package.json` — `dependencies` and `devDependencies`
   - Go: `go.mod` — `require` block
   - Python: `requirements.txt` or `pyproject.toml` `[project.dependencies]`
   - Rust: `Cargo.toml` — `[dependencies]`
2. For each dependency, search for its import in source files:
   - TS/JS: `import ... from '<pkg>'` or `require('<pkg>')`
   - Go: `import "<module-path>"`
   - Python: `import <pkg>` or `from <pkg> import`
   - Rust: `use <crate_name>::` or `extern crate <name>`
3. Special cases to NOT flag:
   - CLI tools / build plugins (e.g., `typescript`, `eslint`, `prettier`, `webpack`, `vite`, `pytest`, `black`, `golangci-lint`)
   - Type packages (e.g., `@types/*` in TS)
   - Peer dependencies
   - Packages referenced in config files or build scripts
4. Flag packages with zero source-level imports

**Output:** List of dead dependencies with which manifest section they appear in.

## Execution Strategy

For `all` scope, run checks in order: deps (fastest) -> files -> functions -> exports (slowest).

For large searches (100+ symbols per category), use Task agents to parallelize:
- Split into batches of ~50 symbols per agent
- Each agent searches for its batch and returns results
- Compile results in the main context

## Risk Classification

For each finding, classify risk:
- **Safe to delete**: Zero references anywhere, clearly dead code
- **Probably dead**: Only referenced in tests, comments, or archived/deprecated code
- **Verify first**: Referenced in exactly 1 place that might itself be dead, or referenced only in config/build files

## Rules

- NEVER delete any code — only report findings
- NEVER modify any files
- Use these tools only: Glob, Grep, Read, Bash (git commands only), Task (for parallelizing)
- Skip common non-source directories: `node_modules/`, `dist/`, `build/`, `coverage/`, `.git/`, `vendor/`, `__pycache__/`, `.venv/`, `venv/`, `target/`, `.next/`, `.nuxt/`
- Skip auto-generated files (e.g., `schema.gql`, `*.generated.*`, `*.g.dart`, `*_gen.go`)
- Adapt grep patterns to the detected project language — do not use TS patterns on Go code

## Output Format

```
## Unused Code Report
**Date:** YYYY-MM-DD
**Project:** <detected language/framework>
**Scope:** all | exports | functions | files | deps

### Summary
| Category            | Checked | Safe to Delete | Probably Dead | Verify First |
|---------------------|---------|----------------|---------------|--------------|
| Unused Exports      | X       | Y              | Z             | W            |
| Unused Functions    | X       | Y              | Z             | W            |
| Orphaned Files      | X       | Y              | Z             | W            |
| Dead Dependencies   | X       | Y              | Z             | W            |

### Findings

#### Unused Exports
| File | Symbol | Type | Risk |
|------|--------|------|------|
| path/to/file.ts | FooService | class | Safe to delete |

#### Unused Functions / Classes
| File | Symbol | Exported | Risk |
|------|--------|----------|------|
| path/to/file.ts | helperFn | No | Safe to delete |

#### Orphaned Files
| File Path | Directory | Risk |
|-----------|-----------|------|
| path/to/orphan.ts | src/utils/ | Verify first |

#### Dead Dependencies
| Package | Manifest Section | Risk |
|---------|-----------------|------|
| lodash  | dependencies    | Safe to delete |
```

Do NOT commit. Present the report for user review.
