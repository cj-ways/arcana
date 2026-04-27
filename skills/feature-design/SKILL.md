---
name: feature-design
description: 'Design one feature or workflow before implementation - clarify the problem, compare approaches, ask one focused question at a time when needed, and turn the result into an approved design spec. Use for solution design inside an existing product, not broad audits, new project ideas, or v0-only prompt generation. Manual via /feature-design.'
argument-hint: "<feature-or-workflow>"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Agent, WebSearch, WebFetch, Write, AskUserQuestion
effort: high
phase: design
feedback-profile: advisory
catalog-order: 30
---

# /feature-design
Design one feature or workflow before implementation. The goal is to leave the conversation with a clear direction, explicit tradeoffs, and a design spec that can guide implementation.

This skill is the design-stage counterpart to `/feature-audit`:
- `/feature-audit` finds gaps, risks, and priorities across an existing feature
- `/feature-design` turns a rough feature direction into a concrete solution and spec

Use interactive design by default. Ask one focused question at a time when clarification materially changes the design. Switch to a one-shot design memo only when the user already gave enough context or explicitly asked for a written spec.

## When To Use /feature-design vs Nearby Skills

| Skill | Use it for | Do not use it for |
| --- | --- | --- |
| `/feature-design` | Designing one feature or workflow before coding: compare approaches, narrow scope, and produce a spec | Broad audits of current feature quality, large feature implementation orchestration, startup idea validation, or one narrow critique of a single proposal |
| `/feature-audit` | Broad analysis of an existing or proposed feature across many product and operational lanes | Narrowing a rough feature idea into one design direction |
| `/pressure-test` | Stress-testing one concrete proposal, decision, or rollout plan | Collaborative solution design from a rough starting point |
| `/idea-audit` | New project ideas that may turn into a full project scaffold | Feature work inside an existing product |
| `/v0-design` | Generating a copy-pasteable v0.dev prompt once UI direction is already stable | Choosing the product behavior, scope, or architecture of the feature |

## Arguments

```text
/feature-design <feature-or-workflow>
```

Accepted forms:
- `/feature-design team invite approvals`
- `/feature-design billing pause flow`
- `/feature-design redesign how subscription recovery should work`

If no feature is provided, ask what should be designed.

## Progressive Disclosure

Keep the main loop lean. Load extra references only when they are needed:
- Read [references/spec-template.md](references/spec-template.md) when drafting the design memo or a persisted feature spec.
- Read [references/design-lenses.md](references/design-lenses.md) when the feature touches permissions, billing, state machines, cross-surface flows, or other high-risk design constraints.

## Gotchas

1. **Coding too early.** This skill is for deciding what to build, not jumping into implementation.
2. **Treating design like brainstorming theater.** Do not generate three fake options if only one viable shape remains after reading the constraints.
3. **Asking a survey up front.** Ask one highest-leverage question at a time. Do not dump a questionnaire.
4. **Mixing design with audit.** If the user wants to know what is wrong with a feature overall, use `/feature-audit` first or state that the design work depends on that audit.
5. **Designing multiple independent features at once.** If the ask spans unrelated jobs, split it into separate design threads before proceeding.
6. **Ignoring cross-surface consequences.** Admin tools, notifications, permissions, rollout states, and failure states often define the real design.
7. **Handing off a vague recommendation.** The output must make implementation easier, not just sound thoughtful.
8. **Acting like a UI prompt generator.** If the user already knows the feature behavior and only needs visual exploration, hand off to `/v0-design`.

## Rules

1. Prefer the lightest context read that still supports a real design decision.
2. Start from the user problem, not the implementation convenience.
3. Compare 2-3 viable approaches when the design is still open. If the constraints clearly kill the alternatives, say so instead of pretending the choice is wide open.
4. Separate `fact`, `constraint`, `assumption`, and `decision`.
5. Ask one focused question only when the answer would change the chosen direction materially.
6. Do not write a final spec or roadmap file until the user confirms the direction, unless they explicitly asked for a one-shot design memo.
7. If the user only wants a visual prompt after the design is stable, hand off to `/v0-design` rather than bloating this skill with visual prompt generation.
8. If the real problem is still “what is weak or missing in this feature,” use `/feature-audit` first instead of pretending the design decision is already framed.

## Interaction Modes

### Interactive Mode
Default to interactive mode when:
- the ask is still rough
- multiple viable approaches exist
- the user wants debate or collaborative design
- the problem is broad enough that one answer could materially reshape the design

In interactive mode:
- ask one focused question or present one decision at a time
- compare approaches before locking direction
- confirm the chosen direction before writing the full spec

### One-Shot Mode
Use one-shot mode when:
- the user asks for a design memo or spec directly
- the brief already includes the key goals and constraints
- the user says not to ask follow-up questions

In one-shot mode:
- still compare approaches internally
- present the reasoning and recommendation clearly
- write the spec in the standard structure

## Workflow

### 1. Frame the design problem
Determine:
- what feature or workflow is under design
- what decision is actually open
- who the user or operator is
- what outcome matters most
- whether this is a new design, a redesign, or a scoped extension of an existing feature

If the ask is too broad, split it into the smallest meaningful design unit before proceeding.

### 2. Read the minimum context
Read enough to avoid designing against fantasy:
1. `CLAUDE.md` or `claude.md`
2. existing feature docs if they exist
3. the smallest relevant code and config surface
4. adjacent surfaces if the workflow clearly spans them

Use WebSearch or WebFetch only when the design depends on current external facts, product patterns, or regulated behavior.

### 3. Clarify the design tension
Extract:
- problem statement
- goals
- non-goals
- constraints
- irreversible choices
- rollout constraints

If one missing fact could change the shape of the solution, ask for that fact now and wait.

### 4. Generate viable approaches
When the design is not already obvious:
- produce 2-3 viable approaches
- keep each approach concrete
- explain tradeoffs across UX, complexity, operability, trust, and reversibility
- discard obviously inferior approaches instead of pretending they are equal

For higher-risk workflows, load [references/design-lenses.md](references/design-lenses.md) before finalizing the tradeoffs.

### 5. Choose the direction
Recommend one direction with a direct reason:
- why this direction wins
- what it preserves
- what it sacrifices
- what assumptions still need validation

If no direction is safe yet, say what must be resolved before choosing one.

### 6. Draft the design spec
When the direction is agreed or the user asked for a one-shot memo:
- load [references/spec-template.md](references/spec-template.md)
- write only the sections that matter for this feature
- keep the spec concrete enough that implementation can start from it

At minimum, cover:
- problem and goals
- scope and non-goals
- chosen approach
- core user/admin/system flows
- edge cases and failure states
- data, permissions, or contract changes when relevant
- rollout, measurement, and open questions

### 7. Hand off cleanly
After the design is stable:
- move to implementation only if the user asks
- if the next step is large multi-session delivery with worker packets, hand off to `/orchestrate`
- if the next step is UI exploration, hand off to `/v0-design`
- if the next step is broader gap discovery or reprioritization, use `/feature-audit`
- if the next step is challenging a single proposal or rollout plan, use `/pressure-test`

## Output Format

For one-shot outputs, use:

```markdown
## Design Frame
- Feature:
- Core decision:
- Users:
- Constraints:

## Approaches
### Approach 1
- Summary:
- Strengths:
- Tradeoffs:

### Approach 2
- Summary:
- Strengths:
- Tradeoffs:

## Recommended Direction
- Why this wins:
- Main tradeoff:
- What still needs validation:

## Draft Spec
### Goals
### Non-Goals
### User Flow
### States And Edge Cases
### Data / Permissions / Contracts
### Rollout And Measurement
### Open Questions
```

Interactive mode should still converge on this structure mentally, even if the conversation reaches it step by step.

## Validation

Before finalizing:
- confirm the design is solving the stated problem, not a nearby one
- confirm the recommendation is consistent with the listed constraints
- confirm the chosen direction beat the alternatives for a real reason
- confirm edge cases, failure states, and cross-surface consequences were not skipped
- confirm the output is specific enough that implementation could start from it
- confirm the result did not drift into a feature audit, startup idea audit, or v0 prompt
