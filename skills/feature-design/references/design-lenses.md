# Design Lenses

Read this reference when the feature is high-risk, cross-surface, or easy to design too narrowly.

These are design lenses, not required headings. Use only the ones that materially affect the decision.

## Problem Fit
- Is the design solving the actual user problem?
- Is the proposed scope too large or too small for the stated goal?

## User And Operator Flow
- What changes for the end user?
- What changes for admins, support, or ops?
- Does the design create manual work that no one owns?

## States And Transitions
- What states exist?
- Who or what moves the workflow between them?
- What happens on partial completion, expiry, retries, or cancellation?

## Trust And Clarity
- What could confuse the user?
- Where could the system feel unfair, unsafe, or misleading?

## Permissions And Policy
- Who can do what?
- Are overrides, approvals, or audit trails required?
- Does the design create ambiguous ownership or privilege escalation?

## Data And Contracts
- What entities or fields change?
- Are downstream services or APIs affected?
- Does the design create eventual-consistency or idempotency concerns?

## Cross-Surface Alignment
- Does the same feature need matching behavior in admin, mobile, notifications, docs, or support tooling?
- Is one surface likely to contradict another?

## Rollout And Operability
- How will this be rolled out safely?
- What breaks if the rollout is partial?
- What will support or engineering need to debug it?

## Reversibility
- If the choice is wrong, how expensive is it to unwind?
- Can the design be phased, feature-flagged, or isolated?
