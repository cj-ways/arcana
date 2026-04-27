# Team Invite Approvals — Orchestration State

## Feature Frame
- Slug: team-invite-approvals
- Objective: deliver invite approvals without billing drift
- Current phase: Phase 1 — Foundation
- Status: awaiting acceptance

## Canonical Sources
- `CLAUDE.md`
- `design.md`

## Locked Constraints
- Pending invites must not consume seats.
- Cross-surface completion follows foundation acceptance.

## Execution Strategy
- Dependency order: finish foundation contract first, then open the cross-surface packet
- Active packet budget: 1
- Safe parallelization opportunities: none yet because phase 2 depends on accepted foundation behavior
- Highest-risk contract boundaries: approval state, seat reservation, admin override semantics

## Phase Plan
### Phase 1 — Foundation
- Goal: lock state transitions and the approval contract
- Exit criteria: foundation packet accepted
- Packets:
  - `phase-01-foundation`

### Phase 2 — Cross-Surface Completion
- Goal: wire admin, notifications, and acceptance surfaces
- Exit criteria: remaining surfaces match the approved contract
- Packets:
  - `phase-02-cross-surface`

## Active Packet
- Packet: `phase-01-foundation`
- Owner: worker session
- Input file: `.arcana/orchestrate/team-invite-approvals/packets/phase-01-foundation.input.md`
- Expected output file: `.arcana/orchestrate/team-invite-approvals/packets/phase-01-foundation.output.md`
- Status: ready for acceptance
- Depends on: design approval only
- Parallelizable with: none

## Completed Packets
- None yet

## Review Gates
- Compare changed files against `CLAUDE.md` and `design.md`.
- Run `/deep-review` before acceptance.

## Next Actions
- Next orchestrator move: validate the completed foundation packet and open the next packet
- Next user move: hand the next packet to a worker session once written
