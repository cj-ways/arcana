# Claude Code Agent Best Practices Snapshot

- Review agents should be read-only by default. Avoid `Write`, `Edit`, or broad shell access unless the agent explicitly implements code.
- Review agents should prefer `context: fork` so large repos do not overload every review prompt.
- Rules must not conflict. If one rule says to always use subagents for reviews and another forbids subagents, the conflict should be called out explicitly.
- The audit report should include a score, concrete file references, and a priority-ordered implementation plan.
