# Feature Audit Persistence

Read this reference only when the user wants the audit persisted into docs, roadmap files, or a durable artifact.

## Persistence Rules

- Only persist after the user confirms the audit direction.
- Follow the existing feature-doc structure if one already exists.
- Describe current behavior in docs and planned changes in roadmap files.
- Use simple product-language descriptions, not implementation internals.

## Suggested Feature Doc Set

```text
docs/features/<feature-name>/
  README.md
  overview.md
  user.md
  admin.md
  system.md
  notifications.md
  constraints.md
  boundaries.md
  roadmap.md
  todo.md
```

Use only the files that matter for the feature. Do not create empty paperwork.

## Writing Rules

- docs describe current state only
- roadmap holds planned changes
- every boundary needs a reason
- use tables for structured behavior when helpful
- dropped ideas keep their reasoning

## Roadmap Shape

```markdown
# <Feature Name> - Roadmap

> Last updated: YYYY-MM-DD

## Planned
## Completed
## Dropped
## Competitive Intelligence
## Audit History
```
