---
name: import-skill
description: 'Imports an external agent skill from a GitHub repo, URL, or local path, then adapts it to match Arcana quality standards (frontmatter, tone, structure, triggers). Manual via /import-skill.'
argument-hint: '<source> [skill-name]'
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
effort: low
---

# Import Skill — Adapt External Skills to Arcana Standards

Takes a skill from any source (GitHub, URL, local path) and adapts it to match Arcana's quality standards before adding it to the collection.

**Input:** `$ARGUMENTS` — the source to import from + optional skill name.

Examples:
```
/import-skill https://github.com/anthropics/skills/tree/main/skills/frontend-design
/import-skill ./my-local-skill
/import-skill trailofbits/skills security-audit
```

---

## Step 1: Fetch the Source

Parse `$ARGUMENTS` to determine source type:

| Pattern | Action |
|---------|--------|
| `https://github.com/...` | Clone or fetch the SKILL.md via raw URL |
| `owner/repo [skill-name]` | Fetch from `https://raw.githubusercontent.com/owner/repo/main/skills/{skill-name}/SKILL.md` |
| `./local-path` | Read from local filesystem |
| URL ending in `.md` | Fetch directly |

If the source is a repo without a skill name, list available skills and ask the user which one to import.

Read the source SKILL.md completely. If it has supporting files (references/, templates/, scripts/), note them.

---

## Step 2: Analyze Against Arcana Standards

Read the Arcana authoring reference at `SKILL-AUTHORING-REFERENCE.md` in the package root. Then audit the imported skill against these mandatory checks:

### Frontmatter Audit

| Check | Rule |
|-------|------|
| `name` | Must be lowercase kebab-case |
| `description` | Must be third person. Under 300 chars. No XML tags. Include trigger phrases ("Use when...") OR set `disable-model-invocation: true` |
| `argument-hint` | Required if skill accepts arguments |
| `allowed-tools` | Required — declare every tool the skill uses |
| `disable-model-invocation` | Required `true` if skill has side effects (creates files, runs commands, launches agents) |
| No unsupported fields | Only use: name, description, argument-hint, disable-model-invocation, user-invocable, allowed-tools, model, context, agent, hooks |

### Content Audit

| Check | Rule |
|-------|------|
| Tone | Third-person imperative. "Extract the data..." not "You should extract..." |
| Line count | Under 500 lines. If over, split into SKILL.md + references/ |
| Structure | Clear workflow with numbered steps or phases |
| Output format | Must specify what the user sees after the skill runs |
| Edge cases | Must handle: empty results, missing files, user cancellation |
| Read-only declaration | If the skill doesn't write files, state "NEVER modify any files" in Rules |
| Hardcoded paths | No absolute paths. No project-specific paths. |
| Tool restrictions | Must match `allowed-tools` in frontmatter |

### Quality Signals

| Check | Rule |
|-------|------|
| Gotchas section | High-value — include one if the skill has non-obvious behavior |
| Examples | At least one concrete example for non-trivial behavior |
| Validation loop | "Do → validate → fix" pattern preferred over "do once" |
| Affirmative framing | "Always do X" preferred over "Don't do Y" (higher LLM adherence) |
| Critical rules emphasis | Reserve ALL CAPS for at most 2-3 truly critical rules |

---

## Step 3: Present Assessment

Show the user a summary table:

```
## Import Assessment: <skill-name>

| Check | Status | Detail |
|-------|--------|--------|
| Frontmatter | PASS/FAIL | ... |
| Description | PASS/NEEDS FIX | ... |
| Tone | PASS/NEEDS FIX | ... |
| Structure | PASS/NEEDS FIX | ... |
| Line count | PASS/OVER LIMIT | ... |
| Edge cases | PASS/MISSING | ... |

Proposed changes:
1. [What will be changed]
2. [What will be changed]
...
```

Ask the user: "Proceed with these adaptations?"

---

## Step 4: Adapt the Skill

Apply all fixes:

1. **Rewrite frontmatter** to match Arcana conventions
2. **Rewrite description** — third person, trigger phrases, under 300 chars
3. **Fix tone** — convert any first/second person to third-person imperative
4. **Add missing sections** — output format, edge cases, rules
5. **Remove project-specific content** — hardcoded paths, framework-specific assumptions
6. **Add `allowed-tools`** if missing
7. **Split if over 500 lines** — move reference material to references/

Preserve the original skill's core logic and intent. Only change the packaging.

---

## Step 5: Write to Arcana

1. Create `skills/<skill-name>/SKILL.md` in the Arcana package directory
2. If the skill has supporting files, create `skills/<skill-name>/references/`
3. Show the final adapted skill to the user for review
4. After confirmation, write the file

---

## Step 6: Update CLI Registration

The Arcana CLI discovers skills dynamically from the `skills/` directory, so no code changes are needed. Verify by running:

```bash
node bin/arcana.js info <skill-name>
node bin/arcana.js list
```

Confirm the new skill appears in both commands.

---

## Rules

- NEVER add a skill without user approval of the adaptation
- NEVER modify the Arcana CLI source code — skills are auto-discovered
- ALWAYS read SKILL-AUTHORING-REFERENCE.md before assessing
- ALWAYS present the assessment table before making changes
- ALWAYS verify the imported skill works after writing (run `info` and `list`)
- If the source skill is over 500 lines, split into core SKILL.md + references/
- If the source skill is under 50 lines and too vague to be useful, tell the user honestly
- Preserve the original skill's core logic — only change packaging and quality
- Attribution: add a comment at the top noting the original source
