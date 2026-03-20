---
name: new-project-idea
description: 'Analyzes a project idea critically, then scaffolds a full project with phased plan, CLAUDE.md, OpenSpec, and AI-optimized stack. Manual via /new-project-idea.'
argument-hint: "<project-idea>"
disable-model-invocation: true
effort: high
---

# New Project Idea → Full Project Setup

The user has a new project idea. Your job is to critically analyze it, then scaffold a production-ready project if it passes the analysis.

**Input**: $ARGUMENTS (the project idea - may be rough/unpolished, that's expected)

---

## Step 1: Deep Analysis (DO NOT SKIP)

Before writing a single file, analyze the idea thoroughly and present findings to the user:

### 1a. Understand the real need
- What problem is the user actually trying to solve?
- Who is it for? (personal tool, public product, portfolio piece?)
- What would "done" look like?

### 1b. Critical feasibility assessment
- **Is it doable?** Technical constraints, API availability, data sources
- **Is it free?** The user prefers free-tier solutions. Map every layer (hosting, DB, APIs, automation) to a free-tier service. Be specific about limits.
- **Is it worth creating?** What already exists? What's the gap? Be brutally honest.
- **What are the risks?** Maintenance burden, API changes, scope creep, abandonment risk

### 1b-2. Research what already exists (DO NOT SKIP)
Use WebSearch to ground the feasibility assessment in real data instead of guessing:
1. Search: `"does [idea] already exist?"` — find direct competitors or identical tools
2. Search: `"[idea] competitors 2026"` — find the current landscape
3. Search: `"[idea] open source alternative"` — check if an OSS solution already exists
4. **Report findings to the user:**
   - What already exists (with links/citations)
   - What the actual gap is between existing solutions and the user's idea
   - Whether the gap is big enough to justify building something new
   - If something nearly identical exists, suggest forking/extending it instead
- This step turns "Is it worth creating?" from a guess into an evidence-based assessment

### 1c. Enrich the idea
- What is the user NOT thinking about that would make this significantly better?
- Add 3-6 concrete enrichments with justification
- Don't bloat - only add what genuinely increases value

### 1d. Present analysis
Present all of this clearly to the user. Wait for confirmation to proceed. If the idea has fatal flaws, say so directly.

---

## Step 2: Choose the Stack

**Core principle**: The AI agent will be implementing this project. Choose the stack that maximizes AI code generation accuracy.

**Default AI-optimized stack** (adjust per project needs):
- **Framework**: Next.js (App Router) + TypeScript strict
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (components in the codebase, not node_modules - AI can read/edit them)
- **ORM**: Drizzle ORM (type-safe, SQL-like, predictable generation)
- **Validation**: Zod (single source of truth for types + runtime validation)
- **Icons**: lucide-react
- **Dates**: date-fns

Deviate from this stack ONLY when the project genuinely requires something different (e.g., mobile app → React Native, CLI tool → plain Node.js). Always explain why.

---

## Step 3: Ask Setup Questions

Before scaffolding, ask the user:
1. **Project name** - offer 2-3 options (short, kebab-case, memorable)
2. **Location** - check common project directories (~/projects, ~/Desktop, etc.)
3. **GitHub** - check `gh auth status`. If not logged in, ask them to auth or skip push.

---

## Step 4: Scaffold the Project

### 4a. Create project
- Create directory in chosen location
- Initialize framework (e.g., `create-next-app`)
- Install all dependencies
- Initialize git

### 4b. Set up OpenSpec
```bash
npm install -g @fission-ai/openspec@latest  # if not installed
openspec init --tools claude
```
This creates `.claude/commands/opsx/` and `.claude/skills/openspec-*/` for spec-driven development.

### 4c. Create CLAUDE.md (project root)

CLAUDE.md must contain:
1. **Project overview** - one-paragraph description
2. **Tech stack** - every dependency with version and why it's chosen
3. **Architecture** - directory structure with comments
4. **Data model / domain** - key types, categories, entities
5. **Rules**:
   - **Phase Execution Protocol** (MANDATORY - copy exactly):
     ```
     This project is built in phases. An agent executes ONE phase at a time.
     After completing each phase:
     1. Sync the plan: Update PLAN.md - mark completed phase as done
     2. Re-analyze remaining phases: Review all upcoming phases in context of what was built
     3. Assess relevance: Determine if remaining phases are still necessary and correctly scoped
     4. Re-phase if needed: Merge, split, reorder, add, or remove phases as needed
     5. Document changes: Add a note to the Plan Change Log explaining why
     ```
   - Coding standards specific to the stack
   - Free tier constraints (if applicable)
   - OpenSpec integration notes

### 4d. Create PLAN.md (project root)

PLAN.md must contain:
1. **Protocol reminder** at the top referencing CLAUDE.md phase rules
2. **Status legend**: `[ ]` not started, `[~]` in progress, `[x]` done, `[-]` skipped
3. **Phases** (typically 6-10), each with:
   - Clear goal (one sentence)
   - Task checklist (`- [ ]` items)
   - Deliverables (what exists when phase is done)
   - Exit criteria (how to know it's actually done)
4. **Plan Change Log** table (Date, Change, Reason)

Phase design principles:
- Each phase should be completable in one agent session
- Earlier phases = foundational (types, data, infrastructure)
- Later phases = features, polish, deployment
- No phase should depend on an incomplete future phase

### 4e. Create .env.example
List all required environment variables with comments. Never commit actual secrets.

### 4f. Create openspec/project.md
Project context for OpenSpec: tech stack, architecture principles, domain info, conventions.

---

## Step 5: Phase Plan Validation (DO NOT SKIP)

Before scaffolding any files or pushing to Git, present the complete phase plan to the user for review:

1. **Show the full plan summary**: list each phase with its goal, estimated scope, and key deliverables
2. **Highlight key decisions**: stack choice, number of phases, Phase 1 scope, free-tier services selected
3. **Ask explicitly**: "Does this plan look right? Should I adjust any phases, reorder, or change scope before I scaffold?"
4. **Wait for user confirmation** before proceeding to Git setup
5. If the user requests changes, update the plan FIRST, then re-present for confirmation

This prevents wasted scaffolding work if the user disagrees with the direction.

---

## Step 6: Git & GitHub

- Commit all scaffolding
- Create GitHub repo (public unless user specifies otherwise)
- Push initial code
- Return the repo URL to the user

---

## Step 7: Summary

Present a clean summary:
- Project location (local path)
- GitHub repo URL
- Stack overview (table format)
- Number of phases in plan
- How to start: "cd into the project and tell the agent to execute Phase 1" or use `/opsx:propose`

---

## Guardrails

- NEVER skip Step 1 (analysis). The whole point is to think before building.
- NEVER use a stack just because it's popular. Use what AI generates most accurately.
- ALWAYS create both CLAUDE.md and PLAN.md. They are mandatory.
- ALWAYS set up OpenSpec if the project has more than 2 phases.
- If the user's idea has serious problems, say so honestly. Don't build something doomed to fail.
- The phase execution protocol is NON-NEGOTIABLE. Every project gets it.
- Prefer free-tier services unless the user explicitly says they'll pay.

## Common Agent Gotchas

These are frequent mistakes agents make when executing this skill. Avoid them:

1. **Suggesting a stack the user explicitly doesn't want.** Always check `$ARGUMENTS` for stack hints or preferences. If the user says "use Svelte" or "no Next.js", respect that. Do not default to the AI-optimized stack blindly.
2. **Over-scoping Phase 1.** The MVP should be minimal, not feature-complete. Phase 1 is foundations: types, data model, basic infrastructure. If Phase 1 has more than 8-10 tasks, it is too big. Split it.
3. **Creating files before the user confirms the plan.** Steps 1-5 are analysis and planning. Do NOT scaffold directories, write CLAUDE.md, or create any files until the user explicitly approves the phase plan in Step 5.
4. **Not reading the existing directory structure.** The target project directory may already have files (e.g., user ran `create-next-app` manually, or there is a previous attempt). Always check with `ls` before creating anything. Adapt to what exists instead of overwriting.
5. **Forgetting to add the project to MEMORY.md.** After setup, add an entry to the user's MEMORY.md (projects section) with the project name, path, and one-line description. This ensures future agent sessions have continuity and can find the project.
