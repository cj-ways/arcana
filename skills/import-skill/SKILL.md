---
name: import-skill
description: 'Adapts an imported or external agent skill to match Arcana quality standards — rewrites frontmatter, tone, structure, and adds missing sections. Run after `arcana import` or on any skill that needs quality adaptation. Manual via /import-skill.'
argument-hint: '<skill-name>'
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
effort: medium
---

# Import Skill — Quality Adaptation Pipeline

Adapts an existing skill to match Arcana's quality standards. Works on skills imported via `arcana import` or any skill already in the skills directory that needs quality improvement.

## Arguments

```
/import-skill <skill-name>
```

- `skill-name`: name of the skill directory to adapt (must exist in the installed skills directory)

If no argument, list all installed skills and ask which one to adapt.

## Gotchas

1. **Rewriting content changes meaning.** When fixing tone or restructuring, the original skill's logic can drift. After every rewrite pass, re-read the original and verify the adapted version preserves every capability, every edge case, and every decision point.
2. **"Add missing sections" can bloat the skill.** Not every skill needs Gotchas, not every skill needs edge case handling. A 50-line utility skill that lists files does not need a 20-line Gotchas section. Only add sections that genuinely improve the skill for its specific use case.
3. **Description rewriting can break triggers.** The description is the triggering mechanism. Changing keywords, removing aliases, or being too specific can cause the skill to stop triggering correctly. If the original description triggered well, preserve its key phrases even while fixing voice/format.
4. **allowed-tools must be verified, not guessed.** Read every line of the skill body. If it says "run `git diff`", it needs Bash. If it says "search the codebase", it needs Grep/Glob. Don't add tools the skill doesn't actually use, and don't miss tools it does use.

## Step 1: Locate and Read

1. Find the skill's SKILL.md in the installed skills directory
2. Read `SKILL-AUTHORING-REFERENCE.md` from the Arcana package root — this is the quality standard
3. Read the skill completely, including any supporting files in `references/`
4. Note the original source attribution comment if present (`<!-- Imported by Arcana from: ... -->`)

## Step 2: Audit Against Arcana Standards

Run every check below. Record PASS or NEEDS FIX for each.

### Frontmatter Checks

| Check | Rule | How to Verify |
|-------|------|--------------|
| `name` | Lowercase kebab-case, matches directory name, under 64 chars | Regex: `/^[a-z0-9]+(-[a-z0-9]+)*$/` |
| `description` | Third person, under 1024 chars, no XML tags, includes trigger phrases or has `disable-model-invocation: true` | Read it. Check voice. Count chars. |
| `argument-hint` | Present if skill accepts arguments | Search body for argument parsing |
| `allowed-tools` | Comma-separated, lists every tool the skill uses | Read every step, match tools to declarations |
| `disable-model-invocation` | `true` if skill has side effects (writes files, runs commands, launches agents) | Search for Write, Edit, Bash, Agent in the body |
| No unsupported fields | Only: name, description, argument-hint, disable-model-invocation, user-invocable, allowed-tools, effort | Compare against list |

### Content Checks

| Check | Rule | How to Verify |
|-------|------|--------------|
| Tone | Third-person imperative throughout | Search for "I ", "you ", "we ", "my ", "your " |
| Line count | Under 500 lines | Count lines |
| Structure | Clear phases/steps with numbered sequence | Skim headers — should follow a logical flow |
| Output format | Specifies what the user sees at the end | Search for output template or example |
| Edge cases | Handles: empty results, missing files, user cancellation | Search for error handling guidance |
| Hardcoded paths | No absolute paths, no project-specific paths | Search for `/Users/`, `/home/`, `C:\`, specific project names |
| Gotchas | Present near top if skill has non-obvious failure modes | Only required if there ARE gotchas — don't add empty ones |

### Quality Checks

| Check | Rule | How to Verify |
|-------|------|--------------|
| Affirmative framing | "Always do X" preferred over "Don't do Y" | Count negative vs positive rules |
| CAPS emphasis | At most 2-3 ALWAYS/NEVER in caps | Count caps directives |
| Examples | At least one concrete example for non-trivial skills | Search for code blocks or example sections |
| Validation | "Do → validate → fix" pattern where applicable | Check if steps include verification |

## Step 3: Present Assessment

Show the user:

```
## Adaptation Assessment: <skill-name>

**Source:** <original source from attribution comment>
**Lines:** <count> | **Frontmatter:** <PASS/FAIL> | **Tone:** <PASS/NEEDS FIX>

### Checks

| Category | Check | Status | Detail |
|----------|-------|--------|--------|
| Frontmatter | name | PASS | ... |
| Frontmatter | description | NEEDS FIX | Uses first person |
| Content | tone | NEEDS FIX | 12 instances of "you should" |
| Content | line count | PASS | 340 lines |
| Quality | gotchas | NEEDS FIX | Has 3 non-obvious failure modes, no Gotchas section |
| ... | ... | ... | ... |

### Proposed Changes

1. Rewrite description to third person, add trigger phrases
2. Convert 12 "you should" → imperative form
3. Add Gotchas section with 3 items
4. Add allowed-tools: Read, Grep, Glob, Bash
5. Move reference tables to references/api-patterns.md (currently 480 lines, would be 310 after split)

**Proceed with these adaptations?**
```

WAIT for user confirmation before making any changes.

## Step 4: Adapt

Apply each proposed change. For each change:

1. Make the edit
2. Re-read the affected section
3. Verify the original intent is preserved

### Adaptation order (do in this sequence):

1. **Fix frontmatter** — name, description, allowed-tools, effort
2. **Fix tone** — batch-convert first/second person to third-person imperative
3. **Restructure if needed** — reorder sections per Arcana convention (Quick Start → Gotchas → Steps → Output → Rules)
4. **Add missing sections** — only sections that genuinely add value
5. **Split if over 500 lines** — extract reference material to `references/`
6. **Fix emphasis** — reduce CAPS to 2-3 critical rules max
7. **Remove hardcoded content** — absolute paths, project-specific assumptions

After all adaptations, show the user the complete adapted skill for final review.

## Step 5: Verify

After user confirms the final version:

1. Write the adapted SKILL.md
2. Run `node bin/arcana.js info <skill-name>` to verify it parses correctly
3. Run `node bin/arcana.js list` to verify it appears
4. Report the final line count and confirm it's under 500

## Rules

- NEVER modify a skill without user approval of the proposed changes
- NEVER change the skill's core logic or capabilities — only adapt packaging and quality
- ALWAYS read SKILL-AUTHORING-REFERENCE.md before auditing
- ALWAYS present the assessment table before making changes
- ALWAYS re-read original content after each rewrite to verify intent is preserved
- ALWAYS verify the adapted skill parses correctly via `arcana info`
- If the skill is under 50 lines and too vague to be useful, tell the user honestly
- Preserve the source attribution comment
- When splitting to references/, the main SKILL.md must remain self-contained for the core workflow
