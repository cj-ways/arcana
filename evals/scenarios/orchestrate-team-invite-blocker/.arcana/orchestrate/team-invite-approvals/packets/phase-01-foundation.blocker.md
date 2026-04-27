# Packet Blocker: phase-01-foundation

## Blocking Question
- Do pending invites consume a paid seat before approval or only after activation?

## Why It Blocks Progress
- The API contract and billing checks depend on this state transition.

## Evidence Reviewed
- `design.md`
- `docs/adr/ADR-012-invite-seats.md`

## Options Considered
- Option 1: reserve a seat at invite creation
- Option 2: consume a seat only after approval and activation

## Recommended Direction
- Recommendation: likely option 2, but the worker needs the orchestrator to confirm it before changing the billing guard.
- Confidence: medium
