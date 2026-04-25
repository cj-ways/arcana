# Arcana CLI — Roadmap

> Last updated: 2026-04-16

## Current Direction

Arcana should compete on measured quality, trust, and portability — not raw skill count or marketplace size.

The first-party skill set remains the reference set, but the product moat should be:

- provable skill quality
- safe adoption of external skills
- explicit host capability boundaries
- low-drift docs, metadata, and contributor workflows

## Phase 1 — Measurement and Trust Foundation

Phase 1 focused on making Arcana's core claim testable and trustworthy before expanding the catalog or agent surface.

**Status:** Completed 2026-04-16

## Phase 1 Workstreams

### 1. Skill scorecards and release gates

**Status:** Implemented 2026-04-16

Arcana says quality matters more than quantity. That claim needs a stronger proof system than the current eval runner provides.

**Exact repo changes**

- Extend `evals/run-eval.js` to support `with skill` vs `no skill` baselines
- Add repeated-run aggregation and result summaries instead of single-run snapshots
- Expand `evals/README.md` into a manifest v2 spec with route, process, and outcome scoring
- Extend `scripts/new-skill.js` and `src/utils/skill-scaffold.js` so new first-party skills get eval scaffolding automatically
- Add a per-skill scorecard artifact under `evals/` so releases can compare before/after results

**Success criteria**

- Every first-party skill has at least one runnable scenario
- Arcana can answer "did this skill get better?" with data
- Releases can gate on score movement instead of intuition

### 2. Import governance and trust surface

**Status:** Implemented 2026-04-09

Arcana should become the safe way to adopt outside skills, not just the convenient way.

**Exact repo changes**

- Add imported-skill registry metadata stored with source, ref, checksum, import date, and Arcana version
- Extend `src/commands/import.js` and `src/commands/update.js` to preserve and surface that metadata
- Add review mode and risk summary before import or overwrite of imported skills
- Extend `info` and `doctor` to report provenance, local modifications, and trust state for imported skills

**Success criteria**

- Every imported skill has traceable provenance
- Users can review what changed before overwriting an imported skill
- Arcana can distinguish first-party trust guarantees from imported-skill trust state

### 3. Product truth cleanup

**Status:** Implemented 2026-04-16

Docs, boundaries, and workflow guidance should always describe the product that actually ships.

**Exact repo changes**

- Fix remaining stale docs such as lifecycle language, hardcoded counts, and outdated boundaries
- Make `WORKFLOW.md` align with the current skill taxonomy and keep it from drifting again
- Update feature docs to reflect local-first feedback and explicit opt-in transcript analysis
- Keep generated docs and manual docs aligned through checks or generation where practical

**Success criteria**

- A new user can read docs without learning outdated behavior
- The roadmap, boundaries, and workflow docs agree with the actual product
- Drift becomes a release blocker, not a cleanup chore

### 4. Day-2 UX and machine-readable surfaces

**Status:** Implemented 2026-04-16

Arcana onboarding is already solid. The weaker area is ongoing use, scripting, and trust-building during change previews.

**Exact repo changes**

- Add `--json` to `list`, `info`, and `doctor`
- Add `--dry-run` to `init`, `add`, and `sync`
- Add `--verbose` or `--debug` for import and sync troubleshooting
- Audit error messages so each one suggests a next action

**Success criteria**

- Arcana is scriptable in CI and local automation
- Users can preview mutations before applying them
- Import and sync failures become easier to debug without reading source code

### 5. Host strategy and capability matrix

**Status:** Implemented 2026-04-16

Arcana's advanced feedback automation currently goes deeper in Claude Code than in Codex. That is acceptable only if the boundary is explicit.

**Exact repo changes**

- Add a capability matrix to the docs showing Claude-only vs cross-agent behavior
- Keep Claude-specific automation explicit in command help and docs
- Avoid marketing symmetric support where advanced features are host-specific

**Success criteria**

- Users know what works in Claude Code, Codex CLI, or both before installing
- Arcana can deepen Claude integration without confusing Codex users

### Backlog After Phase 1

**Real-world testing of `import-skill` quality pipeline** — Approved
The CLI import command and adaptation skill both work. Needs iteration on edge cases from real usage: skills with `---` in content, non-standard frontmatter, oversized skills, multi-file skills with references/.

**Feedback-to-eval case promotion depth** — Implemented 2026-04-16
Repeated user feedback now triages into concrete eval candidates locally, and reviewed drafts can be promoted into committed first-party scenarios through `arcana feedback-promote` after placeholder and fixture validation.

## Phase 2 — Quality Operations Loop

Phase 2 focuses on turning post-release signals into maintainable product improvements instead of leaving them as disconnected reports.

**Status:** Completed 2026-04-16

## Phase 2 Workstreams

### 1. Feedback-to-eval promotion

**Status:** Implemented 2026-04-16

Phase 1 made repeated complaints visible. Phase 2 needs to turn them into concrete eval work products that can be reviewed and promoted.

**Exact repo changes**

- Extend `arcana feedback-triage` to generate local draft eval packs for repeated complaints
- Preserve source examples, recommendations, and suggested assertion hints with each draft
- Keep promotion local-first so maintainers review before moving drafts into `evals/scenarios/`

**Success criteria**

- Repeated feedback no longer stops at a JSON or terminal report
- Maintainers get concrete draft packs they can promote into real scenarios
- The quality loop produces artifacts, not just dashboards

### 2. Imported-skill adaptation verification

**Status:** Implemented 2026-04-16

Arcana can import and adapt external skills, but it still needs a stronger way to measure whether the adapted version is actually better than the raw import.

**Exact repo changes**

- Add an import-adaptation eval harness that compares raw imported content against the adapted Arcana version
- Create a small fixture set of real imported skills with common adaptation gaps
- Surface adaptation quality summaries alongside import provenance and review flows

**Success criteria**

- Arcana can answer whether adaptation improved clarity, structure, and safety
- Imported-skill quality claims become measurable instead of anecdotal

### 3. Release-facing quality summaries

**Status:** Implemented 2026-04-16

The repo now has scorecards, triggers, and triage artifacts. Releases still need a single operator-facing summary that condenses those signals.

**Exact repo changes**

- Add a generated release-quality summary over scorecards, trigger runs, and feedback-derived local cases
- Keep the summary local-first and artifact-backed so it works in CI and local release checks
- Make regressions or missing evidence obvious before publishing

**Success criteria**

- Release readiness is readable in one place
- Missing trigger runs, stale scorecards, or unreviewed feedback-derived draft cases are visible before ship

---

## Completed

### v1.7.x (2026-03-21)

**`skill-scout` skill** — 14th skill. Scouts major providers for skills matching the current project.

**`arcana import` CLI command** — Fetch skills from GitHub, URLs, or local paths. 10th CLI command. Uses native fetch() (no curl dependency).

**`import-skill` rewrite** — Refocused on quality adaptation pipeline (audit, assess, adapt, verify).

**Shared frontmatter parser** — Extracted to `src/utils/frontmatter.js`. Eliminated duplicate implementations in info.js and import.js.

**Exit code fixes** — `add` exits 1 on unknown skills, `remove` exits 1 with no args.

**Update auto-sync with --clean** — Stale skills removed from mirrors after migrations.

**marketplace.json version fix** — Release script now catches nested `plugins[0].version` field.

**curl replaced with fetch()** — No system dependency, better error handling, proxy support.

**README accuracy** — Import command added to commands section, skill count updated to 14.

### v1.6.x (2026-03-20)

**Doctor integrity check** — Hash installed skills against package source.

**Layer 2 eval framework** — Initially shipped with 3 scenarios; the `find-unused` scenario was later removed when that skill was dropped.

**Layer 1 unit tests** — 177 tests across 7 suites. Vitest. CI on Node 20/22.

**WORKFLOW.md** — Skill lifecycle guide.

**Drop Cursor/Gemini support** — Focus on Claude Code + Codex CLI.

**Migration system** — `migrations.json` handles renames/removals.

**Rename `new-project-idea` to `idea-audit`** — First migration.

**`allowed-tools` on all skills** — Comma-separated format.

**README rewrite** — Why-first, workflow split, quantified SkillsBench claims.

**Release script** — `scripts/release.js` bumps all version fields.

**Bug fixes** — Frontmatter parsing, rules conflict detection, update triggers sync.

---

## Dropped

**Publish skills to third-party marketplaces (skills.sh, SkillsMP)** — Dropped 2026-03-20
Arcana is a self-contained toolkit. `import-skill` is the bridge. Claude Code's native plugin system (`.claude-plugin/marketplace.json`) remains supported as a distribution channel.

**Enterprise features** — Dropped 2026-03-20
Wrong stage.

**Additional agent support (Copilot, Antigravity, Windsurf)** — Dropped 2026-03-20
Focus on Claude Code + Codex CLI first.

---

## Competitive Intelligence

> Updated: 2026-04-08

- **Ecosystem scale**: 350,000+ skills in 2 months. 85% of tested skills made output worse (40/47). Industry consensus: 20-30 curated skills max.
- **Security crisis**: 13.4% of scanned skills have critical issues (Snyk). ClawHub incident: 1,184 malicious skills. Arcana's hand-authored, npm-provenance approach is a genuine differentiator.
- **skills.sh (Vercel)**: 83K+ skills, dominant directory. Backed by Vercel/Stripe/Prisma. Distribution infrastructure, not content — complementary to Arcana.
- **Name conflict**: `medy-gribkov/arcana` — 74 skills, 15 categories, visible on LobeHub. Same name, similar concept. The `@cj-ways/arcana` npm scope protects the package, but brand confusion is possible.
- **Anthropic official skills** (`anthropics/skills`): Reference skills for creative/technical tasks. Could expand into workflow territory (code review, security). Monitor.
- **Claude Code plugin marketplace**: Native distribution via `/plugin`. Arcana already participates via `.claude-plugin/marketplace.json`.
- **OpenAI Codex catalog**: 35 curated skills, 13K GitHub stars. Small — leaves room for Arcana's workflow skills.
- **Nobody competes on quality.** Market still in quantity phase. Arcana's SkillsBench data (7,308 trajectories) is unique.

## Audit History

- 2026-04-16: Phase 1 completed. Added host capability matrix, feedback-to-eval triage workflow, actionable CLI next-step hints, and synced roadmap statuses to the shipped code.
- 2026-04-08: Feature re-audit. Reset product direction around measured quality, import governance, truth cleanup, day-2 UX, and explicit host strategy. Phase 1 plan approved and persisted.
- 2026-03-20: Initial feature audit. 13 universal + 4 feature-specific perspectives. Full competitive landscape. Shipped v1.6.0 with all roadmap items.
- 2026-03-21: Re-audit. 16 findings (9 fixed, 3 noted, 4 pass). Shipped v1.7.0 (skill-scout), v1.7.1 (version fix). Codebase in strong shape — remaining items are polish.
- 2026-03-21: Deep self-audit. 12 fixes: agents rewritten as thin wrappers (skills: field), Gotchas added to create-pr + agent-audit, doc drift fixed (version, counts, dead links), competitive intel updated (350K ecosystem, name conflict, security crisis), code quality fixes (dead check, marker consistency), disable-model-invocation on 4 skills.
