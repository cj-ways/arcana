---
name: feature-audit
description: 'Broad feature audit with runtime depth control - quick to exhaustive analysis across product, UX, ops, reliability, competitors, and roadmap decisions. Use for end-to-end feature analysis, not one narrow bug or one small proposal. Manual via /feature-audit.'
argument-hint: "<feature-name> [effort:auto|low|medium|high|extra]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Agent, WebSearch, WebFetch, Write, AskUserQuestion
effort: high
phase: analyze
feedback-profile: advisory
catalog-order: 20
---

# /feature-audit
Audit one feature deeply without forcing every audit to pay an exhaustive research bill.

This skill supports runtime depth control:
- `low` for narrow, cheap, high-signal passes
- `medium` for standard single-feature audits
- `high` for the full deep audit and collaborative product debate
- `extra` for the strongest audit path, beyond the original version
- `auto` to choose the deepest justified mode while still dropping to `low` for obviously narrow asks

The evidence bar does not change with effort. Only breadth, depth, research budget, and output scope change.

## When To Use /feature-audit vs Nearby Skills

| Skill | Use it for | Do not use it for |
| --- | --- | --- |
| `/feature-audit` | Broad feature analysis across product, UX, ops, reliability, risks, cross-surface behavior, and improvement paths | Turning one rough feature idea into a concrete solution spec |
| `/feature-design` | Designing one feature or workflow before implementation: compare approaches and produce a spec | Broad auditing of an existing feature across many lanes |
| `/orchestrate` | Running large feature delivery across phases, worker packets, blockers, and review gates | Deciding what is weak or missing in the feature overall |
| `/pressure-test` | Stress-testing one idea, claim, rollout plan, or proposal | End-to-end feature analysis across many lanes |
| `/idea-audit` | New project ideas that may turn into a full project setup | Existing feature work inside a known product |
| `/quick-review` | Fast code review of a diff or branch | Product and roadmap analysis |
| `/deep-fix` | Root-cause debugging plus fix and regression proof | Feature gap discovery and prioritization |

## Arguments

```text
/feature-audit <feature-name> [effort:auto|low|medium|high|extra]
```

Accepted forms:
- `/feature-audit billing`
- `/feature-audit billing effort:auto`
- `/feature-audit billing effort:high`
- `/feature-audit billing high`
- `/feature-audit billing extra`

Alias mapping:
- `low`: `low`, `quick`, `light`, `fast`
- `medium`: `medium`, `balanced`, `normal`
- `high`: `high`, `deep`, `full`
- `extra`: `extra`, `max`, `exhaustive`
- default: `auto`

If no feature is provided, ask what should be audited.

## Progressive Disclosure

Keep the base skill focused. Load additional references only when they materially affect the audit:
- Read [references/high-and-extra.md](references/high-and-extra.md) when the chosen effort is `high` or `extra`, or when the feature class needs detailed lane coverage and deep-pass checklists.
- Read [references/persistence.md](references/persistence.md) only when the user wants the audit persisted into feature docs, roadmap files, or a long-form artifact.

## Gotchas

1. **Suggesting improvements that already exist.** Search the relevant codebase surface before claiming something is missing. For `high` and `extra`, check sibling surfaces when the feature spans them.
2. **Over-auditing trivial asks.** A question like button color, one label, or one confirmation state is not a full feature audit. In `auto`, drop to `low`.
3. **Treating unknown as broken.** Missing evidence is not the same as a flaw. Mark it as unknown when you cannot prove it.
4. **Researching because tools exist.** Do not browse or spawn agents unless they materially change the answer.
5. **Checklist theater.** The universal perspectives are internal coverage rails, not a reason to dump headings into the response.
6. **Drifting into solution design.** If the user shifts from “what is wrong or missing?” to “how should it work?”, hand off to `/feature-design` instead of turning the audit into a design workshop.
7. **Losing the conversation.** For `high` and `extra`, this is still a collaborative audit when the user wants discussion. Do not flatten everything into a generic report.
8. **Missing cross-surface truth.** Admin, mobile, docs, notifications, workers, and operator flows often carry the real gaps.
9. **Low-value findings crowding real issues.** One material trust or conversion problem matters more than five cosmetic suggestions.

## Rules

1. Do not manufacture suggestions. If the feature is mostly strong, say so.
2. Weight findings by impact, confidence, reversibility, time-to-failure, and business value.
3. Do not ask follow-up questions by default. Ask one question only when the answer would materially change the priorities.
4. Stay in feature-audit mode across follow-up turns in the same thread once the user starts an audit. Do not require the user to re-run the skill on every follow-up question about the same feature.
5. Keep current feature, chosen effort, key constraints, and decisions in working memory until the user changes topic or explicitly exits audit mode.
6. Do not browse or launch agents just because the tools are available. Use them only when they change the audit outcome.
7. Only write docs or roadmap files after the user confirms the audit direction.
8. For `high` and `extra`, never be shallower than the old deep audit pattern: feature map, cross-surface check when relevant, observability pass, and feature-specific perspective discovery.
9. If the user wants to decide how the feature should work or compare implementation approaches, switch to `/feature-design`.

## Interaction Modes

### Session Mode
If the user starts `/feature-audit` and then continues the same audit in follow-up turns:
- stay in audit mode for that thread
- keep the same feature unless the user changes it
- keep the same effort unless the user changes it
- treat short follow-up questions as continuations, not new tasks

Only exit audit mode when:
- the user changes topic clearly
- the user explicitly says to stop the audit
- the conversation shifts into implementation and no longer needs audit behavior

### One-Shot Mode
Use one-shot mode when:
- the user asks for a report, memo, roadmap, or artifact
- the user says not to ask follow-up questions
- the brief already gives enough constraints

### Interactive Mode
Use interactive mode when:
- the user wants to unpack findings, tradeoffs, or priorities in dialogue
- the prompt is open-ended and one answer could materially change prioritization
- the user is responding to earlier findings inside the same audit thread

If interactive mode is chosen:
- ask one focused question or present one finding at a time
- wait for the answer before branching
- summarize only the current decision, not the whole audit every turn

## Effort Model

| Effort | Goal | Local research | Web research | Agent budget | Output bias |
| --- | --- | --- | --- | --- | --- |
| `low` | Narrow high-signal pass | Smallest relevant local surface only | None unless user explicitly asked or a current external fact is essential | None | Compact memo |
| `medium` | Standard feature audit | Main feature surface plus one adjacent flow if needed | Targeted and limited when it changes prioritization | Up to 1 focused read-only agent | Standard audit |
| `high` | Full deep audit, no less than the original version | Full feature mapping across relevant local surfaces and sibling surfaces when relevant | Verified competitor/current-state research when customer-facing or explicitly requested | Up to 3 focused agents | Deep audit |
| `extra` | Strongest audit path | Everything in `high` plus contradiction pass, edge-case sweep, and broader cross-surface verification | Broader verified market/current-state pass with citations | Up to 4 focused agents | Exhaustive audit |
| `auto` | Deepest justified mode | Resolve to low, medium, high, or extra based on scope and stakes | Match resolved effort | Match resolved effort | Match resolved effort |

## Auto Effort Selection

Default bias:
- prefer `high` for real feature audits
- drop to `low` only for clearly narrow asks
- use `medium` for moderate single-feature analysis that is broader than a tweak but not a full deep audit
- use `extra` only when the prompt or the risk profile clearly demands it

Choose `low` when the request is clearly narrow, such as:
- one button color
- one label, tooltip, or copy choice
- one empty state
- one confirmation screen
- one step in a flow without broader roadmap or competitor questions
- “give me top 2 issues only” on a very small surface

Choose `medium` when:
- the request is one feature with moderate scope
- the user wants prioritization but not a deep cross-surface investigation
- competitor research is not central
- the ask is broader than a tweak but narrower than a serious end-to-end audit

Choose `high` when any of these are true:
- the user asks for a feature audit, gap analysis, competitor analysis, roadmap, or prioritization
- the feature is customer-facing and trust, conversion, or UX matter
- the feature touches multiple workflows or surfaces
- the feature is operationally or commercially important
- the user asks for a serious or deep audit

Choose `extra` when:
- the user explicitly asks for `extra`, `max`, or exhaustive depth
- the feature is high-stakes and cross-cutting, such as auth, billing, payments, permissions, compliance, onboarding, or subscription funnels
- the audit needs the strongest possible challenge before decisions are made
- the user wants both broad internal analysis and strong external or competitor grounding

If the signal is mixed, prefer `high`, not `medium`.

## Workflow

### 1. Frame the audit
Determine:
- the feature under audit
- the real user goal: quick prioritization, broad audit, roadmap, competitor comparison, docs update, or interactive audit discussion
- the requested or implied effort
- whether this is a continuation of an existing audit thread

If the user already gave enough context, do not ask a question yet.

### 2. Detect project context
Read enough to understand what product this is.

Context read order:
1. `CLAUDE.md` or `claude.md`
2. existing feature docs or `docs/features/`
3. `README.md`
4. smallest relevant code and config surface
5. sibling projects if the feature clearly spans them

For `high` and `extra`, explicitly determine the domain, architecture shape, sibling surfaces, existing feature docs, and whether the feature is customer-facing, operator-facing, internal, or mixed.

### 3. Build the evidence pack

#### Low
- Read the smallest local surface needed to understand the pain point.
- Do not inventory the entire feature.
- Do not open sibling surfaces unless the user explicitly framed the feature as cross-surface.

#### Medium
- Map the main user flow and one adjacent operator or system flow if needed.
- Check local docs, relevant code, and one neighboring surface that could change prioritization.

#### High and Extra
- Load [references/high-and-extra.md](references/high-and-extra.md).
- Follow the detailed deep-pass checklist there for implementation inventory, cross-surface truth, observability, contradiction search, hidden-edge states, and feature-specific lane discovery.

### 4. Discover the right audit lanes
Always silently screen:
- functional correctness
- error and edge cases
- performance and scalability
- security and privacy
- reliability and fault tolerance
- usability and trust
- accessibility
- maintainability
- testability
- observability
- data integrity
- compatibility
- cost efficiency

Conditionally screen:
- compliance and regulatory
- documentation quality
- portability and lock-in

For `medium`, `high`, and `extra`, derive the most relevant feature-specific lanes from:
- repo and docs evidence
- current external best practices when they matter
- known failures for this feature class

Read [references/high-and-extra.md](references/high-and-extra.md) for lane examples and feature-class reminders when the audit goes beyond a standard pass.

### 5. Expand externally only when justified

#### Low
- Skip web research unless the user explicitly asked for competitor or market context, or a current external fact is central.

#### Medium
- Use limited targeted web research when competitor expectations or current product patterns materially affect prioritization.
- Prefer official docs, product pages, help centers, pricing pages, and policy pages.

#### High and Extra
- Run a verified external pass when customer-facing expectations or competitive differences materially affect the recommendation.
- Keep source URLs for non-obvious external claims.

### 6. Use agents deliberately

#### Low
- Do not launch agents.

#### Medium
- Optionally launch 1 focused read-only agent for one bounded question.

#### High and Extra
- Launch focused agents only when they save real time.
- Use bounded scopes such as implementation inventory, observability pass, competitor deep dive, contradiction search, or cross-surface verification.
- Do not launch overlapping generic agents.

### 7. Filter and weight findings
Every candidate finding must pass:
1. **Evidence** — grounded in repo, docs, or verified external sources
2. **Impact** — materially affects trust, conversion, operations, reliability, or decision quality
3. **Confidence** — supported strongly enough to state clearly
4. **Distinctness** — not duplicating a stronger finding
5. **Actionability** — leads to a real improvement path

Classify as:
- `Critical`
- `High`
- `Medium`
- `Drop`

If it is true but not decision-relevant, drop it.

### 8. Deliver the audit

For `low`, use:

```markdown
## Audit Frame
- Requested effort:
- Selected effort:
- Evidence base:

## Current State
- 2-4 short bullets

## Highest-Leverage Gaps
### Finding 1
- Priority:
- Why it matters:
- Evidence:
- Recommended move:

## What Looks Strong
- 1-3 bullets

## Next Step
- one concrete next action
```

For `medium`, use:

```markdown
## Audit Frame
- Requested effort:
- Selected effort:
- Evidence base:

## Current State
- concise summary

## Highest-Leverage Gaps
### Finding 1
- Priority:
- Why it matters:
- Evidence:
- Recommended move:

## What Looks Strong
- strengths worth preserving

## Priority Order
1. ...
2. ...
3. ...

## Recommendation
- what to do next
```

For `high` and `extra`, use:

```markdown
## Audit Frame
- Requested effort:
- Selected effort:
- Evidence base:

## Current State
- concise summary

## Audit Lanes
- the most relevant lanes, not every possible lane

## Highest-Leverage Gaps
### Finding 1
- Priority:
- Why it matters:
- Evidence:
- Counterpoint:
- Recommended move:

## What Looks Strong
- strengths worth preserving

## Competitive Intelligence
- only when external research was actually used

## Priority Order
1. ...
2. ...
3. ...

## Recommendation
- what to do next
```

Do not include giant filler sections just because effort is high.

If the user asks the audit to choose between solution shapes or define the future workflow in detail, stop the audit answer at the diagnosis and recommendation boundary, then suggest `/feature-design` for the next step.

If the user already has the design direction and now needs phased implementation ownership across sessions, suggest `/orchestrate` for the next step instead of stretching the audit into delivery coordination.

## Documentation And Persistence

Only persist docs after the user confirms the audit direction.

When the user wants feature docs, roadmap files, or a durable audit artifact:
- load [references/persistence.md](references/persistence.md)
- follow the repo's existing feature-doc structure if one exists
- describe current state in docs and planned changes in roadmap files

## Validation

Before finalizing:
- confirm that the reported gaps are not already solved elsewhere in the repo
- confirm that external claims are sourced if they materially affect the recommendation
- confirm that `high` stayed no shallower than the old deep-audit path
- confirm that `extra` added real depth instead of just more words
- confirm that the output is proportional to the chosen effort level
- confirm that no low-value filler survived the weighting pass
- confirm that the top recommendation matches the strongest evidence

If the chosen effort is `high` or `extra`, confirm that the audit also followed [references/high-and-extra.md](references/high-and-extra.md).
If the user requested persisted docs or roadmap output, confirm that the result followed [references/persistence.md](references/persistence.md).

If more research would not change the top priorities, stop.
