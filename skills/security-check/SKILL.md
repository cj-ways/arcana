---
name: security-check
description: 'Quick security scan — hardcoded secrets, common vulnerabilities, dependency issues. Use when the user asks to check security, scan for secrets, or audit for vulnerabilities. Manual via /security-check.'
argument-hint: '[scope: secrets|vulns|deps|all]'
---

# Security Check

Quick security sanity check. Not a full SAST — catches the most common issues fast.

## Argument Parsing

Parse the argument to determine scope:
- `all` (default, also when no argument given): run all three checks
- `secrets`: only scan for hardcoded secrets
- `vulns`: only scan for common vulnerability patterns
- `deps`: only check dependency vulnerabilities

## Detection Categories

### 1. Hardcoded Secrets (scope: `secrets`)

Use the Grep tool to scan for these patterns across the codebase:

- **API keys**: `[A-Za-z0-9_]{20,}` near keywords `key`, `token`, `secret`, `password`, `api_key`
- **AWS keys**: `AKIA[0-9A-Z]{16}`
- **GitHub tokens**: `ghp_`, `gho_`, `ghs_`, `github_pat_`
- **GitLab tokens**: `glpat-`
- **Stripe keys**: `sk_live_`, `sk_test_`
- **JWT secrets**: values assigned to `JWT_SECRET`, `SECRET_KEY`
- **Private keys**: `-----BEGIN (RSA |EC |)PRIVATE KEY-----`
- **Connection strings**: `://user:password@` or `://[^:]+:[^@]+@`

**Skip these paths/files entirely:**
- `.env.example` (template file)
- `*.test.*`, `*.spec.*` (test files — unless the value looks like a real production secret)
- `node_modules/`, `dist/`, `build/`, `.git/`
- Lock files (`package-lock.json`, `yarn.lock`, `go.sum`, `Gemfile.lock`, `poetry.lock`)

### 2. Common Vulnerability Patterns (scope: `vulns`)

Scan with language awareness:

**Any language:**
- `eval()` with variable input (not a static string)
- `exec()` with string concatenation

**JavaScript/TypeScript:**
- `innerHTML =` (XSS)
- `dangerouslySetInnerHTML` (XSS)
- `new Function(` with variable arguments
- `document.write(` (XSS)

**SQL (any language):**
- String interpolation inside SQL queries: `${` near `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WHERE`
- String concatenation with SQL keywords: `"SELECT " +`, `'SELECT ' +`

**Go:**
- `fmt.Sprintf` used to build SQL queries
- `os/exec` with user-controlled input

**Python:**
- `pickle.loads` with untrusted data
- `subprocess` with `shell=True` and variable arguments

**Command injection (any language):**
- `exec()`, `spawn()`, `system()` with string concatenation from user input

### 3. Dependency Vulnerabilities (scope: `deps`)

Auto-detect the project type and run the appropriate audit command via Bash:

| Project Type | Detection File | Audit Command |
|---|---|---|
| Node.js | `package.json` | `npm audit --json` or `yarn audit --json` |
| Go | `go.mod` | `govulncheck ./...` (if installed) or `go list -m -json all` |
| Python | `requirements.txt` / `pyproject.toml` | `pip audit` (if installed) or `safety check` |
| Ruby | `Gemfile` | `bundle audit` |

Parse the output and summarize counts: critical / high / moderate / low.

## Risk Classification

| Level | Examples |
|---|---|
| **CRITICAL** | Hardcoded production secrets (AWS keys, Stripe live keys), SQL injection with user input |
| **HIGH** | `eval` with variables, command injection patterns, critical dependency vulns |
| **MEDIUM** | XSS patterns (`innerHTML`), test secrets that look real, high dependency vulns |
| **LOW** | Deprecated patterns, moderate dependency vulns, informational findings |

When a finding is ambiguous, classify at the LOWER risk level to reduce false positives.

## Output Format

Present results in this format:

```
## Security Check Report
**Date:** YYYY-MM-DD
**Scope:** all | secrets | vulns | deps

### Summary
| Category | Checked | Critical | High | Medium | Low |
|----------|---------|----------|------|--------|-----|
| Secrets  | Y/N     | 0        | 0    | 0      | 0   |
| Vulns    | Y/N     | 0        | 0    | 0      | 0   |
| Deps     | Y/N     | 0        | 0    | 0      | 0   |

### Findings

#### [CRITICAL] Hardcoded AWS Key
- **File:** src/config.ts:42
- **Pattern:** `AKIA****...` (masked)
- **Recommendation:** Move to environment variable, rotate the exposed key immediately.

#### [HIGH] SQL Injection
- **File:** src/db/queries.ts:18
- **Pattern:** String interpolation in SQL query
- **Recommendation:** Use parameterized queries instead.

(... per finding ...)

### No Issues Found
If a category has zero findings, say so explicitly.
```

## Rules

- NEVER modify any files — this is a read-only scan, report only.
- NEVER log or display actual secret values — mask them: show first 4 characters + `****`.
- Skip test files for secret detection unless the value matches a known production pattern (e.g., `AKIA`, `sk_live_`).
- Skip `.env.example` — it is a template.
- Use Grep and Read tools only — no Bash except for dependency audit commands.
- If no issues are found, say so clearly. Do not invent findings.
- Run quickly. This is a sanity check, not a penetration test.
