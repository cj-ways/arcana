# Arcana CLI — Capability Matrix

What works in Claude Code, Codex CLI, or only one host.

<!-- generated:CAPABILITIES_MATRIX:start -->
| Capability | Claude Code | Codex CLI | Notes |
| --- | --- | --- | --- |
| Install, list, inspect, import, update, and sync skills | Yes | Yes | Arcana CLI manages both hosts. Multi-agent mode keeps `.agents/skills/` canonical and mirrors skills to Claude Code. |
| Use shipped first-party and imported skills | Yes | Yes | Both hosts read installed skills from their own skills directory after `arcana init`, `add`, `import`, or `sync`. |
| Install shipped Arcana agent wrapper files | Yes | No | Arcana agents install to `.claude/agents/` only. Codex CLI does not have a separate agent directory. |
| Manual feedback capture, reports, and triage | Yes | Yes | `arcana feedback`, `feedback-report`, and `feedback-triage` are CLI features, not host-native UI integrations. |
| Manual transcript analysis with explicit consent | Yes | Yes | Requires an explicit transcript path. Arcana will not read conversation history automatically. |
| Automatic in-session feedback prompts | Yes | No | Implemented through Claude Code hooks via `arcana feedback-hooks install`. |
| Host-native hook/session integration | Yes | No | Current automation depends on Claude Code hook events and `transcript_path` support. |
| Live eval and trigger runners | Yes | No | Current eval harness shells out to Claude CLI. Codex parity would require a second runner. |
<!-- generated:CAPABILITIES_MATRIX:end -->

## Notes

- Arcana supports both hosts for core skill installation and usage, but it does not claim feature parity where the host APIs differ.
- `feedback-hooks` is intentionally Claude Code only because it depends on Claude hook events and transcript-path handoff.
- The current eval and trigger runners shell out to `claude`. Codex support in the live harness is still a separate follow-up, not implied by general CLI support.
