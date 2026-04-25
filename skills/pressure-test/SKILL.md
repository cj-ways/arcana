---
name: pressure-test
description: 'Stress-tests an idea, plan, proposal, claim, or request - finds missing assumptions, weak evidence, and asymmetric tradeoffs without manufacturing low-value objections. Use when the user wants adversarial analysis, wants the strongest case for and against something, or wants to know what is missing before deciding. Manual via /pressure-test.'
argument-hint: "<idea|plan|proposal|claim>"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Agent, WebSearch, WebFetch, Write, AskUserQuestion
effort: high
phase: utility
feedback-profile: advisory
catalog-order: 160
---

# Pressure Test

Pressure-test one idea, plan, proposal, claim, or request at a time. The goal is better decisions, not performative skepticism.

## When To Use /pressure-test vs Nearby Skills

| Skill | Use it for | Do not use it for |
| --- | --- | --- |
| `/pressure-test` | Stress-testing a specific idea, decision, proposal, claim, or request | Broad feature roadmap work or project scaffolding |
| `/feature-audit` | Full feature analysis across many perspectives | One narrow proposal inside an otherwise known feature |
| `/idea-audit` | New project ideas that may turn into a full project setup | Small decision reviews inside an existing project |

**Default mode**: one-shot memo if the user already gave enough context.  
**Interactive mode**: ask one highest-leverage question if a single missing fact could change the verdict materially.

## Arguments

```
/pressure-test <idea|plan|proposal|claim>
```

If no argument is provided, ask what should be pressure-tested.

## Gotchas

1. **Manufacturing objections to sound smart.** Do not invent criticism for the sake of having more criticism. If something mostly holds up, say so clearly.
2. **Confusing unknown with wrong.** Missing evidence is not the same as a flaw. If a claim is plausible but unproven, label it as `missing evidence` or `uncertain`, not `incorrect`.
3. **Overweighting low-value nits.** Naming, copy tweaks, or second-order polish items do not belong next to material risks. Keep the final output focused on the top 3-5 findings unless the user asks for more.
4. **Skipping research on unstable claims.** For market, compliance, competitor, pricing, vendor, or current-product claims, verify with WebSearch/WebFetch instead of relying on memory.
5. **Ignoring the upside.** A pressure test that only attacks the downside is incomplete. Always state what actually holds up and why someone would reasonably want to proceed.
6. **Asking too many questions.** If one focused clarification would change the conclusion, ask it. Otherwise state the assumption and keep going.

## Core Rules

- Strong false-positive suppression: if a concern is not material, not evidenced, or not decision-relevant, drop it.
- Separate `fact`, `inference`, and `judgment`. Do not present guesses as established truth.
- Keep priorities asymmetric: one high-leverage problem matters more than five low-value nitpicks.
- If the strongest criticism is still weak, say `No material gaps found` instead of stretching for a negative angle.
- When facts are unstable, research first. When facts are unavailable, say exactly what evidence is missing.
- Do not keep searching until you find a flaw. Stop when the current evidence supports a stable recommendation.

## Workflow

### 1. Frame the decision

Identify:
- What is being pressure-tested
- What decision is actually on the table
- The desired upside
- Constraints, time horizon, and reversibility
- What would count as a successful answer for the user

If the user supplied a document, memo, or proposal, treat that as the primary object under test.

### 2. Gather evidence

Use the lightest evidence pack that can support a real decision:

- **Repo or product claims**: read `CLAUDE.md`, `README.md`, feature docs, and the smallest relevant code/doc surface
- **External or current claims**: use WebSearch and WebFetch; prefer official docs, direct competitor pages, primary source articles, and current policy pages
- **User assertions with no backing evidence**: convert them into assumptions and test whether they matter

If the proposal spans multiple independent domains, optionally launch up to two focused agents:
- one to verify external claims or competing alternatives
- one to build the strongest disconfirming case

Do not give those agents your intended verdict. Give them the proposal and the available evidence only.

### 3. Build both sides before judging

Write down:
- the strongest case **for** the proposal
- the strongest case **against** the proposal
- the missing assumptions that decide between the two
- second-order effects, hidden dependencies, and irreversible choices

If the proposal survives this pass, say so.

### 4. Weight and filter findings

Every candidate finding must pass all of these filters:

1. **Impact** - does this materially affect the decision, rollout, trust, revenue, security, reliability, or user outcome?
2. **Likelihood / confidence** - how strongly is it supported by evidence?
3. **Reversibility** - is the cost of being wrong high or easy to undo?
4. **Time-to-failure** - would this hurt immediately, or only in an edge case the user can safely defer?
5. **Evidence strength** - can you point to concrete source material, or only an assumption?

Classify each surviving finding as:

- `Critical` - invalidates the proposal as stated or creates an unacceptable downside
- `High` - materially changes the decision or rollout design
- `Medium` - worth resolving, but not a blocker by itself
- `Drop` - true but too low-value, too speculative, or too minor to surface

If two findings overlap, keep the clearer and higher-leverage one.

### 5. Deliver the memo

When the user gave enough context, provide a one-shot memo using this structure:

```markdown
## What Holds Up
- 2-4 points explaining the strongest parts of the proposal

## Highest-Leverage Risks
### Finding 1
- Priority: High
- Why it matters:
- Evidence:
- Counterpoint:
- What would change my mind:

## Missing Evidence
- The smallest unanswered questions that could change the decision

## Recommendation
- Verdict: proceed | proceed with changes | do not proceed as stated
- Next step:
```

If the user asked for interactive help instead of a one-shot report, still keep the same structure mentally. Ask only the single highest-leverage question first.

## Validation

- Every finding must cite evidence or explicitly say that it is an assumption.
- Every criticism must explain why it matters in one sentence. If you cannot explain impact, drop it.
- The memo must include both upside and downside. A pure takedown is incomplete.
- The final recommendation must be consistent with the weighted findings. Do not bury the real verdict under too much prose.
- If the strongest conclusion is "good idea, but change the rollout," say that directly instead of acting as if the whole idea is bad.
