# Review Loop

## Contents
- Required checks for every packet
- When to require deep review
- Drift and standards checks
- Acceptance rules

## Required Checks For Every Packet

Every packet completion must include:
1. direct comparison of changed files against the packet scope
2. direct comparison against `CLAUDE.md`
3. direct comparison against relevant feature docs, standards docs, and ADRs
4. one explicit review skill pass
5. written review results in the packet output file

## Review Skill Policy

Default policy:
- run `/quick-review` for every packet completion
- run `/deep-review` for any packet that is multi-file, shared-contract, infra, auth, schema, migration, concurrency, or cross-surface work
- run `/deep-review` before closing the final feature phase even if earlier packets only required `/quick-review`

If the project has a stronger local rule, follow the local rule.

## Drift And Standards Checks

If the repo has a local drift or standards skill, include it in the packet review gates.

Discovery order:
1. `.claude/skills/drift-check/`
2. `.agents/skills/drift-check/`
3. other clearly named local standards-check or architecture-check skills

When present, the worker should compare the changed files against:
- `CLAUDE.md`
- project standards docs
- ADRs
- feature docs or rollout docs that define the target behavior

If a worker uses Claude subagents during its own packet execution:
- keep them read-only unless the packet explicitly grants disjoint ownership
- use them for inventory, standards extraction, or review, not for uncontrolled overlapping edits
- do not let a review subagent become the hidden source of acceptance; the worker still owns the final packet output

## Acceptance Rules

A packet is not accepted just because the worker says it is done.

Accept only when:
- the output file is present and complete
- the changed surface matches the packet contract
- review gates are satisfied
- no blocker was hidden in the output summary
- any follow-up risk is either deferred deliberately or turned into a next packet
