import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "fs";
import { join, relative } from "path";
import { getSkillCatalog } from "./catalog.js";
import { getFeedbackTriageDir } from "./feedback.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function walkFiles(rootDir, predicate) {
  if (!existsSync(rootDir)) return [];
  const files = [];

  function visit(currentDir) {
    for (const name of readdirSync(currentDir)) {
      const filePath = join(currentDir, name);
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (!predicate || predicate(filePath)) {
        files.push(filePath);
      }
    }
  }

  visit(rootDir);
  return files.sort();
}

function toAgeDays(timestamp, now) {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return Number(((now.getTime() - parsed) / (24 * 60 * 60 * 1000)).toFixed(2));
}

function readScorecardEntries(scorecardsDir, cwd) {
  const indexPath = join(scorecardsDir, "index.json");
  if (existsSync(indexPath)) {
    const index = readJson(indexPath);
    return {
      source: "index",
      entries: Array.isArray(index.skills) ? index.skills : [],
    };
  }

  const entries = walkFiles(scorecardsDir, (filePath) =>
    filePath.endsWith(".json") && !filePath.endsWith("index.json"),
  ).map((filePath) => {
      const scorecard = readJson(filePath);
      return {
        skill: scorecard.skill,
        generatedAt: scorecard.generatedAt,
        scorecardPath: relative(cwd, filePath),
        scenarioCount: scorecard.summary?.scenarioCount ?? null,
      averageSkillScore: scorecard.summary?.averageSkillScore ?? null,
      averageBaselineScore: scorecard.summary?.averageBaselineScore ?? null,
      averageScoreDelta: scorecard.summary?.averageScoreDelta ?? null,
      status: scorecard.summary?.status ?? null,
    };
  });

  return {
    source: "files",
    entries,
  };
}

export function inspectReleaseScorecards(
  skillNames,
  options = {},
) {
  const cwd = options.cwd || process.cwd();
  const scorecardsDir = options.scorecardsDir || join(cwd, "evals", "scorecards");
  const staleDays = options.staleDays ?? 14;
  const now = options.now || new Date();
  const { source, entries } = readScorecardEntries(scorecardsDir, cwd);
  const bySkill = new Map(entries.map((entry) => [entry.skill, entry]));
  const missingSkills = skillNames.filter((skill) => !bySkill.has(skill)).sort();
  const staleSkills = entries
    .map((entry) => ({
      skill: entry.skill,
      ageDays: toAgeDays(entry.generatedAt, now),
      generatedAt: entry.generatedAt,
    }))
    .filter((entry) => typeof entry.ageDays === "number" && entry.ageDays > staleDays)
    .sort((a, b) => b.ageDays - a.ageDays);
  const regressedSkills = entries
    .filter((entry) => entry.status === "regressed")
    .map((entry) => entry.skill)
    .sort();
  const statusCounts = entries.reduce((acc, entry) => {
    const key = entry.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    source,
    dir: scorecardsDir,
    available: entries.length > 0,
    coveredSkills: entries.length,
    entries,
    missingSkills,
    staleSkills,
    regressedSkills,
    statusCounts,
  };
}

export function inspectReleaseTriggers(
  skillNames,
  options = {},
) {
  const cwd = options.cwd || process.cwd();
  const triggerResultsDir = options.triggerResultsDir || join(cwd, "evals", "trigger-results");
  const staleDays = options.staleDays ?? 14;
  const now = options.now || new Date();
  const reportFiles = walkFiles(triggerResultsDir, (filePath) =>
    filePath.endsWith("report.json"),
  );
  const latestBySkill = new Map();

  for (const filePath of reportFiles) {
    const report = readJson(filePath);
    const current = latestBySkill.get(report.skill);
    const timestamp = Date.parse(report.evaluatedAt || "");
    const currentTimestamp = current ? Date.parse(current.report.evaluatedAt || "") : -1;
    if (!current || timestamp > currentTimestamp) {
      latestBySkill.set(report.skill, { filePath, report });
    }
  }

  const entries = [...latestBySkill.values()]
    .map(({ filePath, report }) => ({
      skill: report.skill,
      evaluatedAt: report.evaluatedAt,
      artifactPath: relative(cwd, filePath),
      overallPassRate: report.summary?.overall?.passRate ?? null,
      validationPassRate: report.summary?.bySet?.validation?.passRate ?? null,
      shouldTriggerPassRate: report.summary?.byCollection?.shouldTrigger?.passRate ?? null,
      shouldNotTriggerPassRate: report.summary?.byCollection?.shouldNotTrigger?.passRate ?? null,
      ageDays: toAgeDays(report.evaluatedAt, now),
    }))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  const missingSkills = skillNames.filter((skill) =>
    !entries.some((entry) => entry.skill === skill),
  ).sort();
  const staleSkills = entries
    .filter((entry) => typeof entry.ageDays === "number" && entry.ageDays > staleDays)
    .sort((a, b) => b.ageDays - a.ageDays);
  const weakValidationSkills = entries
    .filter(
      (entry) =>
        typeof entry.validationPassRate === "number"
        && entry.validationPassRate < 1,
    )
    .sort((a, b) => a.validationPassRate - b.validationPassRate);

  return {
    dir: triggerResultsDir,
    available: entries.length > 0,
    coveredSkills: entries.length,
    entries,
    missingSkills,
    staleSkills,
    weakValidationSkills,
  };
}

function readLatestFeedbackTriage(feedbackTriageDir) {
  if (!existsSync(feedbackTriageDir)) {
    return { report: null, reportPath: null };
  }

  const indexPath = join(feedbackTriageDir, "index.json");
  if (existsSync(indexPath)) {
    return { report: readJson(indexPath), reportPath: indexPath };
  }

  const triageReports = walkFiles(feedbackTriageDir, (filePath) =>
    filePath.endsWith(".json")
    && !filePath.split(/[/\\]/).includes("drafts"),
  )
    .map((filePath) => ({ filePath, report: readJson(filePath) }))
    .sort(
      (a, b) =>
        Date.parse(b.report.generatedAt || "") - Date.parse(a.report.generatedAt || ""),
    );

  return triageReports[0] || { report: null, reportPath: null };
}

export function inspectReleaseFeedbackPromotion(
  {
    cwd = process.cwd(),
    feedbackTriageDir = getFeedbackTriageDir({ scope: "project", cwd }),
  } = {},
) {
  const { report, reportPath } = readLatestFeedbackTriage(feedbackTriageDir);
  const draftsDir = join(feedbackTriageDir, "drafts");
  const draftManifests = walkFiles(draftsDir, (filePath) =>
    filePath.endsWith("manifest.json"),
  );

  return {
    dir: feedbackTriageDir,
    reportPath: reportPath ? relative(cwd, reportPath) : null,
    draftCount: draftManifests.length,
    draftPaths: draftManifests.map((filePath) => relative(cwd, filePath)),
    candidateCount: report?.totals?.candidateCount || 0,
    highPriorityCount: report?.totals?.highPriorityCount || 0,
    skills: report?.skills || [],
  };
}

export function buildReleaseQualitySummary(
  {
    cwd = process.cwd(),
    skillNames = getSkillCatalog().map((skill) => skill.name),
    staleDays = 14,
    now = new Date(),
    scorecardsDir = join(cwd, "evals", "scorecards"),
    triggerResultsDir = join(cwd, "evals", "trigger-results"),
    feedbackTriageDir = getFeedbackTriageDir({ scope: "project", cwd }),
  } = {},
) {
  const scorecards = inspectReleaseScorecards(skillNames, {
    cwd,
    scorecardsDir,
    staleDays,
    now,
  });
  const triggers = inspectReleaseTriggers(skillNames, {
    cwd,
    triggerResultsDir,
    staleDays,
    now,
  });
  const feedback = inspectReleaseFeedbackPromotion({
    cwd,
    feedbackTriageDir,
  });

  const blockingItems = [];
  const attentionItems = [];

  if (scorecards.missingSkills.length > 0) {
    blockingItems.push(
      `Missing scorecards for ${scorecards.missingSkills.length} skill(s): ${scorecards.missingSkills.join(", ")}`,
    );
  }
  if (scorecards.staleSkills.length > 0) {
    blockingItems.push(
      `Stale scorecards older than ${staleDays} day(s): ${scorecards.staleSkills.map((entry) => entry.skill).join(", ")}`,
    );
  }
  if (scorecards.regressedSkills.length > 0) {
    blockingItems.push(
      `Stored scorecards marked regressed: ${scorecards.regressedSkills.join(", ")}`,
    );
  }

  if (triggers.missingSkills.length > 0) {
    blockingItems.push(
      `Missing trigger reports for ${triggers.missingSkills.length} skill(s): ${triggers.missingSkills.join(", ")}`,
    );
  }
  if (triggers.staleSkills.length > 0) {
    blockingItems.push(
      `Stale trigger reports older than ${staleDays} day(s): ${triggers.staleSkills.map((entry) => entry.skill).join(", ")}`,
    );
  }
  if (triggers.weakValidationSkills.length > 0) {
    attentionItems.push(
      `Trigger validation below 100%: ${triggers.weakValidationSkills.map((entry) => `${entry.skill} (${Math.round(entry.validationPassRate * 100)}%)`).join(", ")}`,
    );
  }

  if (feedback.highPriorityCount > 0) {
    blockingItems.push(
      `Open high-priority feedback candidates: ${feedback.highPriorityCount}`,
    );
  }
  if (feedback.candidateCount > 0) {
    attentionItems.push(
      `Feedback triage still has ${feedback.candidateCount} open candidate(s)`,
    );
  }
  if (feedback.draftCount > 0) {
    attentionItems.push(
      `Local feedback-derived eval drafts awaiting review: ${feedback.draftCount}`,
    );
  }

  return {
    kind: "arcana-release-quality",
    generatedAt: now.toISOString(),
    staleDays,
    skillCount: skillNames.length,
    releaseReady: blockingItems.length === 0,
    scorecards,
    triggers,
    feedback,
    blockingItems,
    attentionItems,
  };
}

export function renderReleaseQualityMarkdown(summary) {
  const lines = [
    "# Arcana Release Quality Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    `Release ready: ${summary.releaseReady ? "yes" : "no"}`,
    "",
    "## Scorecards",
    "",
    `- Covered skills: ${summary.scorecards.coveredSkills}/${summary.skillCount}`,
    `- Missing: ${summary.scorecards.missingSkills.length}`,
    `- Stale: ${summary.scorecards.staleSkills.length}`,
    `- Regressed: ${summary.scorecards.regressedSkills.length}`,
    "",
    "## Trigger Runs",
    "",
    `- Covered skills: ${summary.triggers.coveredSkills}/${summary.skillCount}`,
    `- Missing: ${summary.triggers.missingSkills.length}`,
    `- Stale: ${summary.triggers.staleSkills.length}`,
    `- Weak validation: ${summary.triggers.weakValidationSkills.length}`,
    "",
    "## Feedback Promotion",
    "",
    `- Open candidates: ${summary.feedback.candidateCount}`,
    `- High priority: ${summary.feedback.highPriorityCount}`,
    `- Local draft packs: ${summary.feedback.draftCount}`,
    "",
  ];

  if (summary.blockingItems.length > 0) {
    lines.push("## Blocking Items", "");
    for (const item of summary.blockingItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (summary.attentionItems.length > 0) {
    lines.push("## Attention Items", "");
    for (const item of summary.attentionItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
