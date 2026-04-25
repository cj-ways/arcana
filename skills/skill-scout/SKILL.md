---
name: skill-scout
description: 'Scouts major skill providers for skills that match the current project — fetches catalogs, analyzes the codebase, cross-matches, and recommends with evidence. Critical assessment, not a dump of everything available. Manual via /skill-scout.'
argument-hint: '[focus: all|security|testing|workflow|ops]'
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Agent, WebSearch, WebFetch
effort: high
phase: utility
feedback-profile: advisory
catalog-order: 150
---

# Skill Scout — Find Skills Your Project Actually Needs

Searches major agent skill providers, analyzes the current codebase, and recommends skills that fill real gaps. Critical assessment — only recommends skills with defensible value.

## Arguments

```
/skill-scout [focus]
```

- `all` (default) — full scan across all categories
- `security` — focus on security, secrets, vulnerability skills
- `testing` — focus on testing, coverage, quality skills
- `workflow` — focus on CI/CD, deployment, PR workflow skills
- `ops` — focus on monitoring, logging, infrastructure skills

## Gotchas

1. **Recommending skills the project already covers.** Before recommending anything, check what's already installed in `.claude/skills/`, `.agents/skills/`, and Arcana's built-in skills. A recommendation for "create PR descriptions" when `create-pr` is already installed is a waste.
2. **Confusing "relevant stack" with "actually useful."** A React testing skill is relevant to a React project — but if the project already has 95% test coverage with a working setup, it adds no value. Match against GAPS, not just stack.
3. **Recommending low-quality skills.** A 30-line skill with no frontmatter, no steps, and vague instructions will hurt more than help. Read the full content before recommending — quality matters more than coverage.
4. **Over-recommending.** If the project is well-covered, say so. "Your project doesn't need additional skills right now" is a valid and valuable conclusion. Aim for 2-5 recommendations max.

## Step 1: Fetch Skill Catalogs (parallel)

Launch parallel agents to fetch skill inventories from major providers. For each provider, fetch the `skills/` directory listing via GitHub API and extract name + description from each SKILL.md frontmatter.

**Provider list:**

| Provider | Repo | Why |
|----------|------|-----|
| Anthropic | `anthropics/skills` | Official Claude skills, high quality |
| OpenAI | `openai/skills` | Official Codex skills |
| Google | `google-gemini/gemini-skills` | Official Gemini skills |
| Vercel | `vercel-labs/skills` | Curated community skills |

**For each provider, use this agent prompt:**

```
Fetch the skill catalog from GitHub repo {owner}/{repo}.

1. Run: curl -sL "https://api.github.com/repos/{owner}/{repo}/contents/skills"
2. For each directory in the response, fetch the SKILL.md frontmatter:
   curl -sL "https://raw.githubusercontent.com/{owner}/{repo}/main/skills/{name}/SKILL.md" | head -20
3. Extract: name, description (first 200 chars), line count
4. Return a table: | Skill | Description | Lines | Provider |
```

If a provider's repo doesn't exist or has no `skills/` directory, skip it silently.

Also search for popular community skill repos:
- WebSearch: `"agent skills" site:github.com SKILL.md {detected-stack}`
- Check top results for repos with 50+ stars

Compile all findings into a single **catalog** — a list of available skills with: name, description, provider, line count.

## Step 2: Analyze the Codebase (parallel with Step 1)

While fetching catalogs, analyze the current project:

### Stack Detection
- Read `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `Gemfile`, etc.
- Identify: language, framework, database, ORM, API style, deployment target

### Existing Skills Audit
- List all installed skills: `.claude/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md`
- Read each installed skill's description
- List Arcana built-in skills (run `node bin/arcana.js list` or check `skills/` in package)

### Gap Analysis
Identify areas NOT covered by existing skills:
- Does the project have security scanning? (check for security-related skills/tools)
- Does it have test generation? (check for test skills + existing test infrastructure)
- Does it have deployment automation? (check for deploy/CI skills)
- Does it have code review? (check for review skills)
- Does it have documentation generation? (check for doc skills)
- What's unique about this project's stack that might need specialized skills?

## Step 3: Cross-Match

For each skill in the catalog, evaluate:

| Criterion | Question | Weight |
|-----------|----------|--------|
| Stack match | Does this skill's purpose align with the project's tech stack? | High |
| Gap fill | Does it cover an area not handled by existing skills? | Critical |
| Redundancy | Does it overlap with an already-installed skill? | Disqualify if >80% overlap |
| Quality signal | Is the description specific? Does it have >50 lines? Does it have frontmatter? | Medium |
| Focus match | If user specified a focus area, does this skill match it? | High (if focus specified) |

**Filtering rules:**
- DISCARD if the skill's stack doesn't match (React skill for a Go project)
- DISCARD if an installed skill already covers the same area
- DISCARD if the skill description is too vague to assess (<30 chars)
- KEEP if it fills a genuine gap with clear stack alignment
- KEEP if it covers a unique aspect of the project's domain

Target: 3-8 candidates after filtering.

## Step 4: Deep Assessment (sequential)

For each candidate that passed filtering:

1. **Fetch the full SKILL.md** — `curl -sL {raw_url}`
2. **Read it completely**
3. **Assess quality:**
   - Has proper frontmatter (name, description)?
   - Has clear steps/workflow?
   - Has edge case handling?
   - Has output format?
   - Under 500 lines?
   - Uses affirmative framing?
   - Would it work with the project's specific setup?

4. **Assess value for THIS project:**
   - What specific gap does it fill?
   - What would the user gain that they don't have today?
   - Is the gain worth the token cost of loading this skill?
   - Could the user achieve the same result with existing tools + a simple prompt?

5. **Rate: RECOMMEND / MAYBE / SKIP**
   - RECOMMEND: fills a clear gap, high quality, specific value
   - MAYBE: useful but overlaps partially or quality is middling
   - SKIP: low quality, redundant, or marginal value

## Step 5: Present Recommendations

Present findings ONE AT A TIME (not a batch dump).

For each RECOMMEND or MAYBE skill:

```
### [skill-name] from [provider]

**What it does:** [1-2 sentence summary]
**Why your project needs it:** [specific evidence from codebase analysis]
**Quality:** [assessment — good/fair/needs-adaptation]
**Gap it fills:** [what's not covered today]
**Overlap with existing:** [none / partial with X]

Rating: RECOMMEND / MAYBE

To import: `arcana import {owner}/{repo} {skill-name}`
```

After presenting each recommendation, ask the user:
- **Import it?** → provide the `arcana import` command
- **Skip it?** → move to next
- **More detail?** → show the full skill content

## Step 6: Summary

After all recommendations are discussed:

```
## Skill Scout Summary

Scanned: [N] skills from [M] providers
Candidates: [X] after filtering
Recommended: [Y]
Imported: [Z]

Already well-covered: [list areas where existing skills are sufficient]
Not covered (no good skills found): [list gaps with no quality skill available]
```

## Rules

- NEVER recommend a skill without reading its full content first
- NEVER recommend more than 8 skills — if the catalog is huge, be MORE selective, not less
- ALWAYS check for redundancy with installed skills before recommending
- ALWAYS cite specific codebase evidence for why a skill is needed
- If the project is well-covered, say so — "no additional skills needed" is a valid output
- If a recommended skill needs quality adaptation, note it: "import then run /import-skill to adapt"
- Rate every candidate honestly — SKIP is the most common rating for a reason
- Respect the focus argument — if user asked for security skills only, don't recommend testing skills
