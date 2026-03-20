---
name: deploy-prep
description: 'Analyzes branch diff to generate deploy checklists — env vars, migrations, new services, dependencies, schema changes, breaking changes. Works across any tech stack. Manual via /deploy-prep [source] [target].'
argument-hint: '[source-branch] [target-branch]'
effort: medium
---

# Deploy Prep

Analyzes the diff between two branches and produces actionable pre-release and post-release checklists. Auto-detects the project's tech stack and scans for env variables, migrations, DB schema changes, new services, dependency changes, API schema changes, and infrastructure requirements.

## Arguments

```
/deploy-prep [source-branch] [target-branch]
```

- `source-branch`: Branch being released (default: auto-detect default branch via `git symbolic-ref refs/remotes/origin/HEAD`, or fall back to `dev`/`develop`/`main`)
- `target-branch`: Branch being released into (default: `main` or `master`, whichever exists)

If `$ARGUMENTS` is provided, parse as `<source> <target>`. If only one argument, treat as source with `main`/`master` as target.

## Steps

### Step 1: Validate branches, detect stack, and collect diff

1. Fetch latest refs: `git fetch origin`
2. Verify both branches exist: `git rev-parse --verify origin/<branch>`
3. **Detect project stack** by checking for key files in the repo root:
   - `package.json` → Node.js (then check for NestJS, Next.js, Express, etc.)
   - `go.mod` → Go
   - `requirements.txt` / `pyproject.toml` / `setup.py` → Python
   - `Gemfile` → Ruby/Rails
   - `Cargo.toml` → Rust
   - `pom.xml` / `build.gradle` → Java/Kotlin
   - `composer.json` → PHP
   - Store detected stack for use in subsequent steps
4. Get commit range: `git log --oneline origin/<target>..origin/<source>`
5. Count commits and list affected authors: `git log --format='%an' origin/<target>..origin/<source> | sort -u`
6. Get full file change summary: `git diff --stat origin/<target>...origin/<source>`
7. Get changed files list: `git diff --name-only origin/<target>...origin/<source>`

Store the changed files list — all subsequent detection steps filter from this list.

### Step 2: Detect environment variable changes

**Goal:** Find new environment variable references that don't exist on the target branch.

**Detection patterns by stack:**

| Stack | Pattern |
|-------|---------|
| Node.js | `process.env.VAR_NAME`, `process.env['VAR_NAME']` |
| Go | `os.Getenv("VAR_NAME")`, `os.LookupEnv("VAR_NAME")` |
| Python | `os.environ`, `os.getenv`, `config("VAR_NAME")`, Django/Flask settings |
| Ruby | `ENV["VAR_NAME"]`, `ENV.fetch("VAR_NAME")` |
| Rust | `std::env::var("VAR_NAME")`, `env::var("VAR_NAME")` |
| Any | `.env` file diffs, `.env.example` diffs, `docker-compose*.yml` env sections |

**Process:**
1. From changed files, grep for env var patterns (matching detected stack) in the source branch versions
2. Compare against the same grep on the target branch
3. Net-new env vars = present in source but absent in target
4. Also check for removed env vars (present in target, absent in source)
5. Check config files (`.env.example`, `docker-compose*.yml`, config modules) if changed

**Output per finding:**
- Variable name
- File(s) where it's used
- Whether it has a default/fallback value
- Whether it's required at boot (used in startup/init code or config validation)

### Step 3: Detect database changes

**3a. Migrations — detect by framework:**

| Framework | Migration path pattern |
|-----------|----------------------|
| TypeORM | `**/migrations/*.ts` |
| Drizzle | `**/drizzle/*.sql`, `drizzle/` directory |
| Prisma | `prisma/migrations/` |
| Atlas | `**/migrations/*.sql`, `atlas.hcl` |
| Alembic | `alembic/versions/*.py` |
| Rails | `db/migrate/*.rb` |
| Knex | `**/migrations/*.js`, `**/migrations/*.ts` |
| Django | `**/migrations/*.py` |
| Sequelize | `**/migrations/*.js` |
| Go (golang-migrate) | `**/migrations/*.sql` |
| Flyway | `**/db/migration/*.sql` |
| Any | Files matching `*migration*` in changed files list |

For each new migration file found:
- Read the file to extract: tables created/altered/dropped, columns added/removed, indexes, data migrations
- Determine if migration is reversible (has a `down`/`revert` method or rollback SQL)

**3b. Schema/model changes:**
1. Filter changed files for entity/model/schema patterns:
   - `*.entity.ts`, `*.model.ts`, `*.model.py`, `*.rb` (ActiveRecord models), `schema.prisma`, `*.go` (struct definitions with DB tags)
2. For each changed schema file, diff to identify: new fields, type changes, index changes, nullable changes, default value changes

**3c. Potential migration gaps:**
1. If model/entity files changed but NO new migration file exists, flag as warning
2. If migration references tables not matching any model change, flag for review

### Step 4: Detect new services and entry points

1. Look for new entry point files in the changed files list:
   - `**/main.ts`, `**/main.go`, `**/main.py`, `**/cmd/*/main.go`
   - New `Dockerfile*` files
   - New directories with their own `package.json` (monorepo packages)
   - New serverless function definitions
2. For new services, identify:
   - Service type (API, worker, cron, webhook handler)
   - Port or trigger configuration needed
   - Required infrastructure dependencies
3. Check if CI/CD configs were modified with new build/deploy targets
4. For webhook-type services, check if external callback URL configuration is needed

### Step 5: Detect dependency changes

**Detection by package manager:**

| File | Package Manager |
|------|----------------|
| `package.json` | npm/yarn/pnpm |
| `go.mod` | Go modules |
| `requirements.txt` / `pyproject.toml` | pip/poetry |
| `Gemfile` | bundler |
| `Cargo.toml` | cargo |
| `pom.xml` / `build.gradle` | Maven/Gradle |
| `composer.json` | Composer |

**Process:**
1. Diff the relevant dependency file for:
   - New dependencies added (with versions)
   - Dependencies removed
   - Version bumps (major vs minor vs patch)
   - New dev dependencies
2. If lockfile changed, note it (`yarn.lock`, `package-lock.json`, `go.sum`, `Gemfile.lock`, `Cargo.lock`, `poetry.lock`, etc.)
3. Flag any major version bumps as requiring extra attention
4. Flag any new native/binary dependencies (may need Docker image rebuild or system packages)

### Step 6: Detect API schema changes

**Detection by schema type:**

| Schema Type | File Patterns |
|-------------|--------------|
| GraphQL | `*.gql`, `*.graphql`, `schema.gql` |
| Protobuf | `*.proto` |
| OpenAPI/Swagger | `openapi.yaml`, `openapi.json`, `swagger.yaml`, `swagger.json`, `**/api-spec.*` |
| gRPC | `*.proto` + service definitions |
| tRPC | `*.router.ts`, `*.procedure.ts` |

**Process:**
1. Check if any schema files were modified in the changed files list
2. If so, summarize:
   - New endpoints/queries/mutations/RPCs added
   - Fields or endpoints removed (BREAKING for clients)
   - Type changes (BREAKING for clients)
   - New input types / enums registered
3. Flag any removals or type changes as breaking changes requiring client coordination

### Step 7: Detect infrastructure and config changes

1. Check for changes in:
   - `Dockerfile*`, `docker-compose*.yml`
   - CI/CD files: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`, `bitbucket-pipelines.yml`, `.travis.yml`
   - Build configs: `tsconfig*.json`, `webpack.config.*`, `vite.config.*`, `Makefile`, `justfile`
   - Deployment configs: `k8s/`, `helm/`, `terraform/`, `ansible/`, `serverless.yml`, `fly.toml`, `render.yaml`, `vercel.json`, `netlify.toml`
   - ORM/DB configs: `ormconfig.*`, `prisma/schema.prisma`, `drizzle.config.*`, `knexfile.*`, `alembic.ini`
2. Check for new external service integrations (new HTTP clients, SDK imports, third-party API calls)
3. Check for new message queue topics/subjects/channels (Kafka, RabbitMQ, NATS, SQS, Redis pub/sub, BullMQ)
4. Check for new cron/scheduler definitions

### Step 8: Detect feature flags and toggles

1. Grep changed files for common feature flag patterns:
   - `isFeatureEnabled`, `featureFlag`, `FEATURE_`, `ENABLE_`, `FF_`
   - LaunchDarkly, Unleash, Flagsmith, or other feature flag SDK usage
   - Settings/config table references for runtime toggles
   - Conditional logic gated on environment or config values
2. List any new feature flags that need to be configured

### Step 9: Assess risk areas

For each major area of change, classify:
- **Critical** — Must be done before deploy or service will break (migrations, required env vars, new service ports, breaking schema changes)
- **Important** — Should be done around deploy time (cache invalidation, cron schedule updates, webhook URL config, dependency installs)
- **Post-deploy** — Can be done after successful deploy (monitoring setup, cleanup, documentation, non-breaking flag toggles)

## Checklist Generation

Based on all findings above, generate two checklists:

### Pre-Release Checklist Template

```
## Pre-Release Checklist
**Release:** origin/<source> -> origin/<target>
**Date:** YYYY-MM-DD
**Commits:** N commits by [authors]

### Environment Variables
- [ ] `VAR_NAME` — Add to [environments] — Used in [files] — [Required at boot / Has fallback]
  ...

### Database
- [ ] Review migration: `MigrationName` — [Tables affected] — [Reversible: Yes/No]
- [ ] Backup database before migration (if destructive changes detected)
- [ ] Run migrations: `<framework-specific command>`
  ...

### Dependencies
- [ ] Run `<install-command>` on deploy servers
- [ ] [Major bump] Review `package-name` vX->vY changelog for breaking changes
  ...

### New Services / Entry Points
- [ ] Configure port / trigger for `<service-name>`
- [ ] Add to deployment pipeline / process manager
- [ ] Configure health check endpoint
- [ ] [Webhook] Register callback URL with external provider
  ...

### API Schema
- [ ] [BREAKING] Removed field/endpoint `<name>` — Coordinate with clients
- [ ] Verify client compatibility with schema changes
  ...

### Infrastructure
- [ ] [CI/CD change] Review pipeline modifications
- [ ] [Docker change] Rebuild and push images
- [ ] [New queue/topic] Create and configure: `<name>`
- [ ] [Deployment config] Review and apply changes
  ...

### Feature Flags
- [ ] Set `FLAG_NAME` = [value] in [environment]
  ...

### General
- [ ] Code review completed
- [ ] All CI checks passing on source branch
- [ ] Test critical flows on staging
- [ ] Notify team of deployment window
```

### Post-Release Checklist Template

```
## Post-Release Checklist

### Verification
- [ ] Health check endpoints responding for all services
- [ ] Verify new migrations applied successfully
- [ ] Smoke test critical flows: [list based on changed areas]
  ...

### Monitoring
- [ ] Check error tracking (Sentry, Datadog, etc.) for new errors (15 min window)
- [ ] Check logs for error spikes
- [ ] Verify scheduled jobs executing on schedule (if new/modified)
- [ ] Monitor queue processing rates (if new/modified workers)
  ...

### Cleanup
- [ ] Remove old feature flags (if any were sunset)
- [ ] Update API documentation (if schema changed)
- [ ] Notify stakeholders of completed release
- [ ] Tag release: `git tag vX.Y.Z`
  ...

### Rollback Plan
- [ ] Migration reversible: `<revert-command>` [N times]
- [ ] Previous container image tagged and available
- [ ] Environment variables backward-compatible: [Yes/No — details]
```

## Execution Strategy

Run Steps 2-8 in parallel using Task agents for speed:
- **Agent 1**: Env vars + feature flags (Steps 2, 8)
- **Agent 2**: Database changes (Step 3)
- **Agent 3**: New services + dependencies + infrastructure (Steps 4, 5, 7)
- **Agent 4**: API schema changes (Step 6)

Compile all findings in main context, then run Step 9 (risk assessment) and generate checklists.

### Step 10: Risk Prioritization

After compiling all findings, assign a **Risk Priority** to every checklist item:

| Priority | Criteria | Examples |
|----------|----------|----------|
| **CRITICAL** | Deploy will break or cause data loss without this | Breaking API changes, DB migrations with destructive ops, new required env vars with no fallback, new service ports not configured |
| **HIGH** | Deploy will partially fail or degrade without this | New services needing health checks, schema changes affecting queries, major dependency version bumps |
| **MEDIUM** | Deploy succeeds but with debt or minor issues | Dependency updates, config file changes, non-breaking schema additions, CI/CD tweaks |
| **LOW** | Can be done anytime after deploy | Documentation updates, minor refactors, cleanup of old feature flags, non-critical monitoring |

Tag each checklist item with its priority: `[CRITICAL]`, `[HIGH]`, `[MEDIUM]`, `[LOW]`.
Sort checklists by priority (CRITICAL first, LOW last) so the most important items are at the top.

### Step 11: User Confirmation Before Output

Before outputting the final checklists, present a summary for review:

```
## Deploy Prep Summary
Found N total checklist items:
- CRITICAL: X items (must be done before deploy)
- HIGH: Y items (should be done around deploy time)
- MEDIUM: Z items (can be done shortly after)
- LOW: W items (can be done anytime)

Shall I generate the full checklists? Any categories you want me to focus on or skip?
```

Wait for user confirmation before generating the detailed Pre-Release and Post-Release checklists. This avoids overwhelming the user with a 200-line checklist when they may only care about CRITICAL items.

## Rules

- NEVER modify any files — this is a read-only analysis skill
- NEVER run migrations or any destructive commands
- ALWAYS fetch latest before comparing (`git fetch origin`)
- Use these tools only: Bash (git commands, grep, file reads), Read, Glob, Grep, Task (for parallelizing)
- Skip build output directories (`node_modules/`, `dist/`, `build/`, `target/`, `__pycache__/`, `.git/`, `vendor/`, `coverage/`, `*.min.js`, `*.bundle.js`)
- Skip auto-generated schema files when analyzing code logic, but DO read them for API schema change detection
- If diff is extremely large (500+ files), ask user whether to run full analysis or focus on specific categories
- ALWAYS show commit count and list of authors at the top of the report

## Output

Present the report in this structure:

```
## Release Analysis Report
**Source:** origin/<source> (commit SHA)
**Target:** origin/<target> (commit SHA)
**Date:** YYYY-MM-DD
**Commits:** N commits
**Authors:** [list]
**Files changed:** N
**Detected stack:** [language/framework]

### Risk Summary
| Category | Findings | Risk Level |
|----------|----------|------------|
| Env Vars | N new, M removed | Critical/None |
| Migrations | N new | Critical/None |
| Schema/Model Changes | N files | Important/None |
| New Services | N services | Critical/None |
| Dependencies | N added, M bumped | Important/None |
| API Breaking Changes | N breaking changes | Critical/None |
| Infrastructure | N changes | Important/None |
| Feature Flags | N new flags | Important/None |

### Detailed Findings
[Expandable sections per category with full details]

### Pre-Release Checklist
[Generated checklist with all items as empty checkboxes]

### Post-Release Checklist
[Generated checklist with all items as empty checkboxes]
```

Do NOT commit or modify anything. Present the full report for user review.

## Common Agent Gotchas

These are frequent mistakes agents make when executing this skill. Avoid them:

1. **Missing env vars referenced indirectly.** Not all env vars appear as literal `process.env.VAR_NAME`. Look for spread operators (`...process.env`), dynamic key access (`process.env[key]`), config wrappers that read env vars internally (e.g., `config.get('DATABASE_URL')` where the config module reads from `process.env`), and `.env` file parsing libraries. Grep for the env var pattern AND read config/settings modules to catch indirect references.
2. **Not detecting renamed env vars.** If an old env var is removed and a new one is added (e.g., `DB_URL` replaced by `DATABASE_URL`), this is a migration that requires coordination: the old var must stay during rollout, the new var must be set, and the old one removed after full deploy. Flag renamed env vars explicitly.
3. **Database migrations that need to run BEFORE vs AFTER deployment.** Additive migrations (new tables, new nullable columns) are safe to run before deploy. Destructive migrations (drop column, rename table, change type) must be coordinated: deploy code that handles both old and new schema first, then run migration, then remove old-schema code. Flag migration timing explicitly.
4. **Ignoring feature flags that gate the new code.** If new code is behind a feature flag that defaults to OFF, the deployment is safe even without running migrations or setting new env vars immediately. Check for feature flag gates and note when they make a deploy item lower priority than it appears.
