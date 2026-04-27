import { FEEDBACK_PROFILES, SKILL_PHASE_ORDER, normalizeSkillPhase } from "./catalog.js";

export const SCAFFOLD_PLACEHOLDER = "TODO:";
export const DEFAULT_EVAL_SCENARIO_SUFFIX = "primary";

const PHASE_EVAL_LABELS = Object.freeze({
  plan: "planning",
  analyze: "analysis",
  design: "design",
  implement: "implementation",
  test: "test-generation",
  fix: "bug-fix",
  refactor: "refactor",
  review: "review",
  release: "release-readiness",
  utility: "utility",
});

function titleCaseWord(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : "";
}

function escapeSingleQuotedYaml(value) {
  return String(value).replace(/'/g, "''");
}

export function slugifySkillName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateSkillName(value) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

export function formatSkillTitle(name) {
  return String(name)
    .split("-")
    .filter(Boolean)
    .map((part) => titleCaseWord(part))
    .join(" ");
}

export function getDefaultFeedbackProfile(phase) {
  switch (normalizeSkillPhase(phase)) {
    case "review":
      return "diagnostic";
    case "test":
    case "implement":
    case "fix":
    case "refactor":
    case "release":
      return "execution";
    case "plan":
    case "analyze":
    case "design":
      return "advisory";
    default:
      return "general";
  }
}

export function getDefaultEvalScenarioName(name) {
  return `${slugifySkillName(name)}-${DEFAULT_EVAL_SCENARIO_SUFFIX}`;
}

export function getDefaultEvalArtifactPath(name) {
  return `artifacts/${slugifySkillName(name)}-report.md`;
}

export function getDefaultTriggerEvalPath(name) {
  return `evals/triggers/${slugifySkillName(name)}.json`;
}

function getEvalLabelForPhase(phase) {
  return PHASE_EVAL_LABELS[normalizeSkillPhase(phase)] || "workflow";
}

export function validatePhase(value) {
  return SKILL_PHASE_ORDER.includes(normalizeSkillPhase(value));
}

export function validateFeedbackProfile(value) {
  return FEEDBACK_PROFILES.includes(value);
}

export function parseAllowedTools(value) {
  return String(value || "Read, Grep, Glob, Edit, Write")
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);
}

export function getSuggestedCatalogOrder(skills, phase) {
  const normalizedPhase = normalizeSkillPhase(phase);
  const phaseSkills = skills
    .filter((skill) => skill.phase === normalizedPhase)
    .sort((a, b) => a.catalogOrder - b.catalogOrder);

  if (phaseSkills.length > 0) {
    return phaseSkills.at(-1).catalogOrder + 10;
  }

  const phaseIndex = SKILL_PHASE_ORDER.indexOf(normalizedPhase);
  const previousOrders = skills
    .filter((skill) => SKILL_PHASE_ORDER.indexOf(skill.phase) < phaseIndex)
    .map((skill) => skill.catalogOrder);
  const nextOrders = skills
    .filter((skill) => SKILL_PHASE_ORDER.indexOf(skill.phase) > phaseIndex)
    .map((skill) => skill.catalogOrder);

  const previousMax = previousOrders.length > 0 ? Math.max(...previousOrders) : null;
  const nextMin = nextOrders.length > 0 ? Math.min(...nextOrders) : null;

  if (previousMax !== null && nextMin !== null) {
    const midpoint = Math.floor((previousMax + nextMin) / 2);
    return midpoint > previousMax ? midpoint : previousMax + 1;
  }

  if (previousMax !== null) return previousMax + 10;
  if (nextMin !== null) return Math.max(1, nextMin - 10);
  return 10;
}

export function renderSkillTemplate({
  name,
  summary = "",
  argumentHint = "<task target or problem description>",
  allowedTools = ["Read", "Grep", "Glob", "Edit", "Write"],
  effort = "medium",
  phase,
  feedbackProfile,
  catalogOrder,
}) {
  const title = formatSkillTitle(name);
  const normalizedPhase = normalizeSkillPhase(phase);
  const trimmedSummary = summary.trim();
  const baseSummary = trimmedSummary || `${SCAFFOLD_PLACEHOLDER} Replace with a one-sentence skill summary.`;
  const description = `${baseSummary} Use when the user explicitly asks for this workflow or when the task clearly matches it. Manual via /${name}.`;
  const inputLabel = argumentHint.trim() || "<task target or problem description>";

  return `---
name: ${name}
description: '${escapeSingleQuotedYaml(description)}'
argument-hint: "${inputLabel}"
disable-model-invocation: true
allowed-tools: ${allowedTools.join(", ")}
effort: ${effort}
phase: ${normalizedPhase}
feedback-profile: ${feedbackProfile}
catalog-order: ${catalogOrder}
---

# ${title}

${trimmedSummary || `${SCAFFOLD_PLACEHOLDER} Replace with a short overview of what this skill does and why it exists.`}

**Input**: $ARGUMENTS ${inputLabel}

## Gotchas

1. ${SCAFFOLD_PLACEHOLDER} Add the highest-risk failure mode for this skill.
2. ${SCAFFOLD_PLACEHOLDER} Add a common mistake or bad default assumption.
3. ${SCAFFOLD_PLACEHOLDER} Add any tool, scope, or verification guardrail that must be followed.

## Workflow

1. Clarify the task, success criteria, and constraints from \`$ARGUMENTS\`.
2. Gather the minimum context needed before making changes or recommendations.
3. Execute the workflow using the repo's existing patterns instead of inventing a new one.
4. Validate the result with concrete checks before presenting the outcome.

## Validation

- ${SCAFFOLD_PLACEHOLDER} Add the exact checks, tests, or evidence required before completion.
`;
}

export function renderEvalManifestTemplate({
  name,
  phase,
}) {
  const scenarioName = getDefaultEvalScenarioName(name);
  const phaseLabel = getEvalLabelForPhase(phase);
  const artifactPath = getDefaultEvalArtifactPath(name);
  const manifest = {
    name: scenarioName,
    skill: name,
    description: `${SCAFFOLD_PLACEHOLDER} Replace with a concrete ${phaseLabel} scenario for /${name}.`,
    prompt: `${SCAFFOLD_PLACEHOLDER} Replace with the exact user request used to evaluate /${name} on a representative ${phaseLabel} task. Tell the model exactly what artifact to write, for example ${artifactPath}.`,
    scoring: {
      weights: {
        route: 0.2,
        process: 0.3,
        outcome: 0.5,
      },
    },
    expected: [
      {
        id: "report-file-created",
        description: `${SCAFFOLD_PLACEHOLDER} Replace with the deterministic artifact the skill should create.`,
        dimension: "route",
        type: "file-created",
        file: artifactPath,
      },
      {
        id: "process-evidence",
        description: `${SCAFFOLD_PLACEHOLDER} Replace with evidence inside the artifact that the skill followed the intended workflow.`,
        dimension: "process",
        type: "file-contains",
        file: artifactPath,
        contentIncludes: ["TODO: replace with workflow evidence"],
      },
      {
        id: "primary-outcome",
        description: `${SCAFFOLD_PLACEHOLDER} Replace with the main outcome or recommendation the skill must achieve inside the artifact.`,
        dimension: "outcome",
        type: "file-contains",
        file: artifactPath,
        contentIncludes: ["TODO: replace with a deterministic expected signal"],
      },
    ],
    falsePositives: [
      {
        id: "false-positive-trap",
        description: `${SCAFFOLD_PLACEHOLDER} Replace with a regression, false-positive, or scope trap that should stay clean. Prefer file-unchanged when the skill should leave existing files alone.`,
        dimension: "outcome",
        type: "file-contains",
        file: artifactPath,
        contentIncludes: ["TODO: replace with a bad signal that must NOT appear"],
      },
    ],
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function renderEvalScenarioReadmeTemplate({
  name,
  phase,
}) {
  const scenarioName = getDefaultEvalScenarioName(name);
  const title = formatSkillTitle(name);
  const phaseLabel = getEvalLabelForPhase(phase);

  return `# ${title} Primary Eval

This scaffold is the starting point for the first Layer 2 eval scenario for \`/${name}\`.

## Replace Before Release

- Update \`manifest.json\` with a concrete ${phaseLabel} task prompt.
- Replace the placeholder assertions with deterministic checks across \`route\`, \`process\`, and \`outcome\`.
- Add at least one false-positive or regression trap.
- Replace \`src/example.js\` with the smallest realistic fixture that reproduces the workflow.
- Run \`node evals/run-eval.js --scenario ${scenarioName} --run --runs 3\`.

## Guidance

- Keep the fixture tiny. Smaller scenarios are easier to debug and compare.
- Prefer artifact-backed file assertions over output-only assertions whenever the skill can legitimately write a report, checklist, or memo.
- If the skill explicitly forbids writing files before approval, keep the eval output-based but make the output rules as deterministic as possible.
- Compare baseline vs skill before editing the skill body so the delta stays measurable.
`;
}

export function renderEvalFixtureTemplate({
  name,
}) {
  return `// Replace this fixture with the smallest realistic code sample for /${name}.
// Keep only the files needed to reproduce the target behavior and trap cases.

export function example(value) {
  return value;
}
`;
}

function buildTriggerEvalEntries(name, collectionName) {
  const typeLabel = collectionName === "shouldTrigger" ? "SHOULD trigger" : "should NOT trigger";
  const reasonLabel = collectionName === "shouldTrigger"
    ? "why this should match the skill instead of a nearby skill"
    : "why this is a near-miss that should route somewhere else";

  return Array.from({ length: 10 }, (_, index) => ({
    id: `${collectionName === "shouldTrigger" ? "should-trigger" : "should-not-trigger"}-${index + 1}`,
    set: index < 6 ? "train" : "validation",
    prompt: `${SCAFFOLD_PLACEHOLDER} Replace with a realistic user query that ${typeLabel} /${name}.`,
    reason: `${SCAFFOLD_PLACEHOLDER} Replace with ${reasonLabel}.`,
  }));
}

export function renderTriggerEvalTemplate({
  name,
}) {
  const pack = {
    skill: name,
    description: `${SCAFFOLD_PLACEHOLDER} Replace with the routing boundary this trigger pack is testing for /${name}.`,
    shouldTrigger: buildTriggerEvalEntries(name, "shouldTrigger"),
    shouldNotTrigger: buildTriggerEvalEntries(name, "shouldNotTrigger"),
  };

  return `${JSON.stringify(pack, null, 2)}\n`;
}

export function buildSkillScaffoldPlan({
  skills,
  name,
  summary = "",
  argumentHint = "<task target or problem description>",
  allowedTools = ["Read", "Grep", "Glob", "Edit", "Write"],
  effort = "medium",
  phase,
  feedbackProfile,
  catalogOrder,
}) {
  const scenarioName = getDefaultEvalScenarioName(name);

  return {
    skillName: name,
    scenarioName,
    files: [
      {
        path: `skills/${name}/SKILL.md`,
        content: renderSkillTemplate({
          name,
          summary,
          argumentHint,
          allowedTools,
          effort,
          phase,
          feedbackProfile,
          catalogOrder,
        }),
      },
      {
        path: `evals/scenarios/${scenarioName}/manifest.json`,
        content: renderEvalManifestTemplate({
          name,
          phase,
        }),
      },
      {
        path: `evals/scenarios/${scenarioName}/README.md`,
        content: renderEvalScenarioReadmeTemplate({
          name,
          phase,
        }),
      },
      {
        path: `evals/scenarios/${scenarioName}/src/example.js`,
        content: renderEvalFixtureTemplate({
          name,
        }),
      },
      {
        path: getDefaultTriggerEvalPath(name),
        content: renderTriggerEvalTemplate({
          name,
        }),
      },
    ],
    catalogOrder: catalogOrder ?? getSuggestedCatalogOrder(skills || [], phase),
  };
}
