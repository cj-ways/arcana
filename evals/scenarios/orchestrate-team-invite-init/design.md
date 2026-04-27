# Team Invite Approvals Design

## Goals
- Require approval for invited users before they can join sensitive workspaces.
- Preserve a clean admin override path.
- Keep the flow auditable and reversible.

## Key Rules
- A pending invite must not consume a paid seat.
- Approval state must remain explicit in API and admin surfaces.
- Expired requests should close automatically after 7 days.
- The first delivery phase should focus on contracts, state transitions, and permission enforcement.

## Cross-Surface Notes
- The backend API owns state transitions.
- Admin needs an override view.
- Invite emails and the acceptance screen must reflect the pending state clearly.
