---
name: legacy-skill
description: "Reviews a code change quickly, then reports concrete issues and next steps."
allowed-tools: Read, Grep, Glob
effort: medium
disable-model-invocation: true
---

# Legacy Skill

## Gotchas

1. Avoid speculative findings without local evidence.
2. Keep the output tied to the changed files.

## Steps

1. Read the relevant files and isolate the changed area.
2. Validate each concern against the code before reporting it.
3. Prioritize only issues with concrete runtime or correctness impact.

## Validation

Re-read each finding and remove any point that is not grounded in the code.

## Output

- Summary
- Findings with evidence
- Concrete next steps
