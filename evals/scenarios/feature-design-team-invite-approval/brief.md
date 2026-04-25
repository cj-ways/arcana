# Team Invite Approval - Feature Brief

Product context:
- B2B analytics platform with shared workspaces
- current roles: owner, admin, member
- current behavior: admins can invite teammates by email, and invited users gain access immediately after accepting

Problem:
- enterprise customers want more control over who gets access
- they want designated approvers to review new invites before workspace access becomes active
- collaboration still needs to stay reasonably fast for normal teams

Surfaces involved:
- admin web app
- invite email
- acceptance screen for the invited user
- workspace membership state shown in the product
- audit log and notifications

Goal:
- design a feature that supports invite approval before access is activated
- preserve trust and clarity for both admins and invited users
- keep the design realistic for an existing product, not a greenfield rewrite

Out of scope:
- full role-system redesign
- SSO redesign
- implementation details or code changes
