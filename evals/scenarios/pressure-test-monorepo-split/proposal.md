# Proposal: Split Arcana Into Multiple npm Packages Next Sprint

Arcana has grown enough that we should split it immediately into:

- `@arcana/cli`
- `@arcana/skills`
- `@arcana/evals`
- `@arcana/feedback`

## Why I Want This

- Smaller packages feel cleaner.
- Contributors could focus on one package at a time.
- We might get faster installs.
- Boundaries would look more professional.

## Execution

- Do the split before the next feature wave so we do not have to move more files later.
- Publish all packages separately and keep them versioned together for now.
- Move the docs into each package that owns the code.
