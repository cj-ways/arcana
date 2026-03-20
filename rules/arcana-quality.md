# Arcana Quality Standards

## Verify Before Output
Always verify findings against the actual codebase before presenting them. Run the quality checklist BEFORE outputting results, not after. A finding without evidence from code is not a finding.

## Gotchas Awareness
Before reporting an issue, check: does it already exist in the codebase? Is it an intentional pattern documented in CLAUDE.md? Is it a framework convention you're unfamiliar with? Read project context files first.

## No False Positives
A false positive is worse than a missed issue. When uncertain, do not report. Only flag issues you can point to a specific line or code fragment for.

## Confirm Before Executing
For destructive or large-scale operations, present a summary and get user confirmation before proceeding. Show what will change, how many files are affected, and any risks.
