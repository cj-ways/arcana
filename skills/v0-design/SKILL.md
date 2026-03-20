---
name: v0-design
description: 'Generates optimized v0.dev prompts for UI design — full pages, single components, or redesigns. Analyzes the project, adapts questions to context, researches design references, and outputs ready-to-copy prompts following Vercel''s three-part framework. Manual via /v0-design.'
argument-hint: "<app-description, feature, or component>"
disable-model-invocation: true
allowed-tools: ["Read", "Glob", "Grep", "Agent", "WebSearch", "WebFetch", "Write", "AskUserQuestion"]
effort: medium
---

# /v0-design — Generate v0.dev Design Prompts

Generate optimized prompts for v0.dev that produce consistent, production-ready UI designs. Supports full apps, single pages, individual components, and redesigns of existing UIs.

## Arguments

```
/v0-design <description>
```

Examples:
- `/v0-design "student portal with dashboard, schedule, exams, grades"`
- `/v0-design "redesign our settings page"`
- `/v0-design "data table component with sorting and filtering"`

If no argument is provided, ask what to design.

---

## Step 1: Detect Mode

Determine the design mode from the argument and project state:

| Signal | Mode | Behavior |
|--------|------|----------|
| No codebase exists | **Greenfield** | Recommend default stack (Next.js + shadcn/ui + Tailwind), ask about pages/audience |
| Argument mentions "redesign" or existing pages exist | **Redesign** | Read current pages/components to understand what's being replaced |
| Argument describes a single component (table, form, card) | **Component** | Generate a single component prompt, skip context message and multi-page flow |
| Argument describes multiple pages | **Multi-page** | Full flow: context message + per-page prompts |

**Greenfield default stack**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + lucide-react. Deviate only if the user specifies otherwise.

---

## Step 2: Analyze the Project

**For existing projects**, read in order (stop when sufficient):

1. `CLAUDE.md`, `README.md`, or `PLAN.md` — project purpose, architecture
2. `package.json` — framework, dependencies, component library
3. `tailwind.config.ts` / `globals.css` — theme colors, design tokens
4. Existing page files (`src/app/*/page.tsx`) — current UI structure and patterns

**Extract and translate**:
- CSS variables → human-readable colors: `--primary: oklch(0.52 0.18 268)` → "deep indigo, similar to indigo-600"
- Tailwind config → design tokens: border-radius scale, shadow scale, spacing scale
- Component patterns → layout vocabulary: "uses sidebar + card grid", "bottom nav with 3 tabs"

**For redesigns**, also read the specific pages being redesigned. Summarize the current layout, data displayed, and interactions so the prompt can say "replace the current tab-based schedule with a 5-column grid."

**For greenfield projects**, skip to Step 3.

---

## Step 3: Gather Context (Adaptive)

Ask clarifying questions using **AskUserQuestion**. ONE question at a time. Let each answer reshape the next question. Stop when enough context exists — do NOT ask all questions if earlier answers make them unnecessary.

**Possible questions** (choose based on what's still unknown):

- What pages/screens are needed?
- Who uses this app? On what device primarily?
- Any design references to match? (e.g., "like Linear", "like Notion")
- Fresh theme or match existing project colors?
- Any specific interaction patterns needed? (wizards, drag-drop, real-time)
- Mobile-first or desktop-first?
- Any non-English text? What language(s)?

**If the user mentions a design reference** (e.g., "like Linear"):
Use **WebSearch** to research it. Search for `"[app name] UI design"` or `"[app name] dashboard screenshot"`. Extract specific visual traits: layout structure, color temperature, typography weight, spacing density, border radius, shadow style. Translate these into concrete v0 instructions instead of just writing "like Linear."

**2-4 questions max.** If the argument already contains enough detail, skip directly to generation.

---

## Step 4: Generate Context Message

Create a context message to paste FIRST in the v0 chat. This sets the design direction for all pages.

**Template**:
```
I'm building "[App Name]" — [one-line description]. It's a [framework] app with [component library] + [CSS framework].

The app has these pages: [list ALL pages, including existing ones not being redesigned].

I'll give you each page one by one. Design them as a cohesive app — same theme, consistent components across all pages. [Design direction: either specific traits from reference research, or "Pick the best color scheme you think works for [audience]."] Dark mode required on every page.

[Special notes: language (with example text), mobile-first, RTL if applicable, user type]

Ready? I'll start with [first page — pick the most visually complex one].
```

**Rules**:
- Under 150 words
- List ALL pages (even existing ones) so v0 designs consistently
- State component library explicitly (shadcn/ui, etc.)
- Include non-English language note with 2-3 example strings if applicable
- Mention RTL if the language requires it (Arabic, Hebrew)
- Recommend font stack for non-Latin scripts: "Georgian text uses Noto Sans Georgian", "Chinese uses Noto Sans SC"

**For component mode**: Skip the context message. Generate a single component prompt directly.

---

## Step 5: Generate Page/Component Prompts

### For each page:

Follow the three-part framework (800-1200 words per prompt):

```
Design [page description] for "[App Name]".

[PRODUCT SURFACE — what the user sees and interacts with]
Layout:
- [Overall structure: sidebar + main, full-width, split-pane, etc.]
- [Responsive: "2-column grid on desktop (md:grid-cols-2), single column on mobile"]

Content:
- [Element 1]: [exact data fields, text content in target language, states]
- [Element 2]: [same level of detail]
- [Empty state]: [what shows when no data — icon + message]
- [Loading state]: [skeleton/spinner description if data-dependent]

Interactions:
- [Hover effects, click actions, expand/collapse, tooltips]
- [Navigation: what links where]

[CONTEXT OF USE]
- Used by [user type] on [device], primarily for [task]
- [Frequency of use: daily check vs occasional config]

[CONSTRAINTS]
Design requirements:
- [Responsive behavior with specific breakpoints if needed]
- Dark mode variant
- [Mobile: bottom nav, safe-area padding, touch targets min 44px]
- [Accessibility: color contrast, keyboard nav]
- Use [component library] components: [name specific ones — Card, Badge, Table, etc.]
- Use [CSS framework], [icon library], Next.js "use client"
```

### For single components:

Shorter prompt (400-600 words), skip layout/navigation, focus on the component itself:

```
Design a [component type] component for "[App Name]".

Data: [fields, types, example values]
States: [loading, empty, error, populated]
Interactions: [sort, filter, expand, select, hover]
Variants: [compact vs expanded, light vs dark]

Design: [specific shadcn/ui base component], [Tailwind], dark mode.
```

### Page ordering strategy:

Generate the most visually complex page first (usually dashboard or main content page). This establishes the richest design language. Simpler pages inherit the established style.

### Shared components:

If multiple pages share navigation (sidebar, header, bottom nav), include it in the FIRST page prompt. For subsequent pages, say: "Use the same sidebar/header/bottom nav from the previous page."

### Specialized patterns:

**Multi-step forms/wizards**: Describe all steps in one prompt. Specify step indicator style, navigation (back/next), validation behavior, conditional steps.

**Data tables**: Specify columns, sort/filter behavior, pagination, row actions, empty state. Name the Table component from shadcn/ui.

**Charts/visualizations**: Specify chart library (recharts for shadcn/ui). Describe chart type, axis labels, data format, tooltips, responsive behavior, empty state.

**Mobile-first**: Specify "design for 375px width as baseline." Include: bottom navigation, sheet drawers (not modals), swipe gestures, safe-area padding, touch targets ≥44px.

---

## Step 6: Generate Iteration Prompts

Provide 3-5 specific follow-up prompts tailored to the generated pages (not generic). These should address the most common adjustments:

```
## Iteration Prompts

If the [page name] feels too busy:
→ "Simplify [page name] — reduce to [N] cards, increase whitespace, remove [specific element]"

If dark mode doesn't look right:
→ "In dark mode, make the card backgrounds slightly lighter (bg-card) and reduce border opacity"

If mobile layout is broken:
→ "On mobile (<768px), stack all cards vertically, replace sidebar with bottom nav sheet"

If the theme drifts between pages:
→ "Match the style of [first page] — same card radius, shadow depth, color palette"
```

---

## Step 7: Verify and Output

**Before writing, verify each prompt against this checklist**:

- [ ] Specific component names and data fields (not vague)
- [ ] Responsive behavior with breakpoint (mobile + desktop)
- [ ] Dark mode explicitly mentioned
- [ ] Actual text content in target language (spelled out, not "Georgian text")
- [ ] Empty/loading/error states for data-dependent sections
- [ ] Interaction descriptions (hover, click, expand, tooltip)
- [ ] Between 800-1200 words (pages) or 400-600 words (components)
- [ ] Component library + CSS framework specified
- [ ] No conflicting instructions between prompts
- [ ] Page ordering: most complex first
- [ ] Shared components referenced (not re-described) after first page
- [ ] Accessibility: color contrast mention, touch targets for mobile
- [ ] Font stack specified for non-Latin scripts

Write to `docs/v0-prompts.md` (or the filename the user specifies).

**Output structure**:
```markdown
# v0.dev Design Prompts — [App Name]

## How to Use
1. Go to v0.dev → start a NEW chat
2. Paste the Context Message first
3. Paste each page prompt one at a time, in order
4. Use iteration prompts if results need adjustment
5. Use Design Mode (free) for visual tweaks
6. Download zip after each page for backup

## Context Message
\`\`\`
[context message]
\`\`\`

## Page 1: [Name] (generate first — establishes design language)
\`\`\`
[prompt]
\`\`\`

## Page 2: [Name]
\`\`\`
[prompt]
\`\`\`

## Iteration Prompts
[tailored follow-ups]
```

---

## Gotchas

1. **Forgetting the component library** → v0 invents its own components, inconsistent with your project
2. **Vague responsive behavior** → v0 generates desktop-only or breaks on mobile
3. **Skipping empty states** → pages look great with data, blank/broken without it
4. **Writing "use dark colors" instead of "dark mode variant"** → v0 makes a dark-themed light mode, not an actual dark mode toggle
5. **Generating all pages in one prompt** → v0 combines everything into a single messy page
6. **Forgetting non-Latin fonts** → Georgian/Chinese/Arabic text renders in fallback font, looks broken

## Anti-Patterns

- Generate one massive prompt with all pages combined
- Use vague language: "make it look nice", "add some cards", "make it modern"
- Include backend logic, API calls, or database queries in prompts — v0 generates UI only
- Skip the context message for multi-page projects — styles will drift
- Over-constrain colors/spacing — let v0 choose within your structural framework
- Copy-paste the same prompt structure for every page — each page has unique needs
