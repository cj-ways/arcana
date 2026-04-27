# Team Invite Approvals — Orchestration State

## Feature Frame
- Slug: team-invite-approvals
- Objective: deliver invite approvals without billing drift
- Current phase: Phase 1 — Foundation
- Status: active

## Canonical Sources
- `design.md`
- `docs/adr/ADR-012-invite-seats.md`

## Locked Constraints
- Pending invites must not consume seats.
- Approval state must stay explicit.

## Decisions
- Decision: Phase 1 owns the state model, permission checks, and billing contract.
  - Why: Cross-surface work depends on these contracts staying stable.
  - Source: `design.md`

## Execution Strategy
- Dependency order: foundation first, then cross-surface follow-through
- Active packet budget: 1
- Safe parallelization opportunities: none until the billing and state contract is stable
- Highest-risk contract boundaries: seat consumption, approval state, admin override semantics

## Phase Plan
### Phase 1 — Foundation
- Goal: lock the state model, approval policy, and API contract
- Exit criteria: blocker-free implementation packet accepted
- Packets:
  - `phase-01-foundation`

## Active Packet
- Packet: `phase-01-foundation`
- Owner: worker session
- Input file: `.arcana/orchestrate/team-invite-approvals/packets/phase-01-foundation.input.md`
- Expected output file: `.arcana/orchestrate/team-invite-approvals/packets/phase-01-foundation.output.md`
- Expected blocker file: `.arcana/orchestrate/team-invite-approvals/packets/phase-01-foundation.blocker.md`
- Status: blocked
- Depends on: design and ADR clarity only
- Parallelizable with: none

## Open Blockers
- Blocker: seat timing during pending approval
- Packet: `phase-01-foundation`
- Status: open

## Review Gates
- Compare changed files against `CLAUDE.md`, design docs, and ADRs.
- Run `/deep-review` before packet acceptance.

## Next Actions
- Next orchestrator move: resolve the active blocker from source docs if possible
- Next user move: provide a decision only if docs are insufficient
