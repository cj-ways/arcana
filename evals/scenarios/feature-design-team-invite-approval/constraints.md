# Constraints

- Seat billing should increase only when access becomes active, not while an invite is pending approval.
- Invites currently expire after 7 days. The design should account for expiry behavior.
- The product already has an audit log, and approval actions must be recorded there.
- Support needs a manual override path for exceptional cases.
- Mobile clients read membership status but do not have admin management tools.
- Notifications already exist for invites and removals; approval-related messaging should fit this ecosystem.
- Do not implement anything in this scenario. Only produce the design memo.
