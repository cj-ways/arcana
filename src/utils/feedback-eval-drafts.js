import fsExtra from "fs-extra";
const { ensureDirSync, writeFileSync } = fsExtra;
import { join } from "path";
import { getFeedbackTriageDir } from "./feedback.js";
import { formatSkillTitle, slugifySkillName } from "./skill-scaffold.js";

function getDimensionWeights(primaryDimension) {
  switch (primaryDimension) {
    case "route":
      return { route: 0.6, process: 0.2, outcome: 0.2 };
    case "process":
      return { route: 0.2, process: 0.6, outcome: 0.2 };
    case "outcome":
    default:
      return { route: 0.2, process: 0.2, outcome: 0.6 };
  }
}

function renderExamples(examples = []) {
  if (examples.length === 0) {
    return "- No concrete feedback snippets were preserved. Replace this with the clearest user complaint before promoting.\n";
  }

  return examples.map((example) => `- ${example}`).join("\n") + "\n";
}

function renderRecommendations(recommendations = []) {
  if (recommendations.length === 0) {
    return "- No transcript-derived recommendations were captured for this candidate.\n";
  }

  return (
    recommendations
      .map((item) => `- ${item.value} (${item.count})`)
      .join("\n") + "\n"
  );
}

export function getFeedbackEvalDraftsDir({
  scope = "project",
  cwd = process.cwd(),
  home,
} = {}) {
  return join(getFeedbackTriageDir({ scope, cwd, home }), "drafts");
}

export function buildFeedbackEvalDraft(skillEntry, candidate) {
  const skill = skillEntry.skill;
  const signalSlug = slugifySkillName(candidate.signal);
  const scenarioName = `${skill}-${signalSlug}-feedback`;
  const artifactPath = `artifacts/${scenarioName}-report.md`;
  const weights = getDimensionWeights(candidate.suggestedEval.dimension);

  const manifest = {
    name: scenarioName,
    skill,
    description: `Feedback-derived draft scenario for /${skill} targeting repeated "${candidate.label}" complaints.`,
    prompt: `TODO: replace with a real task prompt that reproduces the repeated "${candidate.label}" complaint for /${skill}. Write the final artifact to ${artifactPath}.`,
    scoring: {
      weights,
    },
    expected: [
      {
        id: "report-file-created",
        description: "Draft artifact file exists",
        dimension: "route",
        type: "file-created",
        file: artifactPath,
      },
      {
        id: `targeted-${candidate.signal}`,
        description: `TODO: replace with deterministic evidence that /${skill} addressed the repeated "${candidate.label}" issue.`,
        dimension: candidate.suggestedEval.dimension,
        type: "file-contains",
        file: artifactPath,
        contentIncludes: [
          "TODO: replace with a deterministic expected signal derived from a real fixture",
        ],
      },
    ],
    falsePositives: [
      {
        id: "false-positive-trap",
        description: "TODO: add a regression or false-positive trap related to this complaint.",
        dimension: candidate.suggestedEval.dimension,
        type: "file-contains",
        file: artifactPath,
        contentIncludes: [
          "TODO: replace with a bad signal that must NOT appear",
        ],
      },
    ],
  };

  const title = formatSkillTitle(skill);
  const readme = `# ${title} Feedback-Derived Eval Draft

This local draft was generated from repeated user feedback for \`/${skill}\`.

## Candidate Summary

- Signal: ${candidate.label}
- Priority: ${candidate.priority}
- Occurrences: ${candidate.occurrences}
- Impact score: ${candidate.impactScore}
- Primary eval dimension: ${candidate.suggestedEval.dimension}
- Suggested eval kind: ${candidate.suggestedEval.kind}

## Why This Exists

${candidate.suggestedEval.nextAction}

## Preserved Feedback Snippets

${renderExamples(candidate.examples)}
## Transcript Recommendations

${renderRecommendations(candidate.topRecommendations)}
## Assertion Hints

${candidate.suggestedEval.assertionHints.map((hint) => `- ${hint}`).join("\n")}

## Promotion Checklist

1. Copy this draft into \`evals/scenarios/${scenarioName}/\`.
2. Replace the prompt with a real task that reproduces the complaint.
3. Add the smallest realistic fixture needed to make the failure deterministic.
4. Replace all \`TODO:\` placeholders with concrete assertions.
5. Run \`node evals/run-eval.js --scenario ${scenarioName} --run --runs 3\`.
`;

  const evidence = `# Feedback Evidence

## Candidate

- Skill: /${skill}
- Signal: ${candidate.label}
- Priority: ${candidate.priority}
- Repeated occurrences: ${candidate.occurrences}
- Average penalty: ${candidate.averagePenalty}

## Rating Counts

${Object.entries(candidate.ratingCounts)
  .map(([rating, count]) => `- ${rating}: ${count}`)
  .join("\n")}

## Feedback Snippets

${renderExamples(candidate.examples)}
## Suggested Eval Shape

- Kind: ${candidate.suggestedEval.kind}
- Dimension: ${candidate.suggestedEval.dimension}
- Next action: ${candidate.suggestedEval.nextAction}

## Assertion Hints

${candidate.suggestedEval.assertionHints.map((hint) => `- ${hint}`).join("\n")}
`;

  return {
    skill,
    signal: candidate.signal,
    signalSlug,
    scenarioName,
    artifactPath,
    manifest,
    readme,
    evidence,
  };
}

export function writeFeedbackEvalDrafts(
  report,
  {
    scope = "project",
    cwd = process.cwd(),
    home,
    maxPerSkill = null,
  } = {},
) {
  const draftsDir = getFeedbackEvalDraftsDir({ scope, cwd, home });
  const written = [];

  for (const skillEntry of report.skills) {
    const candidates =
      typeof maxPerSkill === "number" && maxPerSkill > 0
        ? skillEntry.candidates.slice(0, maxPerSkill)
        : skillEntry.candidates;

    for (const candidate of candidates) {
      const draft = buildFeedbackEvalDraft(skillEntry, candidate);
      const draftDir = join(draftsDir, draft.skill, draft.signalSlug);
      ensureDirSync(draftDir);
      writeFileSync(
        join(draftDir, "manifest.json"),
        `${JSON.stringify(draft.manifest, null, 2)}\n`,
      );
      writeFileSync(join(draftDir, "README.md"), `${draft.readme.trimEnd()}\n`);
      writeFileSync(join(draftDir, "evidence.md"), `${draft.evidence.trimEnd()}\n`);

      written.push({
        skill: draft.skill,
        signal: draft.signal,
        scenarioName: draft.scenarioName,
        dir: draftDir,
      });
    }
  }

  return {
    draftsDir,
    written,
  };
}
