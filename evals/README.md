# Arcana Skill Evaluations (Layer 2)

AI-driven tests that verify Arcana's skills actually perform better than a baseline prompt on the same planted task.

## What the Runner Does

Each scenario is a self-contained directory with:
- a planted codebase
- a manifest that defines the task prompt and assertions
- deterministic checks against output and workspace changes

The runner can execute:
- `baseline` — same task prompt without injecting the Arcana skill
- `skill` — same task prompt plus the target Arcana skill body
- `compare` — both modes, paired across repeated runs

Every attempt runs in a fresh temp copy of the scenario. The source scenario is never mutated.

## First-Party Skill Scaffold

`npm run new:skill -- <name> --phase <phase>` now creates:
- `skills/<name>/SKILL.md`
- `evals/scenarios/<name>-primary/manifest.json`
- `evals/scenarios/<name>-primary/README.md`
- `evals/scenarios/<name>-primary/src/example.js`
- `evals/triggers/<name>.json`

The generated scenario is intentionally a stub. Replace the placeholder prompt, assertions, and fixture before treating the skill as release-ready.
The generated trigger pack is intentionally a stub too. Replace it with 10 should-trigger and 10 should-not-trigger queries before treating the skill as release-ready.

Shipped first-party skills are expected to have at least one non-placeholder runnable scenario. The test suite now enforces that coverage.

For advisory, review, release, and recommendation workflows, prefer artifact-backed evals: explicitly tell the model where to write a report, checklist, or memo, then grade the resulting file. Stay output-only only when the skill itself forbids writing files before approval.

If a skill supports runtime effort modes like `auto|low|medium|high` or `auto|low|medium|high|extra`, add:
- one scenario with an explicit requested effort
- one scenario where `auto` should resolve deterministically
- assertions against the resolved effort frame or another stable artifact signal

## Layer 1 Trigger Packs

Arcana stores routing queries under `evals/triggers/<skill>.json`.

Each pack should contain:
- 10 `shouldTrigger` queries
- 10 `shouldNotTrigger` queries
- 6 `train` and 4 `validation` entries in each collection
- a short `reason` per query explaining the routing boundary

The repo currently validates the shape and placeholder status of those packs. Use `node evals/run-trigger-eval.js --skill <name> --run --runs 3` to execute them through the router harness and record actual selection behavior.

## Layer 1 Boundary Suites

Arcana also stores same-topic routing suites under `evals/trigger-boundaries/<suite>.json`.

Use boundary suites when one topic could plausibly route to multiple skills and you want to prove the taxonomy stays clean. The first suite, `feature-taxonomy`, checks that the same feature domain routes differently when the user asks for:
- current-state diagnosis via `feature-audit`
- future-state solution design via `feature-design`
- adversarial challenge of one proposal via `pressure-test`

Run them with:

```bash
npm run eval:boundaries
node evals/run-trigger-boundary.js
node evals/run-trigger-boundary.js --suite feature-taxonomy
node evals/run-trigger-boundary.js --suite feature-taxonomy --run --runs 3
node evals/run-trigger-boundary.js --suite feature-taxonomy --run --set validation
node evals/run-trigger-boundary.js --suite feature-taxonomy --run --topic invite-approvals
```

Artifacts are written to:

```text
evals/trigger-boundary-results/
```

## Feedback Promotion

Repeated user complaints can now become local draft eval packs before they touch the committed fixture set:

- `arcana feedback-triage <skill> --write` stores the triage report in `.arcana/feedback/triage/`
- `arcana feedback-triage <skill> --write-drafts` generates local draft eval packs under `.arcana/feedback/triage/drafts/<skill>/<signal>/`
- review those drafts, replace every `TODO:`, add at least one real fixture file, and then promote them with `arcana feedback-promote <skill> <signal>`

`arcana feedback-promote <skill> <signal>`:
- validates the reviewed draft manifest against the Layer 2 schema
- blocks promotion while placeholders remain
- blocks promotion until a real fixture exists beyond `manifest.json`, `README.md`, and `evidence.md`
- copies the reviewed draft into `evals/scenarios/<scenario-name>/`
- archives the original draft under `.arcana/feedback/triage/promoted/`

## Import Adaptation Verification

Imported skills preserve a raw baseline in `.arcana-import.raw.md`. Arcana can compare that raw baseline against the current adapted skill with static frontmatter, structure, tone, and safety heuristics:

- `npm run eval:imports`
- `node evals/run-import-adaptation.js --fixture legacy-skill`
- `node evals/run-import-adaptation.js --skill some-imported-skill`

The import adaptation harness writes:

```text
evals/import-adaptation/results/latest.json
evals/import-adaptation/results/latest.md
```

## Running Evals

```bash
npm run eval:gate
npm run eval:boundaries
npm run eval:imports
npm run eval:release-summary
npm run eval:scorecards
npm run eval:triggers
node evals/build-release-summary.js
node evals/build-release-summary.js --check
node evals/run-import-adaptation.js
node evals/run-eval.js
node evals/run-trigger-boundary.js
node evals/run-trigger-boundary.js --suite feature-taxonomy --run --runs 3
node evals/run-trigger-eval.js
node evals/run-trigger-eval.js --skill pressure-test
node evals/run-trigger-eval.js --skill pressure-test --run --runs 3
node evals/run-trigger-eval.js --skill pressure-test --run --set validation
node evals/run-eval.js --skill security-check
node evals/run-eval.js --scenario sql-injection-express
node evals/run-eval.js --scenario sql-injection-express --run
node evals/run-eval.js --scenario sql-injection-express --run --runs 3
node evals/run-eval.js --scenario untested-api --run --mode skill
node evals/run-eval.js --run --runs 3 --write-scorecards
node evals/run-eval.js --run --runs 3 --write-scorecards --gate-scorecards
```

Modes:
- `compare` — default, runs baseline and skill attempts
- `skill` — runs only the skill-enabled attempt
- `baseline` — runs only the no-skill baseline

## Scenario Structure

```text
evals/scenarios/<scenario-name>/
  manifest.json
  src/
  tests/
```

### manifest.json (v2)

```json
{
  "name": "sql-injection-express",
  "skill": "security-check",
  "description": "Express API with planted security issues and safe traps",
  "prompt": "Audit this codebase for concrete security issues. Report specific findings with file references and avoid false positives on safe code.",
  "scoring": {
    "weights": {
      "route": 0.2,
      "process": 0.3,
      "outcome": 0.5
    }
  },
  "workdir": "repo",
  "setupCommands": [
    "cp -R ../setup/base/. .",
    "git init"
  ],
  "maxTurns": 10,
  "timeoutMs": 120000,
  "expected": [
    {
      "dimension": "route",
      "id": "report-format",
      "description": "Security report heading is present",
      "type": "output-contains",
      "outputIncludes": [
        "## Security Check Report"
      ]
    },
    {
      "dimension": "process",
      "id": "severity-labels",
      "description": "Audit includes severity labels",
      "type": "output-contains",
      "outputMatchesAny": [
        "/critical/i",
        "/high/i"
      ]
    },
    {
      "dimension": "outcome",
      "id": "sql-inject-raw",
      "description": "Raw SQL with string interpolation in users.js",
      "type": "reported",
      "file": "src/routes/users.js"
    },
    {
      "id": "test-file-created",
      "description": "A test file for orders.js should be created",
      "type": "file-created",
      "file": "tests/orders.test.js"
    },
    {
      "id": "style-match",
      "description": "Generated tests use Vitest imports",
      "type": "file-contains",
      "file": "tests/orders.test.js",
      "contentMatches": [
        "/from ['\\\"]vitest['\\\"]/"
      ]
    }
  ],
  "falsePositives": [
    {
      "dimension": "outcome",
      "id": "fp-parameterized",
      "description": "Parameterized query in posts.js is safe",
      "type": "reported",
      "file": "src/routes/posts.js"
    },
    {
      "id": "fp-no-rewrite-existing",
      "description": "Should not modify an existing test file",
      "type": "file-unchanged",
      "file": "tests/users.test.js"
    }
  ]
}
```

### Scoring Dimensions

Every v2 assertion should declare one dimension:
- `route` — did the skill choose the right workflow or output frame for the task?
- `process` — did it follow the intended method, structure, or intermediate checks?
- `outcome` — did it actually find, change, or produce the correct result?

Every shipped first-party scenario now covers all three dimensions.

### Assertion Types

`reported`
- default type
- passes when the output mentions the finding
- uses `outputIncludes` / `outputMatches` when provided
- otherwise falls back to file path, description, or id indicators

`output-contains`
- explicit output rule set
- supports `outputIncludes`, `outputIncludesAny`, `outputMatches`, `outputMatchesAny`
- also supports `outputExcludes` and `outputExcludeMatches`

`reported-context`
- anchors on a required file reference and then grades the surrounding text window
- useful when the skill should emit a structured report with severity, `file:line`, or issue-type evidence near each finding
- supports `contextIncludes`, `contextIncludesAny`, `contextMatches`, `contextMatchesAny`
- also supports `contextExcludes`, `contextExcludeMatches`, and optional `contextWindow`

`file-created`
- passes when the file exists after the run and did not exist before it

`file-contains`
- inspects the resulting file content
- supports `contentIncludes`, `contentIncludesAny`, `contentMatches`, `contentMatchesAny`
- also supports `contentExcludes`, `contentExcludeMatches`, and `mustBeModified`

`file-unchanged`
- passes only when the file content is identical before and after the run

`workspace-clean`
- passes only when the scenario workspace has no created, modified, or deleted files after the run
- useful for read-only reviews, audits, and pre-approval planning workflows

## Evidence Style Guidance

Prefer the strongest deterministic evidence the workflow allows:
- For report-style skills, tell the model exactly which artifact to write, then assert on that file with `file-created` and `file-contains`.
- Add at least one immutability trap with `file-unchanged` when the skill should analyze or summarize without editing source files.
- For fully read-only workflows, add `workspace-clean` so the eval fails if the model creates or edits files anyway.
- Keep output-only assertions for workflows like pre-approval planning when the skill explicitly should not write files yet.

### Scenario Execution Fields

`workdir`
- optional
- runs the model and file assertions relative to a nested project directory such as `repo/`
- useful when the scenario also stores setup assets outside the project root

`setupCommands`
- optional array of shell commands
- runs before the model starts and before the initial snapshot is taken
- useful for creating git history, copying a base fixture into place, or preparing a repo-shaped workspace
- commands run inside the resolved `workdir`

`scoring.weights`
- optional, but required for shipped first-party scenarios
- controls the weighted overall score across `route`, `process`, and `outcome`
- defaults to `route 0.2`, `process 0.3`, `outcome 0.5`

## Grading

Each attempt produces:
- `detectionRate` — fraction of expected assertions that passed
- `falsePositiveRate` — fraction of false-positive traps that were incorrectly triggered
- `aggregateScore` — legacy flat score: `detectionRate - falsePositiveRate`
- `dimensions.route|process|outcome` — per-dimension detection, false-positive, and score breakdowns
- `score` — weighted dimension score used for compare mode
- `grade`

Grades:
- `PASS` — every active dimension scores `1.0`
- `PARTIAL` — weighted score at least `0.75` and no active dimension below `0.5`
- `FAIL` — anything worse
- `ERROR` — the model invocation failed

In `compare` mode the report also stores:
- baseline averages
- skill averages
- detection delta
- false-positive delta
- score delta
- route / process / outcome score deltas
- paired wins / losses / ties

## Result Artifacts

Every run writes a directory under `evals/results/`:

```text
evals/results/<scenario>_<timestamp>/
  report.json
  baseline-run1.txt
  skill-run1.txt
  ...
```

The `report.json` file contains the attempt summaries, deltas, and per-run workspace diffs.

When `--write-scorecards` is used, the runner also updates:

```text
evals/scorecards/<skill>.json
evals/scorecards/index.json
```

Scorecards are only written when a skill's run is complete across all of its scenarios and every scenario ran in `compare` mode. Partial runs and skill-only runs are skipped instead of overwriting the stored baseline.

When `--gate-scorecards` is added, the runner compares each newly generated scorecard against the previously stored one before writing. Regressed scorecards are blocked, the old baseline is preserved on disk, and the command exits non-zero. By default the gate allows up to `0.05` average score-delta drop and `0.05` per-dimension drop; override with `--max-scorecard-regression <n>` and `--max-dimension-regression <n>`.

## Release Quality Summary

`node evals/build-release-summary.js` writes:

```text
evals/release-quality/latest.json
evals/release-quality/latest.md
```

The summary condenses:
- stored skill scorecards
- latest trigger-run reports
- local feedback-triage candidate counts and draft-pack counts

With `--check`, the command exits non-zero when release evidence is missing or stale.

## Notes

- Non-deterministic — use `--runs 3` or more for meaningful comparisons
- Expensive — each attempt invokes Claude Code
- Manual invocation only — not in CI yet
- `ARCANA_EVAL_CLAUDE_BIN` can override the `claude` executable path when needed
