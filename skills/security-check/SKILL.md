---
name: security-check
description: 'Quick security scan — hardcoded secrets, common vulnerabilities, dependency issues. Use when the user asks to check security, scan for secrets, or audit for vulnerabilities. Manual via /security-check.'
argument-hint: '[scope: secrets|vulns|deps|all]'
allowed-tools: Grep, Read, Glob, Bash
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
- **GitHub tokens**: `ghp_`, `gho_`, `ghs_`, `ghu_`, `gha_`, `github_pat_`
- **GitLab tokens**: `glpat-`, `gldt-`, `glrt-`
- **Slack tokens**: `xoxb-` (bot), `xoxp-` (user), `xapp-` (app-level)
- **Google Cloud / Firebase**: `AIza[0-9A-Za-z_-]{35}`
- **Twilio**: `SK[a-f0-9]{32}`
- **SendGrid**: `SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}`
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

**ORM raw query injection:**
- Sequelize: `sequelize.query()` or `model.query()` with string interpolation
- Django: `.raw()` or `.extra()` with string concatenation
- GORM (Go): `.Raw()` or `.Exec()` with `fmt.Sprintf`

**SSRF (Server-Side Request Forgery):**
- Unvalidated URL construction from user input passed to HTTP clients
- `fetch()`, `axios()`, `http.get()`, `requests.get()` with user-controlled URL parts

**Path traversal:**
- `../` sequences in file operations with user-controlled input
- `path.join()` or `os.path.join()` with user input without sanitization

### 3. Dependency Vulnerabilities (scope: `deps`)

Auto-detect the project type and run the appropriate audit command via Bash:

| Project Type | Detection File | Audit Command |
|---|---|---|
| Node.js | `package.json` | `npm audit --json` or `yarn audit --json` |
| Go | `go.mod` | `govulncheck ./...` (if installed) or `go list -m -json all` |
| Python | `requirements.txt` / `pyproject.toml` | `pip audit` (if installed) or `safety check` |
| Ruby | `Gemfile` | `bundle audit` |

Parse the output and summarize counts: critical / high / moderate / low.

**3b. WebSearch for known CVEs (DO NOT SKIP)**

After running local audit commands, use WebSearch to check for vulnerabilities that local tools may miss:
1. For each direct dependency (not transitive), search: `"[package-name] CVE 2025 2026"`
2. For any dependency flagged by the local audit, search: `"[package-name] vulnerability"` for additional context and remediation guidance
3. Check for recently disclosed vulnerabilities that may not yet be in local advisory databases
4. Report findings with CVE IDs, severity, affected versions, and links to advisories
5. If a dependency has no known CVEs, do not report it — only surface actual findings

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

## Limitations

- This is a grep-based heuristic scan, not a static analysis tool. For deeper analysis, use specialized tools (Semgrep, CodeQL, Snyk, govulncheck).
- Secret detection relies on pattern matching. High-entropy random strings without known prefixes will be missed.
- Vulnerability detection cannot trace data flow across function boundaries. It catches common patterns at the call site only.

## Context-Aware False Positive Guidance

Not all pattern matches are equal. Before reporting a finding, assess its context:

**Severity depends on location:**
- `eval()` in a build script or dev tool → INFO (safe, not user-facing)
- `eval()` in a request handler or user input processing → CRITICAL (exploitable)
- Hardcoded API key in `src/` or `lib/` → CRITICAL (production code)
- Hardcoded API key in `*.test.*` or `*.spec.*` → INFO (test fixture, usually intentional)
- Hardcoded API key in `scripts/` or `tools/` → WARNING (dev tooling, still risky if committed)

**Classify findings into tiers:**
- **CRITICAL**: Actively exploitable in production. Requires immediate action. Examples: real secrets in source, SQL injection in request handlers, eval with user input.
- **WARNING**: Potentially dangerous depending on deployment context. Requires review. Examples: innerHTML in admin-only UI, eval in build scripts, test secrets that look real.
- **INFO**: Informational only, not exploitable in current context. Examples: deprecated patterns, test fixtures, dev-only code paths.

When unsure, classify at WARNING (not CRITICAL) to avoid alarm fatigue, but do not suppress to INFO.

## Common Agent Gotchas

These are frequent mistakes agents make when executing this skill. Avoid them:

1. **Flagging test fixtures as real secrets.** Test files intentionally contain fake API keys, tokens, and passwords for testing. Unless the value matches a known production pattern prefix (`AKIA`, `sk_live_`, `ghp_`), do not flag test file secrets as CRITICAL.
2. **Flagging environment variable NAMES (not values) as leaks.** Code that references `process.env.STRIPE_SECRET_KEY` is reading a variable name, not leaking a secret. Only flag when an actual secret VALUE is hardcoded (e.g., `const key = "sk_live_abc123"`).
3. **Missing secrets in non-standard locations.** Do not only scan `src/` and `.env`. Also check: `.env.local`, `.env.production`, `docker-compose.yml` (environment sections), CI config files (`.github/workflows/*.yml`, `.gitlab-ci.yml`), and `Makefile` / shell scripts.
4. **Not checking sibling projects for shared secrets.** If the project is in a monorepo or shares a parent directory with other projects, secrets from one project may leak into another via shared config files or symlinks. Flag this as a review item if detected.
