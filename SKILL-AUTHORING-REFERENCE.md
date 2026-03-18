# Skill Authoring Reference: Evidence-Based Rules for Writing Agent Skill Instructions

> Compiled from 20+ sources including Anthropic official docs, SkillsBench research paper,
> agentskills.io specification, and community best practices. Every rule below is sourced.

---

## A. Tone & Voice

### Person / Point of View

| Context | Use | Why | Source |
|---------|-----|-----|--------|
| **Description field** | Third person | "The description is injected into the system prompt, and inconsistent point-of-view can cause discovery problems." | Anthropic best practices |
| **SKILL.md body** | Third-person imperative | "Extract the text..." not "I will extract..." or "You should extract..." | mgechev/skills-best-practices |
| **Steps/procedures** | Imperative commands | "Run `analyze_form.py`" not "You can run analyze_form.py" | Anthropic best practices |

**Concrete examples:**
- GOOD description: `"Processes Excel files and generates reports"`
- BAD description: `"I can help you process Excel files"` (first person)
- BAD description: `"You can use this to process Excel files"` (second person)

### Imperative vs Declarative

**Imperative wins for instructions.** Use directives, not information.

- GOOD: `"Always use interactions.create()"` -- direct command
- BAD: `"The Interactions API is the recommended approach"` -- informational, not directive
- Source: agentskills.io optimizing-descriptions

**Affirmative framing outperforms negative framing.** The only principle framed positively ("Always do X") saw the highest adherence across all models in the LeSWrong safety rules study.

- GOOD: `"Use parameterized queries for all database access"`
- BAD: `"Don't use string concatenation for SQL"`
- Source: LeSWrong agent safety rules study; SuperAnnotate prompting tricks

### Emphasis and Caps

**Selective emphasis works. Blanket emphasis fails.**

- When everything is marked IMPORTANT or in CAPS, emphasis loses its power
- "If everything is IMPORTANT, nothing is"
- Strategic use of ALWAYS/NEVER on 2-3 truly critical rules: effective (84% compliance)
- ALWAYS/NEVER on every rule: counterproductive (treated as normal text)
- Source: thecaio.ai; Anthropic skill-creator ("Avoid excessive ALWAYS/NEVER in caps")

**Rule: Reserve caps emphasis for at most 2-3 rules per skill. Explain WHY for everything else.**

### Formal vs Casual

**Neither is universally better.** Consistency matters more than formality level.

- Instructions should use clear, direct language -- neither stiff nor chatty
- "Use straightforward language and direct commands"
- Conflict between instruction tone and skill purpose degrades compliance
- Source: Zendesk AI agent best practices

### Short vs Long Sentences

**Short, direct sentences for instructions. Longer explanations only for "why."**

- "Concise, stepwise guidance with at least one working example is often more effective than exhaustive documentation"
- Comprehensive documentation actually HURT performance by -2.9pp in SkillsBench
- Sweet spot: ~1000-1200 words for skill body
- Source: SkillsBench paper (7,308 trajectories)

---

## B. Description Field

### Hard Limits

| Constraint | Value | Source |
|-----------|-------|--------|
| Maximum characters | 1024 | agentskills.io specification |
| Minimum | Non-empty (>0 chars) | agentskills.io specification |
| Forbidden characters | `<` and `>` (no XML tags) | agentskills.io specification |
| Forbidden words in name | "anthropic", "claude" | Anthropic best practices |

### What to Include

The description carries the ENTIRE burden of triggering. It is the only metadata visible to the agent before activation.

1. **What the skill does** (capabilities)
2. **When to use it** (trigger conditions)
3. **Specific keywords** that match user intent
4. **Explicit negative boundaries** (what the skill does NOT do)

**Formula:** `[Action verbs describing capabilities]. Use when [trigger conditions]. Don't use for [boundaries].`

**GOOD example:**
```yaml
description: >
  Creates and builds React components using Tailwind CSS.
  Use when the user wants to update component styles or UI logic.
  Don't use it for Vue, Svelte, or vanilla CSS projects.
```

**GOOD example:**
```yaml
description: >
  Analyze CSV and tabular data files -- compute summary statistics,
  add derived columns, generate charts, and clean messy data. Use this
  skill when the user has a CSV, TSV, or Excel file and wants to
  explore, transform, or visualize the data, even if they don't
  explicitly mention "CSV" or "analysis."
```

**BAD examples:**
```yaml
description: Helps with documents      # too vague
description: Processes data             # too vague
description: Does stuff with files      # useless
description: React skills               # noun, not action
```

### Writing Style for Descriptions

- **Be "pushy"** -- explicitly list contexts where the skill applies, including non-obvious ones
- **Use imperative phrasing**: "Use this skill when..." rather than "This skill does..."
- **Focus on user intent**, not implementation: describe what the user is trying to achieve
- **Include implicit triggers**: "even if they don't explicitly mention 'CSV'"
- Source: Anthropic skill-creator SKILL.md; agentskills.io

### What NOT to Put in Descriptions

- Implementation details (save for body)
- First or second person voice
- XML tags or angle brackets
- Vague nouns without action verbs
- Reserved words ("anthropic", "claude")

### Avoiding False Positives / Negatives

| Problem | Cause | Fix |
|---------|-------|-----|
| Under-triggering | Description too narrow | Broaden scope, add implicit trigger phrases, include aliases |
| Over-triggering | Description too broad | Add negative boundaries ("Don't use for X"), be specific about capabilities |
| Inconsistent triggering | Nondeterministic model behavior | Test each query 3+ times, compute trigger rates |

Source: agentskills.io optimizing-descriptions

---

## C. Body Structure

### Ideal Section Ordering

Based on Anthropic and agentskills.io recommendations:

```markdown
---
name: skill-name
description: [what + when + boundaries]
---

# Skill Title

## Quick Start / Primary Workflow
[The most common use case, with working code example]

## Gotchas
[Environment-specific facts that defy assumptions -- highest-value content]

## Step-by-Step Procedures
[Numbered steps for complex workflows]

## Decision Points
[If X, do Y. Otherwise, do Z.]

## Output Format
[Template or example of expected output]

## Validation
[How to verify the output is correct]

## Advanced Features
[See references/advanced.md for details]
```

### How to Write Steps LLMs Follow Reliably

1. **Use numbered steps with strict chronological sequence**
   ```markdown
   1. Run `scripts/analyze.py input.pdf`
   2. Review output in `fields.json`
   3. Run `scripts/validate.py fields.json`
   4. If validation fails, return to Step 2
   ```

2. **Make decision trees explicit**
   ```markdown
   If source maps are needed, run `ng build --source-map`.
   Otherwise, skip to Step 3.
   ```

3. **Include checklists for multi-step workflows**
   ```markdown
   Progress:
   - [ ] Step 1: Analyze the form
   - [ ] Step 2: Create field mapping
   - [ ] Step 3: Validate mapping
   - [ ] Step 4: Fill the form
   ```

4. **Add validation loops** (do -> validate -> fix -> repeat)
   ```markdown
   1. Make edits
   2. Run validation: `python scripts/validate.py`
   3. If validation fails, fix and re-run
   4. Only proceed when validation passes
   ```

Source: Anthropic best practices; agentskills.io best-practices

### Bullet Lists vs Paragraphs vs Tables

| Format | Use When | Source |
|--------|----------|--------|
| **Numbered lists** | Sequential steps, procedures | "Use numbered lists or bullet points to demarcate distinct tasks" -- Unite.AI |
| **Bullet lists** | Parallel options, gotchas, non-ordered items | Anthropic best practices |
| **Tables** | Comparing options, field specifications | agentskills.io specification |
| **Code blocks** | Exact commands, templates, output format | Anthropic best practices |
| **Paragraphs** | Explanations of "why" behind rules | agentskills.io best-practices |

### How Specific Should Instructions Be?

**Match specificity to task fragility:**

| Freedom Level | Use When | Example |
|---------------|----------|---------|
| **High freedom** | Multiple approaches valid, context-dependent | Code review criteria |
| **Medium freedom** | Preferred pattern exists, some variation OK | Report generation with template |
| **Low freedom** | Fragile operations, consistency critical | Database migration commands |

**Analogy from Anthropic docs:** Think of Claude as a robot on a path:
- **Narrow bridge with cliffs**: Only one safe way. Provide exact instructions (low freedom).
- **Open field**: Many paths work. Give general direction (high freedom).

### The "Specific but Not Brittle" Balance

1. **Explain WHY, not just WHAT** -- "LLMs have good theory of mind. Explain why something matters rather than using rigid ALWAYS/NEVER rules." Source: Anthropic skill-creator
2. **Provide defaults, not menus** -- Pick one recommended approach, mention alternatives briefly
3. **Use working examples** -- "Agents pattern-match well against concrete structures"
4. **Add gotchas** -- Specific corrections to mistakes the agent WILL make without being told
5. **Favor procedures over declarations** -- Teach how to approach a class of problems, not what to produce for one instance

Source: agentskills.io best-practices; Anthropic best practices

### Line / Token Budgets

| Metric | Limit | Source |
|--------|-------|--------|
| SKILL.md body | Under 500 lines | Anthropic best practices |
| SKILL.md body | Under 5,000 tokens recommended | agentskills.io specification |
| Optimal word count | ~1000-1200 words | SkillsBench (empirical sweet spot) |
| Reference files > 100 lines | Must include table of contents | Anthropic best practices |
| Metadata at startup | ~80-100 tokens per skill | Anthropic engineering blog |

### Progressive Disclosure Pattern

Three-stage loading minimizes context usage:

```
Stage 1: DISCOVERY (~80-100 tokens/skill)
  -> name + description in system prompt at startup

Stage 2: ACTIVATION (full SKILL.md)
  -> loaded when Claude determines relevance to current task

Stage 3: EXECUTION (references/, scripts/, assets/)
  -> loaded on-demand only when needed
```

**Rules:**
- Keep SKILL.md under 500 lines; split into references/ beyond that
- Keep references ONE LEVEL DEEP from SKILL.md (no nested chains)
- Explicitly tell agent WHEN to read each reference file
- Structure reference files >100 lines with a table of contents

Source: Anthropic best practices; agentskills.io specification

---

## D. Common Mistakes

### What Makes Skills Fail

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| **Self-generated skills (before solving)** | "Self-generated Skills provide no benefit on average" (-1.3pp). Models cannot author procedural knowledge they benefit from consuming. | Generate skills AFTER solving the problem through iteration. |
| **Vague/generic instructions** | "Handle errors appropriately" gives no actionable guidance. | Use specific API patterns, exact commands, concrete edge cases. |
| **Comprehensive documentation** | Actually hurt performance by -2.9pp in SkillsBench. Agents struggle to extract relevant info from lengthy content. | Keep focused: 2-3 modules outperform exhaustive docs. |
| **Overloaded SKILL.md** | Competes for context with conversation history. | Split into progressive disclosure files. |
| **Too many choices** | "You can use pypdf, or pdfplumber, or PyMuPDF..." confuses the agent. | Pick one default, mention alternatives briefly. |
| **Deeply nested references** | Claude partially reads files when referenced from other referenced files. | Keep references one level deep from SKILL.md. |
| **Hardcoded absolute paths** | Breaks across environments. | Use `{baseDir}` or relative paths with forward slashes. |
| **Missing gotchas** | The highest-value content in many skills is a list of gotchas. Without them, agents make predictable mistakes. | Add a Gotchas section with specific corrections. |
| **Windows-style paths** | Backslashes cause errors on Unix systems. | Always use forward slashes. |
| **Inconsistent terminology** | Mixing "API endpoint", "URL", "API route" confuses the agent. | Pick one term per concept and use it everywhere. |

Source: SkillsBench paper; Anthropic best practices; agentskills.io; seangoedecke.com

### What Causes LLMs to Ignore Instructions

1. **Attention dilution in long prompts** -- "attention becomes diluted" in lengthy prompts, especially for later sections
2. **Information overload** -- Multiple competing directives cause partial compliance
3. **Buried instructions** -- Critical rules placed mid-document get less attention than those at start/end
4. **Negative framing** -- "Don't do X" is less effective than "Do Y instead"
5. **Blanket emphasis** -- When everything is CAPS/CRITICAL, nothing stands out
6. **Instructions that conflict with codebase patterns** -- Codebase signals can override skill instructions
7. **Long sessions** -- Instruction following degrades as conversation grows

Source: Unite.AI; SIFo benchmark; thecaio.ai

### Instruction Priority Hierarchy (Highest to Lowest)

1. Current prompt (user's message)
2. Early CLAUDE.md / SKILL.md rules
3. Later CLAUDE.md / SKILL.md rules
4. Earlier conversation history
5. Training defaults

Source: thecaio.ai

---

## E. Testing

### Trigger Testing Methodology

**Step 1: Create eval queries (20 total)**
- 8-10 should-trigger queries (varied phrasing, explicitness, detail, complexity)
- 8-10 should-not-trigger queries (near-misses, not obviously irrelevant)

**Step 2: Make queries realistic**
- Include file paths, personal context, column names, backstory
- Mix casual + formal, terse + verbose, explicit + implicit
- Include typos and abbreviations

**Step 3: Run each query 3+ times** (model is nondeterministic)
- Compute trigger rate = (triggers / runs)
- should-trigger passes if trigger rate > 0.5
- should-not-trigger passes if trigger rate < 0.5

**Step 4: Split into train/validation sets**
- Train set (~60%): guides description improvements
- Validation set (~40%): checks if improvements generalize
- NEVER use validation failures to guide changes (prevents overfitting)

**Step 5: Optimization loop (5 iterations max)**
1. Evaluate current description on both sets
2. Identify failures in train set only
3. Revise description (generalize, don't overfit to specific queries)
4. Re-evaluate
5. Select best iteration by validation pass rate (may not be the last one)

Source: agentskills.io optimizing-descriptions

### Should-Not-Trigger Query Design

**Strong negatives are near-misses**, not obviously irrelevant queries:
- BAD negative: `"Write a fibonacci function"` (tests nothing)
- GOOD negative: `"I need to update the formulas in my Excel budget spreadsheet"` (shares keywords but needs different skill)

Source: agentskills.io optimizing-descriptions

### Output Quality Testing

**Three-level validation from mgechev/skills-best-practices:**

1. **Discovery Validation**
   - Generate 3 prompts that SHOULD trigger
   - Generate 3 similar prompts that should NOT trigger
   - Test description in isolation against an LLM

2. **Logic Validation**
   - Feed entire SKILL.md + directory tree to LLM
   - Have agent simulate execution step-by-step
   - Require agent to identify "Execution Blockers" (lines forcing hallucination)
   - Flag ambiguities and implicit assumptions

3. **Edge Case Testing**
   - Role-play as "ruthless QA tester"
   - Ask 3-5 high-specificity questions about failure states
   - Address environment assumptions and unsupported configurations

### Evaluation-Driven Development

**Build evaluations BEFORE writing extensive documentation:**

1. Identify gaps: Run Claude on representative tasks without a Skill
2. Create evaluations: Build three scenarios that test these gaps
3. Establish baseline: Measure performance without the Skill
4. Write minimal instructions: Just enough to address gaps and pass evaluations
5. Iterate: Execute evaluations, compare against baseline, refine

Source: Anthropic best practices

### Cross-Model Testing

- **Haiku** (fast, economical): Does the Skill provide enough guidance?
- **Sonnet** (balanced): Is the Skill clear and efficient?
- **Opus** (powerful reasoning): Does the Skill avoid over-explaining?

"What works perfectly for Opus might need more detail for Haiku."

Source: Anthropic best practices

### Iterative Refinement Process

The most effective process uses two Claude instances:
- **Claude A**: Creates/refines the skill (the expert)
- **Claude B**: Tests the skill on real tasks (fresh instance)

Cycle: Observe Claude B's behavior -> bring insights to Claude A -> refine -> re-test.

Source: Anthropic best practices

---

## F. Key Quantitative Findings (SkillsBench)

The SkillsBench paper tested 7 model configurations over 7,308 trajectories on 86 tasks:

| Finding | Data |
|---------|------|
| Curated skills improvement | +16.2pp average pass rate |
| Self-generated skills | -1.3pp (no benefit) |
| Healthcare domain gain | +51.9pp |
| Software engineering gain | +4.5pp (lowest -- strong pretraining) |
| Optimal skill count | 2-3 skills (peak at +18.6pp) |
| 4+ skills | +5.9pp (diminishing returns) |
| Comprehensive docs | -2.9pp (HURTS performance) |
| Detailed docs | +18.8pp (best) |
| Compact docs | +17.1pp (good) |

**Key takeaway:** Focused, moderately detailed skills with 2-3 modules dramatically outperform both no skills and comprehensive documentation.

---

## G. Quick Reference Checklist

### Before Publishing a Skill

**Core Quality:**
- [ ] Description is in third person, includes what + when + boundaries
- [ ] Description is under 1024 characters
- [ ] Name is lowercase, hyphens only, matches directory name
- [ ] SKILL.md body is under 500 lines
- [ ] Gotchas section captures non-obvious mistakes
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Working examples included (not just prose descriptions)
- [ ] References are one level deep
- [ ] Progressive disclosure used for content beyond 500 lines

**Instructions Quality:**
- [ ] Third-person imperative voice throughout body
- [ ] Affirmative framing ("Do X" not "Don't do Y")
- [ ] CAPS emphasis on at most 2-3 critical rules
- [ ] WHY explained for important rules
- [ ] Default provided (not a menu of equal options)
- [ ] Decision trees made explicit
- [ ] Validation loops for quality-critical tasks
- [ ] Checklists for multi-step workflows

**Testing:**
- [ ] 20 trigger eval queries (10 should, 10 should-not)
- [ ] Train/validation split (60/40)
- [ ] Each query run 3+ times
- [ ] Tested with target models (Haiku, Sonnet, Opus)
- [ ] Output quality validated on real tasks
- [ ] Edge cases tested by "ruthless QA tester"

---

## Sources

1. [Anthropic - Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) -- Official Anthropic documentation
2. [Anthropic - Equipping Agents with Skills](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills) -- Anthropic engineering blog
3. [Anthropic - skill-creator SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) -- Official skill-creator source
4. [Anthropic - Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) -- Claude prompt engineering docs
5. [agentskills.io - Specification](https://agentskills.io/specification) -- Agent Skills format specification
6. [agentskills.io - Optimizing Descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) -- Trigger optimization methodology
7. [agentskills.io - Best Practices for Skill Creators](https://agentskills.io/skill-creation/best-practices) -- Authoring patterns and anti-patterns
8. [SkillsBench Paper](https://arxiv.org/abs/2602.12670) -- "Benchmarking How Well Agent Skills Work Across Diverse Tasks" (7,308 trajectories)
9. [mgechev/skills-best-practices](https://github.com/mgechev/skills-best-practices) -- Community best practices with validation methodology
10. [Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) -- Technical architecture analysis
11. [You're Probably Using Agent Skills Wrong](https://notes.ansonbiggs.com/youre-probably-using-agent-skills-wrong/) -- Anti-patterns from SkillsBench analysis
12. [LLM-Generated Skills Work, If You Generate Them Afterwards](https://www.seangoedecke.com/generate-skills-afterwards/) -- Post-hoc skill generation research
13. [Why LLMs Skip Instructions](https://www.unite.ai/why-large-language-models-skip-instructions-and-how-to-address-the-issue/) -- Instruction following failure modes
14. [The Instruction Gap](https://arxiv.org/pdf/2601.03269) -- Academic paper on instruction compliance
15. [LeSWrong Agent Safety Rules Study](https://www.lesswrong.com/posts/wRsQowKKbgyXv2eni/i-tested-llm-agents-on-simple-safety-rules-they-failed-in) -- Positive framing compliance data
16. [Claude Code Ignoring You? 7 Ways to Fix It](https://www.thecaio.ai/blog/make-claude-code-follow-instructions) -- Practical compliance techniques
17. [Lakera - Prompt Engineering Guide 2026](https://www.lakera.ai/blog/prompt-engineering-guide) -- Comprehensive prompt engineering
18. [SuperAnnotate - 26 Prompting Tricks](https://www.superannotate.com/blog/llm-prompting-tricks) -- Affirmative directive research
19. [Vercel - Agent Skills](https://vercel.com/docs/agent-resources/skills) -- Vercel skill ecosystem docs
20. [SwirlAI - Progressive Disclosure as System Design Pattern](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure) -- Progressive disclosure architecture
21. [Anthropic - Claude Code Skills Docs](https://code.claude.com/docs/en/skills) -- Claude Code integration
22. [FireBench](https://arxiv.org/html/2603.04857v1) -- Enterprise instruction following evaluation
