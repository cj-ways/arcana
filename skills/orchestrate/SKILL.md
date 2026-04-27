---
name: orchestrate
description: 'Orchestrate large feature implementation across phases and manual worker sessions: persist canonical state, write worker packet files, resolve blockers, and enforce review gates before phase closure. Use when a feature is too large or risky for one clean implementation session. Do not use for small direct changes, root-cause debugging, or feature design. Manual via /orchestrate.'
argument-hint: "<feature-or-initiative>"
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Agent, Write, AskUserQuestion
effort: max
phase: implement
feedback-profile: execution
catalog-order: 38
---

# /orchestrate
Orchestrate large feature delivery when one implementation session is not enough. The orchestrator owns scope control, packetization, persisted state, blocker resolution, acceptance, and review gates. It does not default to becoming the main coder. For initial packetization, blocker resolution, acceptance, and replanning, ultrathink before acting.

The job is to turn a large feature into a controlled delivery loop:
- read the brief, audit, design, and repo constraints
- persist the canonical plan in markdown so compaction loses nothing
- write clean worker packet files for manual agent sessions
- ingest worker outputs and blockers
- update the plan, answer what can be answered confidently, and ask the user only when a decision really needs them

## When To Use /orchestrate vs Nearby Skills

| Skill | Use it for | Do not use it for |
| --- | --- | --- |
| `/orchestrate` | Large feature implementation that needs phases, worker packets, persisted state, blocker handling, and review gates | Small direct coding tasks, root-cause debugging, or deciding how the feature should work |
| `/feature-design` | Deciding how one feature or workflow should work before implementation | Multi-phase delivery orchestration after the design is already stable |
| `/feature-audit` | Broad diagnosis of what is weak, missing, risky, or highest-leverage in a feature | Running the delivery program for an already chosen feature |
| `/deep-fix` | Proving and fixing one bug with a regression-safe workflow | Breaking down a large feature into worker packets |
| `/refactor-plan` | Structural change sequencing across existing code | Product-feature delivery with user-facing scope, blockers, and acceptance loops |
| `/generate-tests` | Writing tests for one file or target | Managing an end-to-end feature rollout |

## Arguments

```text
/orchestrate <feature-or-initiative>
```

Accepted forms:
- `/orchestrate team invite approvals`
- `/orchestrate subscription recovery rollout`
- `/orchestrate enterprise permissions phase 2`

If no feature is provided, ask what initiative should be orchestrated.

## Progressive Disclosure

Keep the main loop lean. Load references only when needed:
- Read [references/orchestrator-state.md](references/orchestrator-state.md) when initializing or updating the canonical state file.
- Read [references/worker-files.md](references/worker-files.md) when writing `.input.md`, `.resume.md`, `.output.md`, or `.blocker.md` contracts.
- Read [references/review-loop.md](references/review-loop.md) when defining packet review gates or evaluating worker completion quality.

## Gotchas

1. **Trying to orchestrate a small task.** If one focused implementation session can finish the work safely, do not force orchestration theater.
2. **Letting chat become the source of truth.** Any decision that changes scope, sequencing, standards, ownership, or blocker status must be written into `orchestrator.state.md` immediately.
3. **Writing packets that are too broad.** One packet should have one clear owner, one clear deliverable, and a bounded review surface.
4. **Trusting worker output blindly.** Read the output file, then inspect the actual changed files or diff before accepting completion.
5. **Using workers to answer product ambiguity.** If the blocker is product or scope ambiguity, either resolve it from source docs/state or ask the user. Do not dump ambiguity onto a worker.
6. **Opening too many active packets.** Default to one active packet. Use parallel packets only when ownership and write scope are clearly disjoint.
7. **Skipping review gates.** Large feature work drifts fastest at packet boundaries. Review is part of the packet, not an optional afterthought.
8. **Turning the orchestrator into the implementer by default.** The orchestrator owns coordination, acceptance, and recovery. It should only implement directly if the user explicitly chooses that tradeoff.

## Rules

1. Operate at the highest deliberate orchestration depth the host supports. Prefer `max`; if the host does not support it, fall back to the highest available effort. Be conservative, explicit, and evidence-driven.
2. Ask one focused question only when the answer would materially change packetization, sequencing, ownership, or acceptance.
3. Persist before moving on. If the thread were compacted right now, the next agent should recover from the markdown state file without guessing.
4. Use the repo's documented constraints first: `CLAUDE.md`, feature docs, ADRs, standards, and local project rules outrank chat assumptions.
5. Default to one active worker packet. Open a second or third only when the write scopes are clearly independent.
6. Every packet must define scope, required reads, acceptance checks, return files, and review gates.
7. Every blocker must resolve to one of three outcomes: `resume written`, `user decision needed`, or `packet should be replanned`.
8. Do not close a packet from the worker's report alone. Accept it only after reading the real output and checking the changed surface against the packet contract.
9. Use Claude subagents only for bounded, self-contained discovery or review tasks whose verbose output should stay out of the main context.
10. Keep the main conversation summary-only. Persist state to files, and avoid re-pasting packet bodies, large diffs, or old worker outputs into chat.

## Canonical Filesystem Layout

Use this layout unless the repo already has a clearly better project-local convention:

```text
.arcana/orchestrate/<feature-slug>/
  orchestrator.state.md
  packets/
    phase-01-foundation.input.md
    phase-01-foundation.output.md
    phase-01-foundation.blocker.md
    phase-01-foundation.resume.md
```

Naming rules:
- `orchestrator.state.md` is the single source of truth for current feature state.
- Packet base names use `phase-<nn>-<slug>`.
- `.input.md` and `.resume.md` are written by the orchestrator.
- `.output.md` and `.blocker.md` are written by worker sessions.

Use `packets/` instead of `handoffs/` because these files are not one-directional handoffs. They are the durable packet record for orchestrator requests, worker returns, blockers, and resumes.

## Workflow

### 1. Confirm orchestration is justified
Use `/orchestrate` only when at least one of these is true:
- the feature spans multiple modules, surfaces, or phases
- the work needs persistent coordination across sessions
- blockers or product decisions are likely to appear mid-flight
- review and acceptance need stronger control than one direct coding thread

If the work is actually small:
- say so directly
- recommend a simpler path instead of pretending orchestration adds value

### 2. Load the real source context
Read enough context to orchestrate against reality:
1. `CLAUDE.md` or `claude.md`
2. feature brief, design spec, or audit docs
3. relevant standards, ADRs, and rollout notes
4. project-local drift or standards skills if they exist
5. the smallest code/config surface needed to understand boundaries

If a source doc exists, prefer it over reconstructing the same intent from chat.

### 3. Ask only the highest-leverage questions
Ask a follow-up only when the answer changes:
- packet boundaries
- sequencing
- owner assignment
- acceptance criteria
- rollout scope

Good examples:
- which surfaces are in scope for this delivery phase
- whether backward compatibility is mandatory
- whether parallel packets are allowed

Bad examples:
- cosmetic preferences that do not affect the packet plan
- questions already answered by source docs

### 4. Initialize or resume the canonical state
If no state file exists yet:
- create `.arcana/orchestrate/<feature-slug>/orchestrator.state.md`
- load [references/orchestrator-state.md](references/orchestrator-state.md)
- write the feature frame, sources, constraints, decisions, execution strategy, phase plan, active packet slot, and open questions

If a state file already exists:
- resume from it instead of regenerating everything
- reconcile any new docs, user answers, or worker files into the existing state
- keep previous decisions unless new evidence overrides them explicitly
- summarize accepted packets into the state so older packet files do not need to be reread unless there is a dispute or regression

### 5. Split the work into packets
Each packet must be:
- self-contained enough for a worker to execute independently
- narrow enough that acceptance is clear
- explicit about what is in and out of scope
- safe to review without reading the entire feature history

Before opening packets, write the execution strategy into the state:
- dependency order
- safe parallelization opportunities
- active packet budget
- highest-risk contract boundaries

Parallelization policy:
- `1 active packet` by default
- `2 active packets` only when write scopes are disjoint and neither depends on the other's output
- `3 active packets` only for leaf work such as docs, notifications, or UI follow-through after core contracts are already locked

Do not parallelize:
- shared contract changes and their consumers
- schema changes and downstream implementation at the same time
- auth, billing, or state-machine work with dependent UI/API packets

Use Claude subagents for planning support only when the work is self-contained, such as:
- implementation inventory for one bounded surface
- extracting repo standards or ADR constraints
- checking whether two candidate packets truly have disjoint write scopes

Do not use subagents for the long-lived implementation packets themselves. The user-facing manual worker session remains the main execution path because it preserves ownership and clean return files.

Default packetization order:
1. foundations and contracts
2. main implementation slices
3. cross-surface completion work
4. rollout, cleanup, and documentation closure

Do not open parallel packets if they touch the same files or contracts.

### 6. Write the worker packet files
For the next active packet:
- load [references/worker-files.md](references/worker-files.md)
- write the `.input.md`
- include the exact return file names the worker must use
- include a short launcher prompt the user can paste into the worker session
- set the recommended worker effort
- specify dependencies, prohibited files or boundaries, and whether parallel siblings exist

Default worker effort:
- `max` for ambiguous, cross-cutting, or high-risk packets
- `high` only when the packet is narrow but still substantial

The launcher prompt should stay short. Example shape:

```text
Read .arcana/orchestrate/<feature-slug>/packets/phase-01-foundation.input.md and follow it exactly. Work at the effort specified there. Return only through the matching .output.md or .blocker.md file.
```

### 7. Handle blockers
When the user points to a `.blocker.md` file:
1. read the blocker
2. read the current state
3. read any source docs or code the blocker cites
4. resolve it from evidence if confidence is high
5. write the matching `.resume.md` if it can be answered confidently
6. update the state with the decision, rationale, and resumed status

If confidence is not high:
- ask the user the smallest question that unblocks the packet
- update the state with the pending decision

Do not trigger a full replanning pass for a narrow blocker unless the blocker proves the packet boundary was wrong.

### 8. Accept worker output
When the user points to a `.output.md` file:
1. read the output
2. inspect the real changed surface or cited files instead of trusting the report alone
3. read [references/review-loop.md](references/review-loop.md)
4. verify the packet met its review gates
5. update `orchestrator.state.md`
6. either close the phase, open the next packet, or send the packet back with a new `.resume.md`

If the packet is incomplete but recoverable, do not rewrite the whole plan. Write the smallest resume file that gets the worker moving again.

When a packet is accepted:
- summarize its verified outcome in the state
- record remaining risks or follow-ups
- avoid rereading its full output in future turns unless new evidence contradicts it

### 9. Close the phase or feature
A phase is only closed when:
- its packets are accepted
- review gates are satisfied
- open blockers are either resolved or deliberately deferred
- the next phase is clearly framed

The feature is only closed when:
- the final state file records completed phases, remaining follow-ups, and release/readiness notes
- no active packet is left ambiguous
- the user can hand the feature off without relying on chat history

## Chat Output

When writing or updating orchestration artifacts, respond with:
- which files were created or updated
- the current phase status in one short paragraph
- the exact launcher prompt for the next worker, if one was written
- one user question only if a real decision is blocking the next step

Do not dump the full packet contents into chat when the file already contains them.

## Context And Cost Control

This skill should stay expensive in reasoning quality, not expensive in needless context growth.

Default cost discipline:
- keep chat responses short once files exist
- write the canonical detail into files, not back into chat
- keep only the active packet, current phase summary, and hard constraints in immediate working context
- use bounded read-only subagents when a discovery task would otherwise flood the main conversation
- avoid reopening old packet files if their accepted result is already summarized in the state
- prefer one clarifying question over a speculative multi-packet replan

If the feature grows very large:
- persist the latest state before any likely compaction point
- continue from the state file rather than trying to preserve everything in chat
- treat the state file as the recovery artifact, not the conversation transcript

## Validation

Before ending a turn:
- confirm `orchestrator.state.md` exists and reflects the latest material decisions
- confirm active packet names, return file names, and launcher prompt all match
- confirm packet scope is narrow enough for one worker to execute cleanly
- confirm review gates cite the real project standards and local drift checks when available
- confirm no accepted packet was trusted purely from summary text without checking the real surface
- confirm the orchestrator stayed in coordination mode rather than silently turning into the main implementer
