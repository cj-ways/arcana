import inquirer from "inquirer";
import chalk from "chalk";
import {
  analyzeTranscriptFile,
  buildFeedbackTriage,
  buildFeedbackEntry,
  getFeedbackProfile,
  getRatingOptions,
  loadFeedbackEntries,
  parseReasonsInput,
  saveFeedbackEntry,
  summarizeFeedback,
  writeFeedbackTriageReport,
} from "../utils/feedback.js";
import { writeFeedbackEvalDrafts } from "../utils/feedback-eval-drafts.js";
import {
  buildFeedbackEvalPromotionPlan,
  promoteFeedbackEvalDraft,
} from "../utils/feedback-eval-promotion.js";
import { validateSkillName } from "../utils/skill-scaffold.js";
import { exitWithMessage } from "../utils/cli-errors.js";

function formatLabel(value) {
  return value.replace(/-/g, " ");
}

function printTopList(title, items) {
  if (!items || items.length === 0) return;
  console.log(chalk.dim(`  ${title}:`));
  for (const item of items) {
    const value = item.value.includes(" ")
      ? item.value
      : formatLabel(item.value);
    console.log(chalk.dim(`    - ${value} (${item.count})`));
  }
  console.log();
}

export async function runFeedback(skillArg, opts = {}) {
  let skill = (skillArg || "").trim();

  if (!skill) {
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "skill",
        message: "Which skill are you rating?",
        validate: (input) =>
          input.trim() ? true : "Skill name cannot be empty",
      },
    ]);
    skill = answer.skill.trim();
  }

  const profile = getFeedbackProfile(skill);
  let rating = opts.rating || null;
  const ratingOptions = getRatingOptions();

  if (!rating) {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "rating",
        message: profile.prompt,
        choices: ratingOptions.map((option) => ({
          name: option.label,
          value: option.value,
        })),
      },
    ]);
    rating = answer.rating;
  }

  if (!ratingOptions.some((option) => option.value === rating)) {
    exitWithMessage(`Unknown rating: ${rating}`, {
      steps: [
        "Use one of: helpful, partly-helpful, not-helpful, dismiss.",
        `Try \`arcana feedback ${skill} --rating helpful\` for a quick manual entry.`,
      ],
    });
  }

  if (rating === "dismiss") {
    console.log(chalk.dim("Feedback dismissed. Nothing recorded."));
    return;
  }

  let reasons = parseReasonsInput(opts.reasons);
  if (reasons.length === 0 && rating !== "helpful") {
    const answer = await inquirer.prompt([
      {
        type: "checkbox",
        name: "reasons",
        message: "What should improve?",
        choices: profile.reasons.map((reason) => ({
          name: formatLabel(reason),
          value: reason,
        })),
        validate: (input) =>
          input.length > 0 ? true : "Select at least one reason",
      },
    ]);
    reasons = answer.reasons;
  }

  let notes = opts.notes || "";
  if (!notes) {
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "notes",
        message:
          rating === "helpful"
            ? "Anything that worked especially well? (optional)"
            : "Anything we should improve? (optional)",
      },
    ]);
    notes = answer.notes || "";
  }

  const transcriptPath = opts.transcript || null;
  let transcriptConsent = false;
  let transcriptAnalysis = null;

  if (opts.analyzeTranscript && !transcriptPath) {
    exitWithMessage("`--analyze-transcript` requires `--transcript <path>`.", {
      steps: [
        `Try \`arcana feedback ${skill} --transcript ./session.txt --analyze-transcript\`.`,
      ],
    });
  }

  if (transcriptPath) {
    if (opts.analyzeTranscript === true) {
      transcriptConsent = true;
    } else if (opts.analyzeTranscript !== false) {
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "transcriptConsent",
          message: profile.transcriptConsentPrompt,
          default: false,
        },
      ]);
      transcriptConsent = answer.transcriptConsent;
    }

    if (transcriptConsent) {
      transcriptAnalysis = analyzeTranscriptFile(transcriptPath, skill);
    }
  }

  const entry = buildFeedbackEntry({
    skill,
    rating,
    reasons,
    notes,
    transcriptAnalysis,
    transcriptPath,
    transcriptConsent,
  });

  const savePath = saveFeedbackEntry(entry, { scope: opts.scope || "project" });

  if (opts.json) {
    console.log(JSON.stringify({ entry, savePath }, null, 2));
    return;
  }

  console.log(chalk.bold("\n✦ Arcana Feedback\n"));
  console.log(chalk.green(`  Saved feedback for /${skill}`));
  console.log(chalk.dim(`  Rating: ${formatLabel(rating)}`));
  if (reasons.length > 0) {
    console.log(
      chalk.dim(
        `  Reasons: ${reasons.map((reason) => formatLabel(reason)).join(", ")}`,
      ),
    );
  }
  if (notes.trim()) {
    console.log(chalk.dim(`  Notes: ${notes.trim()}`));
  }
  console.log(chalk.dim(`  Stored in: ${savePath}`));

  if (transcriptAnalysis) {
    console.log();
    console.log(chalk.blue("  Transcript Analysis"));
    console.log(chalk.dim(`    ${transcriptAnalysis.summary}`));

    if (transcriptAnalysis.recommendations.length > 0) {
      console.log(chalk.dim("    Recommendations:"));
      for (const recommendation of transcriptAnalysis.recommendations) {
        console.log(chalk.dim(`      - ${recommendation}`));
      }
    }
  }

  console.log();
}

export async function runFeedbackReport(skillArg, opts = {}) {
  const entries = loadFeedbackEntries({ scope: opts.scope || "all" });
  const skill = skillArg ? skillArg.trim() : null;
  const summary = summarizeFeedback(entries, skill || null);

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(chalk.bold("\n✦ Arcana Feedback Report\n"));

  if (summary.totalEntries === 0) {
    if (skill) {
      console.log(chalk.yellow(`  No feedback recorded yet for /${skill}.\n`));
    } else {
      console.log(chalk.yellow("  No Arcana feedback recorded yet.\n"));
    }
    return;
  }

  if (skill) {
    console.log(chalk.green(`  Skill: /${skill}`));
  }

  console.log(chalk.dim(`  Entries: ${summary.totalEntries}`));
  if (typeof summary.averageScore === "number") {
    console.log(
      chalk.dim(
        `  Average score: ${(summary.averageScore * 100).toFixed(0)} / 100`,
      ),
    );
  }

  const ratings = Object.entries(summary.ratingCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => `${formatLabel(value)} (${count})`);
  if (ratings.length > 0) {
    console.log(chalk.dim(`  Ratings: ${ratings.join(", ")}`));
  }

  console.log();
  if (!skill) {
    printTopList("Most-rated skills", summary.skillCounts);
  }
  printTopList("Top reasons", summary.topReasons);
  printTopList("Top recommendations", summary.topRecommendations);
}

export async function runFeedbackTriage(skillArg, opts = {}) {
  const parsedMinOccurrences =
    opts.minOccurrences === undefined
      ? 2
      : Number.parseInt(String(opts.minOccurrences), 10);
  const parsedDraftLimit =
    opts.draftLimit === undefined
      ? null
      : Number.parseInt(String(opts.draftLimit), 10);

  if (!Number.isFinite(parsedMinOccurrences) || parsedMinOccurrences < 1) {
    exitWithMessage(`Invalid --min-occurrences: ${opts.minOccurrences}`, {
      steps: [
        "Use an integer of 1 or greater.",
        "Try `arcana feedback-triage --min-occurrences 2`.",
      ],
    });
  }

  if (
    parsedDraftLimit !== null &&
    (!Number.isFinite(parsedDraftLimit) || parsedDraftLimit < 1)
  ) {
    exitWithMessage(`Invalid --draft-limit: ${opts.draftLimit}`, {
      steps: [
        "Use an integer of 1 or greater.",
        "Try `arcana feedback-triage --write-drafts --draft-limit 1`.",
      ],
    });
  }

  const skill = skillArg ? skillArg.trim() : null;
  const entries = loadFeedbackEntries({ scope: opts.scope || "all" });
  const report = buildFeedbackTriage(entries, {
    skillName: skill || null,
    minOccurrences: parsedMinOccurrences,
  });

  let savePath = null;
  let draftPaths = [];
  if (opts.write) {
    const writeScope = opts.scope === "user" ? "user" : "project";
    savePath = writeFeedbackTriageReport(report, {
      scope: writeScope,
      cwd: process.cwd(),
    });
  }

  if (opts.writeDrafts) {
    const writeScope = opts.scope === "user" ? "user" : "project";
    const draftResult = writeFeedbackEvalDrafts(report, {
      scope: writeScope,
      cwd: process.cwd(),
      maxPerSkill: parsedDraftLimit,
    });
    draftPaths = draftResult.written;
  }

  if (opts.json) {
    console.log(JSON.stringify({ report, savePath, draftPaths }, null, 2));
    return;
  }

  console.log(chalk.bold("\n✦ Arcana Feedback Triage\n"));
  console.log(chalk.dim(`  Submitted entries: ${report.totals.submittedEntries}`));
  console.log(chalk.dim(`  Candidate eval follow-ups: ${report.totals.candidateCount}`));
  console.log(chalk.dim(`  High priority: ${report.totals.highPriorityCount}`));

  if (report.skills.length === 0) {
    console.log();
    console.log(
      chalk.yellow(
        skill
          ? `  No repeated feedback signals yet for /${skill}.`
          : "  No repeated feedback signals yet across the current feedback set.",
      ),
    );
    console.log(
      chalk.dim(
        `  Keep collecting feedback or lower the threshold with --min-occurrences ${Math.max(
          1,
          parsedMinOccurrences - 1,
        )}.`,
      ),
    );
    if (savePath) {
      console.log(chalk.dim(`  Stored in: ${savePath}`));
    }
    console.log();
    return;
  }

  for (const skillEntry of report.skills) {
    console.log();
    console.log(chalk.green(`  /${skillEntry.skill}`));
    console.log(
      chalk.dim(
        `    ${skillEntry.candidates.length} candidate(s) from ${skillEntry.negativeEntries} negative or partial entry(ies).`,
      ),
    );

    for (const candidate of skillEntry.candidates) {
      console.log(
        chalk.dim(
          `    - ${candidate.priority.toUpperCase()} · ${candidate.label} (${candidate.occurrences}x, impact ${candidate.impactScore}) → ${candidate.suggestedEval.kind}/${candidate.suggestedEval.dimension}`,
        ),
      );
      console.log(chalk.dim(`      Next eval: ${candidate.suggestedEval.nextAction}`));

      if (candidate.examples.length > 0) {
        console.log(chalk.dim(`      Example: ${candidate.examples[0]}`));
      }
    }
  }

  if (savePath) {
    console.log();
    console.log(chalk.dim(`  Stored in: ${savePath}`));
  }

  if (draftPaths.length > 0) {
    console.log();
    console.log(chalk.blue("  Local Eval Drafts"));
    for (const draft of draftPaths) {
      console.log(
        chalk.dim(
          `    - /${draft.skill} · ${draft.signal} → ${draft.dir}`,
        ),
      );
    }
    console.log(
      chalk.dim(
        "    Review these local drafts before promoting them into evals/scenarios/.",
      ),
    );
  }

  console.log();
}

export async function runFeedbackPromote(skillArg, signalArg, opts = {}) {
  const skill = String(skillArg || "").trim();
  const signal = String(signalArg || "").trim();
  const scope = opts.scope || "project";
  const scenarioName = opts.scenarioName ? String(opts.scenarioName).trim() : null;

  if (!skill || !signal) {
    exitWithMessage("`feedback-promote` requires both <skill> and <signal>.", {
      steps: [
        "Use `arcana feedback-promote <skill> <signal>`.",
        "Example: `arcana feedback-promote deep-fix wrong-assumptions`.",
      ],
    });
  }

  if (!validateSkillName(skill)) {
    exitWithMessage(`Invalid skill name: ${skill}`, {
      steps: [
        "Use lowercase kebab-case skill names.",
        "Example: `arcana feedback-promote deep-fix wrong-assumptions`.",
      ],
    });
  }

  if (scenarioName && !validateSkillName(scenarioName)) {
    exitWithMessage(`Invalid --scenario-name: ${scenarioName}`, {
      steps: [
        "Use lowercase kebab-case for promoted scenario names.",
        "Example: `arcana feedback-promote deep-fix wrong-assumptions --scenario-name deep-fix-api-gateway-assumption`.",
      ],
    });
  }

  const plan = buildFeedbackEvalPromotionPlan(skill, signal, {
    scope,
    cwd: process.cwd(),
    scenarioName,
  });

  if (!plan.found) {
    exitWithMessage(plan.issues[0], {
      steps: [
        `Generate a draft first with \`arcana feedback-triage ${skill} --write-drafts\`.`,
        `Then review the draft under \`.arcana/feedback/triage/drafts/${skill}/\`.`,
      ],
    });
  }

  if (plan.targetExists && !opts.force) {
    exitWithMessage(
      `Scenario '${plan.scenarioName}' already exists at ${plan.targetDir}.`,
      {
        steps: [
          "Use `--scenario-name` to promote into a new scenario directory.",
          "Use `--force` only when you intend to replace the existing scenario.",
        ],
      },
    );
  }

  if (opts.json) {
    if (opts.dryRun) {
      console.log(JSON.stringify({ plan, result: null }, null, 2));
      return;
    }

    if (plan.issues.length > 0) {
      console.log(JSON.stringify({ plan, result: null }, null, 2));
      process.exit(1);
    }

    const result = promoteFeedbackEvalDraft(plan, {
      scope,
      cwd: process.cwd(),
      force: Boolean(opts.force),
    });
    console.log(JSON.stringify({ plan, result }, null, 2));
    return;
  }

  console.log(chalk.bold("\n✦ Arcana Feedback Promote\n"));
  console.log(chalk.dim(`  Skill: ${skill}`));
  console.log(chalk.dim(`  Signal: ${plan.signalSlug}`));
  console.log(chalk.dim(`  Draft: ${plan.draftDir}`));
  console.log(chalk.dim(`  Target: ${plan.targetDir}`));
  console.log(chalk.dim(`  Fixture files: ${plan.fixtureFiles.length}`));

  if (plan.placeholderFiles.length > 0) {
    console.log(
      chalk.dim(`  Placeholder files: ${plan.placeholderFiles.join(", ")}`),
    );
  }

  if (plan.issues.length > 0) {
    console.log();
    console.log(chalk.yellow("  Promotion blocked"));
    for (const issue of plan.issues) {
      console.log(chalk.dim(`    - ${issue}`));
    }
    console.log();
    console.log(
      chalk.dim(
        "  Finish the draft locally, add a real fixture, and remove all placeholders before promotion.",
      ),
    );
    console.log();
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log();
    console.log(chalk.green("  Draft is promotable."));
    console.log(
      chalk.dim(
        `  Would copy the reviewed draft into evals/scenarios/${plan.scenarioName}/ and archive the source draft.`,
      ),
    );
    console.log();
    return;
  }

  const result = promoteFeedbackEvalDraft(plan, {
    scope,
    cwd: process.cwd(),
    force: Boolean(opts.force),
  });

  console.log();
  console.log(chalk.green(`  Promoted to evals/scenarios/${result.scenarioName}/`));
  console.log(chalk.dim(`  Archived draft: ${result.archiveDir}`));
  console.log(chalk.dim(`  Promoted files: ${result.promotedFiles.length}`));
  console.log();
}
