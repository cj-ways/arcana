# Orchestrator State

## Contents
- Required role of the state file
- State file template
- Update rules
- Compaction recovery rules

## Required Role Of The State File

`orchestrator.state.md` is the canonical record of the feature delivery program.

It must be enough for a fresh agent to recover:
- what the feature is
- which source docs and repo rules matter
- what decisions are already locked
- which packet is active now
- what is blocked, done, deferred, or still open

Do not treat chat history as a backup. If a decision matters, write it here.

## State File Template

Use this structure unless the feature has a very strong reason to add or remove a section:

```markdown
# <Feature Title> — Orchestration State

## Feature Frame
- Slug:
- Objective:
- Current phase:
- Status:

## Canonical Sources
- `CLAUDE.md`
- `docs/...`
- `feature brief path`
- `ADR / standards path`

## Locked Constraints
- Constraint:
- Constraint:

## Working Assumptions
- Assumption:
- Assumption:

## Decisions
- Decision:
  - Why:
  - Source:

## Execution Strategy
- Dependency order:
- Active packet budget:
- Safe parallelization opportunities:
- Highest-risk contract boundaries:

## Phase Plan
### Phase 1 — <name>
- Goal:
- Exit criteria:
- Packets:

### Phase 2 — <name>
- Goal:
- Exit criteria:
- Packets:

## Active Packet
- Packet:
- Owner:
- Input file:
- Expected output file:
- Expected blocker file:
- Status:
- Depends on:
- Parallelizable with:

## Completed Packets
- Packet:
  - Outcome:
  - Verified by:
  - Follow-ups:

## Open Questions
- Question:
- Why it matters:
- Needed from:

## Open Blockers
- Blocker:
- Packet:
- Status:

## Review Gates
- Required repo checks:
- Required skill checks:
- Required docs/ADR comparisons:

## Next Actions
- Next orchestrator move:
- Next user move:
```

## Update Rules

Update the state file immediately when any of these change:
- feature scope
- sequencing
- dependency order or parallelization budget
- packet ownership
- a locked decision
- blocker status
- accepted packet status
- review-gate requirements

When updating:
- preserve past decisions unless explicitly superseded
- record why a decision changed
- keep the currently active packet obvious at a glance
- keep dependency and parallelization notes current instead of leaving them implicit in chat
- move stale items out of `Open Questions` or `Open Blockers` once resolved
- summarize accepted packet outcomes tightly enough that older packet files do not need to be reread for routine continuation

## Compaction Recovery Rules

Before ending any major orchestration turn, check:
- could a fresh agent identify the next packet without chat history
- could a fresh agent explain why the current sequence exists
- could a fresh agent answer what is blocked, what is accepted, and what is still open

If the answer is no, the state file is incomplete.
