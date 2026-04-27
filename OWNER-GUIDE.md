# Arcana Owner Guide

Internal maintainer manual for Arcana.

This document is written for the project owner, not for end users. Its job is to explain what Arcana is, why it exists, how it is structured, how skills are maintained, how quality is enforced, and how to decide what to build next.

If you read this guide end to end, you should be able to understand the project without already knowing the codebase or the maintenance workflow.

## How To Read This Guide

If you are completely new:

1. Read Sections 1 through 5 first.
2. Then read Sections 6 through 10 to understand maintenance and quality operations.
3. Read Sections 11 through 14 last for release operations, strategy, and decision-making.

If you only need the short version:

1. Arcana is a curated skill toolkit for Claude Code and Codex CLI.
2. The real product is mostly the markdown skills, not the JavaScript runtime.
3. The CLI exists to install, sync, inspect, import, and quality-control those skills.
4. The project wins on measured quality, trust, and low drift, not on having the largest catalog.
5. Every meaningful product change should improve one of these: skill quality, import safety, maintenance clarity, or evidence for releases.

## 1. Arcana In Plain English

Arcana is a developer workflow skill system.

It gives coding agents high-quality, task-specific instructions for real software work such as:

- planning a project
- auditing a feature
- generating tests
- debugging hard issues
- doing safe refactors
- reviewing code
- preparing releases

Arcana is not trying to be a generic AI assistant, a giant skill marketplace, or a universal agent manager.

It is a focused toolkit with four layers:

1. First-party content.
   This is the core value: shipped skills, thin agent wrappers, and quality rules.
2. A thin CLI runtime.
   This handles install, sync, update, import, inspection, feedback, and quality workflows.
3. A quality system.
   This includes trigger packs, eval scenarios, scorecards, regression gates, feedback triage, import adaptation checks, and release summaries.
4. A trust model.
   This keeps first-party skills, imported skills, local edits, and host-specific behavior clearly separated.

## 2. Why Arcana Exists

Arcana exists because the broader skills ecosystem is noisy.

The basic problem the project is solving is:

- there are many public skills
- most are low-quality, vague, unsafe, or hard to trust
- more skills does not automatically mean better agent performance
- skill systems drift easily because content, code, docs, and metadata go out of sync

Arcana’s response is opinionated:

- keep the first-party catalog small and curated
- write shipped skills manually
- make changes measurable through evals
- make imports traceable through provenance and trust state
- keep docs and generated surfaces aligned with code

The project thesis is:

Arcana should compete on measured quality, trust, and portability, not on raw catalog size.

That thesis should drive almost every product decision.

## 3. The Mental Model You Need

If you remember only one mental model, use this one:

Arcana is a content product with an operations layer around it.

The content product:

- `skills/*/SKILL.md`
- `agents/*.md`
- `rules/*.md`

The operations layer:

- install and sync commands
- import governance
- feedback capture
- eval runners
- release summaries

That means:

- when a skill behaves badly, the fix is often in the skill text or its evals, not in the CLI
- when the install/update/import flow behaves badly, the fix is in `src/commands` or `src/utils`
- when user trust is weak, the fix is usually better provenance, better docs, or better evidence, not more features

### Core Terms

| Term | Meaning | Why it matters |
| --- | --- | --- |
| Skill | A markdown instruction unit in `skills/<name>/SKILL.md` | This is the primary product surface |
| Agent | A thin wrapper file that points at a skill workflow | Useful for host-native agent directories, but not the main value |
| Rule | A persistent behavior guideline installed into the host | Optional quality boost around the skills |
| Import | Bringing an outside skill into a local install scope | Convenience layer, not trust transfer |
| Trigger pack | Layer 1 routing queries under `evals/triggers/` | Measures whether the right skill activates |
| Eval scenario | Layer 2 benchmark under `evals/scenarios/` | Measures whether the skill actually improves outcomes |
| Scorecard | Per-skill aggregated compare-mode eval artifact | Release evidence for “did this get better?” |
| Feedback entry | A local rating/reason record for a skill | Raw post-use signal |
| Feedback draft | A local draft eval pack derived from repeated complaints | Bridge from user complaints to new benchmarks |
| Release summary | A condensed local artifact over scorecards, trigger runs, and feedback-derived cases | Operator-facing release readiness signal |

## 4. What Arcana Actually Ships

The live inventory changes over time. The authoritative current list is in:

- [README.md](README.md)
- [CLAUDE.md](CLAUDE.md)

This guide explains the structure, not just the current counts.

Arcana ships four kinds of user-visible things:

1. Workflow skills.
   These map to the development lifecycle: plan, analyze, design, implement, test, fix, refactor, review, and release.
2. Utility skills.
   These are useful any time and are not tied to one lifecycle phase.
3. Agent wrappers.
   These are thin host-facing wrappers around skill workflows.
4. Quality rules.
   These are optional behavior rules that strengthen agent behavior outside any single skill invocation.

The project also ships support infrastructure:

- the `arcana` CLI
- plugin metadata for Claude’s plugin marketplace
- migrations for renamed or removed skills
- tests and eval infrastructure

## 5. Where Everything Lives

This is the repo map that matters in practice.

| Path | What lives there | Edit directly? | Notes |
| --- | --- | --- | --- |
| `skills/` | First-party skill definitions | Yes | Main product surface |
| `agents/` | Thin agent wrapper files | Yes | Secondary surface |
| `rules/` | Optional quality rules | Yes | Persistent behavior guidance |
| `src/commands/` | CLI command implementations | Yes | User-facing runtime behavior |
| `src/utils/` | Shared logic, catalog, parsing, feedback, release summaries | Yes | Internal architecture |
| `bin/arcana.js` | CLI entrypoint and command wiring | Yes | Public command surface |
| `evals/scenarios/` | Layer 2 benchmark scenarios | Yes | Outcome measurement |
| `evals/triggers/` | Layer 1 routing packs | Yes | Trigger measurement |
| `evals/run-eval.js` | Layer 2 runner | Yes | Compare baseline vs skill |
| `evals/run-trigger-eval.js` | Layer 1 runner | Yes | Routing measurement |
| `evals/run-import-adaptation.js` | Imported-skill adaptation evaluator | Yes | Imported-skill quality evidence |
| `evals/build-release-summary.js` | Release summary generator | Yes | Release readiness artifact |
| `tests/` | Unit and command coverage | Yes | Drift and regression guardrails |
| `scripts/` | Release, scaffold, and docs-sync scripts | Yes | Maintenance tools |
| `docs/features/arcana-cli/` | Feature-level docs, boundaries, roadmap | Yes | Manual product docs |
| `README.md` | Public-facing project entrypoint | Yes, partly | Some sections are generated |
| `CLAUDE.md` | Project intelligence for coding agents | Yes, partly | Useful internal summary |
| `SKILL-AUTHORING-REFERENCE.md` | Evidence-backed authoring standard | Yes | Core maintainer reference |

### Important Local Artifact Directories

These are important for operations, but they are not source-of-truth product files:

| Path | What it is |
| --- | --- |
| `.arcana/feedback/` | Local feedback state |
| `.arcana/feedback/triage/` | Local feedback triage reports |
| `.arcana/feedback/triage/drafts/` | Draft eval packs from repeated complaints |
| `.arcana/feedback/triage/promoted/` | Archive of promoted drafts |
| `evals/results/` | Layer 2 run outputs |
| `evals/trigger-results/` | Layer 1 run outputs |
| `evals/import-adaptation/results/` | Import adaptation summaries |
| `evals/release-quality/` | Release readiness summaries |

These are generated working artifacts. They help operations. They are not the product itself.

## 6. Source Of Truth Rules

Arcana stays healthy because it keeps one source of truth per fact whenever possible.

### The Main Source Of Truths

| Fact | Source of truth |
| --- | --- |
| What a first-party skill does | `skills/<name>/SKILL.md` |
| Skill phase, feedback profile, order | Skill frontmatter |
| What public CLI commands exist | `src/utils/command-manifest.js` |
| What utility modules exist and how docs describe them | `src/utils/catalog.js` |
| Current generated inventory tables | Generated sections in `README.md`, `CLAUDE.md`, and `docs/features/arcana-cli/overview.md` |
| Whether a skill routes correctly | Trigger packs + trigger runner |
| Whether a skill improves outcomes | Eval scenarios + scorecards |
| Whether an imported skill is trustworthy | Import metadata + trust state + raw baseline |

### Generated Content Discipline

Some docs are partly generated. That means:

- do not hand-edit generated sections unless you also change the real source behind them
- after changing the catalog or command manifest, run `npm run generate:docs`
- `npm run verify:drift` will fail if generated docs are stale

### Practical Rule

If you are about to copy the same fact into multiple places manually, stop and decide which file should own that fact.

## 7. What The CLI Does

The CLI is intentionally thin. It is there to operate the content system.

Its command families are:

### Install and manage

- `init`
- `add`
- `remove`
- `list`
- `sync`
- `update`
- `use`

These commands handle installation, mirroring, inspection, and package refresh.

### Import and trust

- `import`
- `info`
- `doctor`

These commands handle external skills, provenance, trust state, and install health.

### Feedback and quality operations

- `feedback`
- `feedback-report`
- `feedback-triage`
- `feedback-promote`
- `feedback-hooks`

These commands connect post-use feedback to future skill improvement.

### Who uses what

End users mostly use:

- `init`
- `add`
- `list`
- `import`
- `use`

Maintainers and operators use:

- `doctor`
- `feedback-report`
- `feedback-triage`
- `feedback-promote`
- `eval` scripts
- release summary scripts

## 8. Host Model: Claude, Codex, And Multi-Agent

Arcana supports two real hosts:

- Claude Code
- Codex CLI

And one operating mode:

- multi-agent mode

### Why Multi-Agent Exists

Multi-agent mode exists so one canonical skill set can serve both hosts.

The rule is:

- `.agents/skills/` is the canonical source in multi-agent mode
- `.claude/skills/` is the mirror
- `arcana sync` keeps the mirror current

This matters because it prevents parallel edits across host-specific folders.

### Important Limitation

Feature support is not symmetric across hosts.

Core CLI support is shared.

Deeper automation is not.

Examples:

- manual feedback capture works in both
- automatic in-session feedback prompts are Claude Code only
- live eval runners currently shell out to Claude CLI, so Codex parity is not yet there

That asymmetry is intentional and must stay explicit in docs.

## 9. How A First-Party Skill Is Created

This is the core maintainer workflow.

### Step 1: Decide Whether A New Skill Is Actually Needed

Do not start by asking “can we add another skill?”

Start by asking:

- is this a reusable workflow, not just a one-off prompt?
- is it meaningfully different from existing skills?
- does it fit Arcana’s thesis of measured quality and trust?
- can we evaluate it?
- is the failure mode better solved by improving an existing skill instead?

If the answer to those questions is weak, do not add a new skill.

### Step 2: Choose The Right Phase And Feedback Profile

Every first-party skill needs:

- `phase`
- `feedback-profile`
- `catalog-order`

The phase is lifecycle placement:

- `plan`
- `analyze`
- `design`
- `test`
- `fix`
- `refactor`
- `review`
- `release`
- `utility`

The feedback profile determines what kinds of user complaints Arcana expects and triages for that skill:

- `diagnostic`
- `execution`
- `advisory`
- `general`

### Step 3: Scaffold It

Use the scaffold. Do not copy an old skill by hand.

```bash
npm run new:skill -- my-skill --phase review --feedback-profile diagnostic --summary "One-sentence summary."
```

The scaffold creates:

- `skills/<name>/SKILL.md`
- `evals/scenarios/<name>-primary/`
- `evals/triggers/<name>.json`

### Step 4: Write The Skill

The main writing rules are in [SKILL-AUTHORING-REFERENCE.md](SKILL-AUTHORING-REFERENCE.md).

The short version:

- description is third person and carries trigger burden
- body is third-person imperative
- gotchas go near the top
- `allowed-tools` must match actual behavior
- the skill should stay focused and operational, not bloated

### Step 5: Replace The Trigger Pack Stub

Each first-party skill needs a Layer 1 trigger pack.

That pack should define:

- 10 should-trigger queries
- 10 should-not-trigger queries
- 6 train and 4 validation entries per side

This answers:

“Does the system choose this skill when it should, and avoid it when it should not?”

### Step 6: Replace The Eval Scenario Stub

Each first-party skill needs at least one real Layer 2 scenario.

That scenario should:

- compare `baseline` vs `skill`
- include `route`, `process`, and `outcome` coverage
- use deterministic assertions
- include at least one real fixture file
- avoid placeholder text

### Step 7: Run Verification

Typical maintainer flow:

```bash
npm test
npm run eval:triggers -- --skill my-skill
node evals/run-eval.js --skill my-skill --run --runs 3
npm run eval:gate
```

### Step 8: Sync Docs

If the new skill affects generated docs:

```bash
npm run generate:docs
```

### Step 9: Ship Only When It Is Actually Ready

“Ready” means:

- skill body is real
- trigger pack is real
- eval scenario is real
- tests pass
- docs are in sync
- no placeholder scaffold text remains

## 10. How A First-Party Skill Is Maintained

Creation is not the hard part. Maintenance is.

Arcana now has a real maintenance loop:

1. feedback comes in
2. feedback is aggregated
3. repeated complaints become triage candidates
4. triage candidates become draft eval packs
5. reviewed drafts can be promoted into committed scenarios
6. scenarios affect scorecards and release summaries

### The Practical Maintenance Flow

#### Capture signal

```bash
arcana feedback <skill>
arcana feedback-report <skill>
```

#### Find repeated failures

```bash
arcana feedback-triage <skill> --write
arcana feedback-triage <skill> --write-drafts
```

#### Review the draft locally

Review the files under:

- `.arcana/feedback/triage/drafts/<skill>/<signal>/`

Replace:

- all `TODO:` placeholders
- scaffold descriptions
- weak assertions

Add:

- at least one real fixture file

#### Promote the reviewed draft

```bash
arcana feedback-promote <skill> <signal> --dry-run
arcana feedback-promote <skill> <signal>
```

This command:

- validates the draft
- blocks placeholder promotions
- blocks promotions without a real fixture
- copies the reviewed draft into `evals/scenarios/`
- archives the source draft so it leaves the open queue

#### Re-run measurement

```bash
npm run eval:gate
npm run eval:release-summary
```

### When To Edit What

| Problem | Usually edit |
| --- | --- |
| The skill says the wrong thing | `skills/<name>/SKILL.md` |
| The skill triggers at the wrong times | `evals/triggers/<name>.json` and possibly the skill description |
| The skill is missing a scenario for a real complaint | `evals/scenarios/` or feedback-derived draft promotion flow |
| The install/import/update behavior is wrong | `src/commands/` or `src/utils/` |
| Docs are lying | manual docs, catalog, or command manifest depending on source |
| Release evidence is weak | eval scenarios, trigger packs, or release summary inputs |

## 11. Quality System Deep Dive

Arcana’s quality system has multiple layers because no single metric is enough.

### Layer 1: Trigger Packs

Question answered:

“Should this skill be selected for this user request?”

Files:

- `evals/triggers/<skill>.json`
- `evals/run-trigger-eval.js`

This is routing quality, not outcome quality.

### Layer 2: Eval Scenarios

Question answered:

“Does this skill improve the work compared with no skill?”

Files:

- `evals/scenarios/`
- `evals/run-eval.js`

This is the main empirical proof layer.

### Scorecards

Question answered:

“Did this skill get better, worse, or stay flat?”

Files:

- `evals/scorecards/`

Scorecards aggregate scenario outcomes per skill and allow regression gating.

### Feedback Loop

Question answered:

“What do real users dislike or need that our existing benchmarks do not cover?”

Files and commands:

- `.arcana/feedback/`
- `arcana feedback`
- `arcana feedback-triage`
- `arcana feedback-promote`

This is how the benchmark set evolves from real usage.

### Import Adaptation Verification

Question answered:

“Did Arcana actually improve this imported skill after adaptation?”

Files:

- `.arcana-import.raw.md`
- `src/utils/import-adaptation.js`
- `evals/import-adaptation/`

This is specific to imported skills.

### Release Summary

Question answered:

“Are we actually ready to ship, based on current evidence?”

Files:

- `src/utils/release-quality.js`
- `evals/build-release-summary.js`
- `evals/release-quality/`

This condenses:

- scorecard coverage
- trigger coverage
- stale evidence
- open feedback-derived candidate cases

### Important Limitation

Live eval and trigger execution currently depend on Claude CLI.

That means the infrastructure exists in repo, but live empirical runs are only as available as the local Claude environment.

## 12. How External Skill Imports Work

Arcana supports importing skills from:

- GitHub repos
- raw URLs
- local file paths

But imported skills are not first-party just because Arcana installed them.

### What Import Adds

When a skill is imported, Arcana stores:

- `.arcana-import.json`
- `.arcana-import.raw.md`
- attribution inside the installed skill file

That gives Arcana:

- provenance
- checksum tracking
- trust-state inspection
- later adaptation comparison against the raw baseline

### Trust States Matter

Imported skills can be:

- current
- modified locally
- legacy metadata missing

Those states matter because Arcana is trying to be a safe adoption layer, not a blind installer.

### Adaptation Flow

The expected workflow is:

1. import the raw skill
2. inspect trust and overwrite risk
3. adapt the imported skill with `/import-skill`
4. verify whether the adapted version is actually better

The adaptation verification is heuristic, not the same as a full task benchmark, but it is still better than guesswork.

## 13. Release And Operations

### Daily / Ongoing Maintainer Work

Use these commands regularly:

```bash
npm test
arcana doctor --json
arcana feedback-report
arcana feedback-triage --write
npm run eval:release-summary
```

### Before Shipping A Change

At minimum:

1. run `npm test`
2. run any skill-specific trigger/eval commands affected by the change
3. run `npm run eval:gate` when first-party skill behavior changed materially
4. run `npm run eval:release-summary`
5. confirm docs are in sync

### Version Release Flow

The release flow is:

1. make changes
2. run `node scripts/release.js <version>`
3. update `CHANGELOG.md`
4. run tests
5. push
6. wait for CI
7. publish with npm provenance

The CLI and marketplace/plugin metadata must version together.

## 14. Decision Framework

When deciding what to build next, use these questions.

### Strategic Questions

1. Does this strengthen measured quality?
2. Does this strengthen trust?
3. Does this reduce drift?
4. Does this improve portability between supported hosts?
5. Can this be tested or measured?

If the answer is mostly no, the work is probably not high leverage.

### Practical Rules

- prefer improving an existing skill over adding a new one unless the workflow is genuinely distinct
- prefer improving content and benchmarks over adding runtime complexity when the problem is skill quality
- do not introduce a second source of truth for inventory, counts, or command surfaces
- do not hide host asymmetry; document it
- do not silently collect telemetry
- do not treat imported skills as first-party
- do not auto-generate shipped first-party skills

### What Arcana Is Intentionally Not Doing

From the product boundaries:

- not a marketplace
- not a universal agent manager
- not an enterprise platform
- not a silent telemetry system
- not an auto-generated skill farm
- not a Windows-first product

These are not missing features. They are scope decisions.

## 15. Where The Project Is Now

As of the current repo state:

- Phase 1 is complete
- Phase 2 is complete
- the product now has a real loop from feedback to draft evals to promoted scenarios to release summaries

The strategic direction is still:

- measured quality
- trust
- portability
- low drift

### What Is Formally On The Roadmap

The roadmap currently leaves two meaningful forward-looking ideas visible:

1. Real-world testing of the `import-skill` quality pipeline.
2. Continued improvement of how feedback-derived cases become maintained benchmark coverage.

### What Is Not Formally Defined Yet

There is no explicit “Phase 3” written in the repo right now.

That means the next phase should be chosen deliberately, not assumed.

If you need a practical next-step filter, use this:

- if the biggest pain is imported skills, deepen import validation and adaptation evidence
- if the biggest pain is release confidence, deepen live scorecard and trigger coverage
- if the biggest pain is host asymmetry, decide whether to invest in Codex-side eval parity or stay clearly Claude-first for advanced operations

## 16. If You Get Lost

Use this quick routing map.

| If you are confused about... | Start here |
| --- | --- |
| What Arcana is trying to be | `README.md`, `docs/features/arcana-cli/roadmap.md`, `docs/features/arcana-cli/boundaries.md` |
| What ships today | `README.md`, `CLAUDE.md` |
| How the repo is organized | this guide, then `docs/features/arcana-cli/overview.md` |
| How to write or edit a skill | `SKILL-AUTHORING-REFERENCE.md` |
| How to evaluate a skill | `evals/README.md` |
| Why a command behaves the way it does | `src/commands/` and `src/utils/` |
| Why docs changed automatically | `src/utils/catalog.js`, `src/utils/command-manifest.js`, `scripts/sync-generated-content.js` |
| Whether a release is safe | `npm run eval:release-summary` |

## 17. Final Summary

Arcana is not primarily a CLI project and not primarily a marketplace project.

It is a curated skill system with a thin runtime and a growing quality-operations layer around it.

The maintainer job is not just to add skills.

The maintainer job is to:

- keep the first-party content sharp
- keep imports safe and explicit
- turn real complaints into measurable benchmarks
- keep docs and code aligned
- make release decisions from evidence instead of intuition

That is the project.
