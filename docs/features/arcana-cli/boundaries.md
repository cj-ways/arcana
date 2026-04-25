# Arcana CLI — Boundaries

What Arcana does NOT do, and why.

## Not a Marketplace

Arcana does not publish skills to external registries. `import-skill` is the bridge for bringing external skills in.

**Why:** Quality control. Arcana's skills are hand-authored against SkillsBench data.

## Not a Universal Agent Manager

Supports Claude Code and Codex CLI only.

**Why:** Focus. Two agents done well beats five done poorly.

## No Enterprise Features

No SSO, SCIM, team management, or private registries.

**Why:** Wrong stage. Single-maintainer project focused on skill quality.

## No Silent Telemetry

No automatic remote usage collection, transcript upload, or hidden analytics.

Local-first feedback storage and optional transcript analysis are allowed only through explicit user action or opt-in.

**Why:** Trust matters more than data volume at Arcana's current stage.

## Not an Implicit Trust Transfer Layer

Imported skills can be convenient, but Arcana does not treat them as first-party just because they were installed through `arcana import`.

Imported skills keep their own local provenance metadata, trust state, and overwrite review flow.

**Why:** Safe adoption of outside skills requires clear source tracking and explicit overwrite decisions.

## No Auto-Generated Skills

All shipped skills are manually authored.

**Why:** SkillsBench: self-generated skills = -1.3pp. Hand-authored = +16.2pp.

## No Windows Support

Unix paths only (macOS and Linux).

**Why:** Target audience uses macOS/Linux.
