#!/usr/bin/env node

/**
 * Arcana Layer 1 Boundary Eval Runner
 *
 * Evaluates same-topic taxonomy boundaries across multiple skills using stored
 * suites under evals/trigger-boundaries/.
 *
 * Usage:
 *   node evals/run-trigger-boundary.js
 *   node evals/run-trigger-boundary.js --suite feature-taxonomy
 *   node evals/run-trigger-boundary.js --suite feature-taxonomy --run --runs 3
 *   node evals/run-trigger-boundary.js --suite feature-taxonomy --run --set validation
 *   node evals/run-trigger-boundary.js --suite feature-taxonomy --run --topic invite-approvals
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import {
  buildCatalogIndex,
  buildRouterPrompt,
  invokeRouter,
  parseRouterResponse,
} from "./run-trigger-eval.js";
import {
  TRIGGER_BOUNDARY_SETS,
  listTriggerBoundarySuites,
  readTriggerBoundarySuite,
  validateTriggerBoundarySuite,
} from "../src/utils/trigger-boundaries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "trigger-boundary-results");
const DEFAULT_RUNS = 3;
const VALID_SET_FILTERS = Object.freeze(["all", ...TRIGGER_BOUNDARY_SETS]);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function dedupe(values) {
  return [...new Set(values)];
}

function toPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null) return DEFAULT_RUNS;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSetFilter(value) {
  if (!value) return "all";
  return VALID_SET_FILTERS.includes(value) ? value : null;
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .replace(/[^a-z0-9-_]+/giu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

export function validateBoundarySuiteAgainstCatalog(suite, catalogNames) {
  const issues = [...validateTriggerBoundarySuite(suite)];
  const knownSkills = new Set(catalogNames);

  for (const topic of toArray(suite?.topics)) {
    for (const caseEntry of toArray(topic?.cases)) {
      for (const fieldName of ["expectedSkills", "forbiddenSkills"]) {
        for (const skillName of toArray(caseEntry?.[fieldName])) {
          if (!knownSkills.has(skillName)) {
            issues.push(
              `topic '${topic?.id || "<missing topic>"}' case '${caseEntry?.id || "<missing case>"}' references unknown skill '${skillName}' in ${fieldName}`,
            );
          }
        }
      }
    }
  }

  return issues;
}

export function buildBoundaryPlan(suite, { setFilter = "all", topicFilter = "all" } = {}) {
  const plan = [];

  for (const topic of toArray(suite.topics)) {
    if (setFilter !== "all" && topic.set !== setFilter) continue;
    if (topicFilter !== "all" && topic.id !== topicFilter) continue;

    for (const caseEntry of toArray(topic.cases)) {
      plan.push({ topic, caseEntry });
    }
  }

  return plan;
}

function getBoundaryExpectations(caseEntry) {
  return {
    expectedSkills: dedupe(toArray(caseEntry.expectedSkills)),
    forbiddenSkills: dedupe(toArray(caseEntry.forbiddenSkills)),
    allowAdditionalSkills: caseEntry.allowAdditionalSkills ?? false,
  };
}

export function gradeBoundaryAttempt({ topic, caseEntry, response }) {
  const expectations = getBoundaryExpectations(caseEntry);
  const selectedSkills = response.selectedSkills || [];
  const missingExpected = expectations.expectedSkills.filter((skill) =>
    !selectedSkills.includes(skill),
  );
  const forbiddenSelected = expectations.forbiddenSkills.filter((skill) =>
    selectedSkills.includes(skill),
  );
  const unexpectedSelected = expectations.allowAdditionalSkills
    ? []
    : selectedSkills.filter((skill) => !expectations.expectedSkills.includes(skill));
  const unknownSkills = response.unknownSkills || [];
  const pass = missingExpected.length === 0
    && forbiddenSelected.length === 0
    && unexpectedSelected.length === 0
    && unknownSkills.length === 0;

  return {
    pass,
    topicId: topic.id,
    selectedSkills,
    unknownSkills,
    missingExpected,
    forbiddenSelected,
    unexpectedSelected,
    reasoning: response.reasoning,
    closestAlternatives: response.closestAlternatives || [],
    confidence: response.confidence,
    expectedSkills: expectations.expectedSkills,
    forbiddenSkills: expectations.forbiddenSkills,
    allowAdditionalSkills: expectations.allowAdditionalSkills,
  };
}

export function summarizeBoundaryCaseAttempts(attempts) {
  const totalRuns = attempts.length;
  const successfulRuns = attempts.filter((attempt) => !attempt.error);
  const erroredRuns = totalRuns - successfulRuns.length;
  const passCount = successfulRuns.filter((attempt) => attempt.pass).length;
  const selectionFrequency = {};

  for (const attempt of successfulRuns) {
    for (const skill of attempt.selectedSkills || []) {
      selectionFrequency[skill] = (selectionFrequency[skill] || 0) + 1;
    }
  }

  return {
    runsRequested: totalRuns,
    successfulRuns: successfulRuns.length,
    erroredRuns,
    passCount,
    passRate: successfulRuns.length > 0 ? passCount / successfulRuns.length : null,
    selectionFrequency,
  };
}

export function summarizeBoundaryReport(report) {
  const allCases = report.cases || [];
  const overallSuccessfulRuns = allCases.reduce(
    (sum, entry) => sum + (entry.summary.successfulRuns || 0),
    0,
  );
  const overallPassCount = allCases.reduce(
    (sum, entry) => sum + (entry.summary.passCount || 0),
    0,
  );

  const bySet = Object.fromEntries(
    TRIGGER_BOUNDARY_SETS.map((setName) => {
      const setCases = allCases.filter((entry) => entry.topic.set === setName);
      const successfulRuns = setCases.reduce(
        (sum, entry) => sum + (entry.summary.successfulRuns || 0),
        0,
      );
      const passCount = setCases.reduce(
        (sum, entry) => sum + (entry.summary.passCount || 0),
        0,
      );

      return [setName, {
        cases: setCases.length,
        successfulRuns,
        passRate: successfulRuns > 0 ? passCount / successfulRuns : null,
      }];
    }),
  );

  const byTopic = Object.fromEntries(
    toArray(report.topics).map((topic) => {
      const topicCases = allCases.filter((entry) => entry.topic.id === topic.id);
      const successfulRuns = topicCases.reduce(
        (sum, entry) => sum + (entry.summary.successfulRuns || 0),
        0,
      );
      const passCount = topicCases.reduce(
        (sum, entry) => sum + (entry.summary.passCount || 0),
        0,
      );

      return [topic.id, {
        set: topic.set,
        cases: topicCases.length,
        successfulRuns,
        passRate: successfulRuns > 0 ? passCount / successfulRuns : null,
      }];
    }),
  );

  return {
    overall: {
      cases: allCases.length,
      successfulRuns: overallSuccessfulRuns,
      passRate: overallSuccessfulRuns > 0 ? overallPassCount / overallSuccessfulRuns : null,
    },
    bySet,
    byTopic,
  };
}

function runBoundaryAttempt(topic, caseEntry, runIndex, catalogIndex) {
  const prompt = buildRouterPrompt(caseEntry.prompt, catalogIndex.skills);

  try {
    const rawOutput = invokeRouter(prompt);
    const response = parseRouterResponse(rawOutput, catalogIndex);
    const graded = gradeBoundaryAttempt({
      topic,
      caseEntry,
      response,
    });

    return {
      runIndex,
      rawOutput,
      error: null,
      ...graded,
    };
  } catch (err) {
    const stderr = err?.stderr ? String(err.stderr).trim() : "";
    const stdout = err?.stdout ? String(err.stdout).trim() : "";
    const detail = [stderr, stdout].filter(Boolean).join("\n\n");

    return {
      runIndex,
      pass: false,
      rawOutput: detail,
      error: detail
        ? `${err?.message || String(err)}\n${detail}`
        : (err?.message || String(err)),
      topicId: topic.id,
      selectedSkills: [],
      unknownSkills: [],
      missingExpected: [],
      forbiddenSelected: [],
      unexpectedSelected: [],
      reasoning: "",
      closestAlternatives: [],
      confidence: null,
      ...getBoundaryExpectations(caseEntry),
    };
  }
}

function writeReportArtifacts(report) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = Date.now();
  const artifactDir = join(RESULTS_DIR, `${sanitizeFileSegment(report.name)}_${timestamp}`);
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  for (const entry of report.cases) {
    for (const attempt of entry.attempts) {
      const filename = `${sanitizeFileSegment(entry.topic.id)}_${sanitizeFileSegment(entry.caseEntry.id)}_run${attempt.runIndex}.txt`;
      writeFileSync(join(artifactDir, filename), attempt.rawOutput || "");
    }
  }

  return artifactDir;
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    suite: null,
    run: false,
    runs: DEFAULT_RUNS,
    setFilter: "all",
    topicFilter: "all",
  };

  while (args.length > 0) {
    const current = args.shift();
    if (!current) continue;

    switch (current) {
      case "--suite":
        options.suite = args.shift() || null;
        break;
      case "--run":
        options.run = true;
        break;
      case "--runs":
        options.runs = parsePositiveInteger(args.shift());
        break;
      case "--set":
        options.setFilter = parseSetFilter(args.shift());
        break;
      case "--topic":
        options.topicFilter = args.shift() || "all";
        break;
      case "--help":
        printUsageAndExit();
        break;
      default:
        printUsageAndExit(`Unknown argument: ${current}`);
    }
  }

  return options;
}

function printUsageAndExit(message) {
  if (message) console.error(message);
  console.error("");
  console.error("Usage:");
  console.error("  node evals/run-trigger-boundary.js");
  console.error("  node evals/run-trigger-boundary.js --suite feature-taxonomy");
  console.error("  node evals/run-trigger-boundary.js --suite feature-taxonomy --run");
  console.error("  node evals/run-trigger-boundary.js --suite feature-taxonomy --run --runs 3");
  console.error("  node evals/run-trigger-boundary.js --suite feature-taxonomy --run --set validation");
  console.error("  node evals/run-trigger-boundary.js --suite feature-taxonomy --run --topic invite-approvals");
  process.exit(message ? 1 : 0);
}

function printPlan(suite, plan) {
  const countsBySet = Object.fromEntries(
    TRIGGER_BOUNDARY_SETS.map((setName) => [
      setName,
      plan.filter((entry) => entry.topic.set === setName).length,
    ]),
  );

  console.log(`  ${suite.name}`);
  console.log(`    ${suite.description}`);
  console.log(`    Cases: ${plan.length}`);
  console.log(`    Train: ${countsBySet.train} | Validation: ${countsBySet.validation}`);
  console.log(`    Topics: ${dedupe(plan.map((entry) => entry.topic.id)).join(", ") || "none"}`);
}

function printRunSummary(report) {
  console.log(`  ${report.name}`);
  console.log(`    ${report.description}`);
  console.log(`    Cases: ${report.summary.overall.cases} | Successful runs: ${report.summary.overall.successfulRuns}`);
  console.log(
    `    Overall pass ${toPercent(report.summary.overall.passRate)} | train ${toPercent(report.summary.bySet.train.passRate)} | validation ${toPercent(report.summary.bySet.validation.passRate)}`,
  );

  const weakCases = report.cases
    .filter((entry) => entry.summary.passRate !== null && entry.summary.passRate < 1)
    .sort((a, b) => (a.summary.passRate ?? 0) - (b.summary.passRate ?? 0))
    .slice(0, 6);

  if (weakCases.length > 0) {
    console.log("    Weak cases:");
    for (const entry of weakCases) {
      const selectionSummary = Object.entries(entry.summary.selectionFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([skill, count]) => `${skill}:${count}`)
        .join(", ");

      console.log(
        `      - ${entry.topic.id}/${entry.caseEntry.id} pass ${toPercent(entry.summary.passRate)}${selectionSummary ? ` | selections ${selectionSummary}` : ""}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.runs) printUsageAndExit("Invalid --runs value. Use a positive integer.");
  if (!options.setFilter) printUsageAndExit("Invalid --set value. Use all, train, or validation.");

  const catalogIndex = buildCatalogIndex();
  const suiteNames = options.suite ? [options.suite] : listTriggerBoundarySuites();

  if (suiteNames.length === 0) {
    console.log("No boundary suites found under evals/trigger-boundaries.");
    process.exit(0);
  }

  console.log("✦ Arcana Trigger Boundary Eval\n");

  for (const suiteName of suiteNames) {
    const suite = readTriggerBoundarySuite(suiteName);
    const validationIssues = validateBoundarySuiteAgainstCatalog(suite, catalogIndex.skillNames);
    if (validationIssues.length > 0) {
      console.log(`  ${suiteName}`);
      for (const issue of validationIssues) {
        console.log(`    - ${issue}`);
      }
      console.log("");
      continue;
    }

    const plan = buildBoundaryPlan(suite, {
      setFilter: options.setFilter,
      topicFilter: options.topicFilter,
    });

    if (!options.run) {
      printPlan(suite, plan);
      console.log("");
      continue;
    }

    const caseReports = [];
    for (const entry of plan) {
      const attempts = [];
      for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
        attempts.push(runBoundaryAttempt(entry.topic, entry.caseEntry, runIndex, catalogIndex));
      }

      caseReports.push({
        topic: entry.topic,
        caseEntry: entry.caseEntry,
        attempts,
        summary: summarizeBoundaryCaseAttempts(attempts),
      });
    }

    const report = {
      name: suite.name,
      description: suite.description,
      runsRequested: options.runs,
      setFilter: options.setFilter,
      topicFilter: options.topicFilter,
      evaluatedAt: new Date().toISOString(),
      catalogSkillCount: catalogIndex.skills.length,
      topics: suite.topics,
      cases: caseReports,
    };
    report.summary = summarizeBoundaryReport(report);
    report.artifactDir = writeReportArtifacts(report);

    printRunSummary(report);
    console.log(`    Results saved: ${relative(process.cwd(), report.artifactDir)}\n`);
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
