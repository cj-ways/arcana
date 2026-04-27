# Worker Files

## Contents
- Packet naming rules
- Input packet template
- Output file template
- Blocker file template
- Resume file template
- Launcher prompt rules

## Packet Naming Rules

Use one packet base name and keep every file derived from it:

```text
phase-01-foundation.input.md
phase-01-foundation.output.md
phase-01-foundation.blocker.md
phase-01-foundation.resume.md
```

`<phase>-<slug>` must stay stable for the life of that packet.

## Input Packet Template

```markdown
# Packet: <packet title>

## Launcher Prompt
Read <relative input path> and follow it exactly. Work at the effort specified here. Return only through the matching .output.md or .blocker.md file.

## Packet Metadata
- Feature:
- Phase:
- Packet:
- Recommended effort:
- Owner:
- Depends on:
- Parallelizable with:

## Objective
- Primary goal:
- Done means:

## In Scope
- Item:
- Item:

## Out Of Scope
- Item:
- Item:

## Do Not Touch
- File / boundary:
- File / boundary:

## Required Reads
- `CLAUDE.md`
- `feature spec path`
- `relevant code paths`
- `standards / ADR paths`

## Constraints
- Constraint:
- Constraint:

## Implementation Notes
- Existing pattern to follow:
- Files likely involved:
- Known risks:
- Delegation policy:

## Review Gates
- Run the packet review loop
- Compare changed files against `CLAUDE.md`, feature docs, standards, and ADRs
- Run local drift checks when available
- Run the required review skill(s)

## Return Contract
- On success: write `<packet>.output.md`
- On blocker: write `<packet>.blocker.md`
- Do not return the result only in chat
```

## Output File Template

```markdown
# Packet Output: <packet title>

## Status
- Completed / Partial / Needs follow-up

## Changed Files
- `path`
- `path`

## What Was Done
- Change:
- Change:

## Validation
- Tests / commands run:
- Evidence:

## Review Results
- Standards / ADR comparison:
- Drift check result:
- Review skill result:

## Risks Or Follow-Ups
- Risk:
- Follow-up:
```

## Blocker File Template

```markdown
# Packet Blocker: <packet title>

## Blocking Question
- Question:

## Why It Blocks Progress
- Impact:

## Evidence Reviewed
- `path`
- `path`

## Options Considered
- Option 1:
- Option 2:

## Recommended Direction
- Recommendation:
- Confidence:
```

## Resume File Template

```markdown
# Packet Resume: <packet title>

## Decision
- Decision:

## Why
- Source:
- Reasoning:

## Updated Constraints
- Constraint:

## Next Step
- Resume from:
- Deliver back through:
```

## Launcher Prompt Rules

Keep the launcher prompt short enough to paste cleanly:
- mention only the input file path
- tell the worker to follow that file exactly
- tell the worker to use the effort specified in the packet
- tell the worker to return only through the expected markdown files

The packet file itself carries the real detail. The launcher prompt should never restate the full packet body.

Do not paste the whole packet into chat if the file already exists.
