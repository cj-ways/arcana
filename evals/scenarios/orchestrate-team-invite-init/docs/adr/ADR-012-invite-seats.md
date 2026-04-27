# ADR-012: Invite Seat Consumption

## Decision

Pending invites do not consume a paid seat.

Seat consumption begins only after the invite is approved and the user reaches the activated membership state.

## Why

- Billing must match actual granted access.
- Approval workflows need a reversible pending state.
- Support should not need manual seat reconciliation for expired or rejected invites.
