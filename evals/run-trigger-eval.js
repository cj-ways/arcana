#!/usr/bin/env node

/**
 * Arcana Layer 1 Trigger Eval Runner
 *
 * Evaluates whether a user query should route to a given skill based on the
 * skill catalog descriptions, using stored should-trigger / should-not-trigger
 * packs under evals/triggers/.
 *
 * Usage:
 *   node evals/run-trigger-eval.js
 *   node evals/run-trigger-eval.js --skill pressure-test
 *   node evals/run-trigger-eval.js --skill pressure-test --run
 *   node evals/run-trigger-eval.js --skill pressure-test --run --runs 3
 *   node evals/run-trigger-eval.js --skill pressure-test --run --set validation
 *   node evals/run-trigger-eval.js --skill pressure-test --run --collection shouldNotTrigger
 */

import { execFileSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { getSkillCatalog } from "../src/utils/catalog.js";
import {
  TRIGGER_EVAL_COLLECTIONS,
  TRIGGER_EVAL_SETS,
  listTriggerEvalSkills,
  readTriggerEvalPack,
  validateTriggerEvalPack,
} from "../src/utils/trigger-evals.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "trigger-results");
const DEFAULT_RUNS = 3;
const DEFAULT_MAX_TURNS = 1;
const DEFAULT_TIMEOUT_MS = 60000;
const VALID_SET_FILTERS = Object.freeze(["all", ...TRIGGER_EVAL_SETS]);
const VALID_COLLECTION_FILTERS = Object.freeze(["all", ...TRIGGER_EVAL_COLLECTIONS]);
const ROUTER_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["selectedSkills", "reasoning"],
  properties: {
    selectedSkills: {
      type: "array",
      items: { type: "string" },
    },
    reasoning: {
      type: "string",
    },
    closestAlternatives: {
      type: "array",
      items: { type: "string" },
    },
    confidence: {
      type: "number",
    },
  },
});

function toArray(value) {
  return Array.isArray(value) ? value : [];
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

function parseCollectionFilter(value) {
  if (!value) return "all";
  return VALID_COLLECTION_FILTERS.includes(value) ? value : null;
}

function dedupe(values) {
  return [...new Set(values)];
}

export function buildCatalogIndex() {
  const skills = getSkillCatalog()
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      phase: skill.phase,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const skillByLowerName = new Map(
    skills.map((skill) => [skill.name.toLowerCase(), skill.name]),
  );

  return {
    skills,
    skillByLowerName,
    skillNames: skills.map((skill) => skill.name),
    skillNameSet: new Set(skills.map((skill) => skill.name)),
  };
}

export function validateTriggerPackAgainstCatalog(pack, catalogNames) {
  const issues = [...validateTriggerEvalPack(pack)];
  const knownSkills = new Set(catalogNames);

  if (pack?.skill && !knownSkills.has(pack.skill)) {
    issues.push(`Unknown target skill '${pack.skill}'`);
  }

  for (const collectionName of TRIGGER_EVAL_COLLECTIONS) {
    for (const entry of toArray(pack?.[collectionName])) {
      for (const fieldName of ["expectedSkills", "forbiddenSkills"]) {
        for (const skillName of toArray(entry?.[fieldName])) {
          if (!knownSkills.has(skillName)) {
            issues.push(
              `${collectionName} query '${entry?.id || "<missing id>"}' references unknown skill '${skillName}' in ${fieldName}`,
            );
          }
        }
      }
    }
  }

  return issues;
}

export function buildTriggerPlan(pack, { setFilter = "all", collectionFilter = "all" } = {}) {
  const selectedCollections = collectionFilter === "all"
    ? [...TRIGGER_EVAL_COLLECTIONS]
    : [collectionFilter];

  const queries = [];

  for (const collectionName of selectedCollections) {
    for (const query of toArray(pack[collectionName])) {
      if (setFilter !== "all" && query.set !== setFilter) continue;
      queries.push({
        collectionName,
        query,
      });
    }
  }

  return queries;
}

export function buildRouterPrompt(userPrompt, skillCatalog) {
  const catalogBlock = skillCatalog
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");

  return [
    "You are evaluating Arcana skill routing.",
    "Select the minimal set of skills whose descriptions clearly match the user request.",
    "Rules:",
    "- Choose from the provided skill names only.",
    "- It is valid to return an empty array when nothing clearly matches.",
    "- Do not select a skill because of one overlapping keyword.",
    "- Prefer the most specific workflow when one skill clearly fits better than a broader alternative.",
    "- Return JSON that matches the schema exactly.",
    "",
    "Available Arcana skills:",
    catalogBlock,
    "",
    "User request:",
    userPrompt,
  ].join("\n");
}

function extractBalancedJsonObject(text) {
  const source = String(text || "");
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && startIndex !== -1) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

export function parseRouterResponse(rawOutput, catalogIndex) {
  const trimmed = String(rawOutput || "").trim();
  const directCandidates = [];

  if (trimmed) directCandidates.push(trimmed);
  const extracted = extractBalancedJsonObject(trimmed);
  if (extracted && extracted !== trimmed) directCandidates.push(extracted);

  let parsed = null;
  for (const candidate of directCandidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      // Keep trying.
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Router output was not valid JSON");
  }

  const normalizedSkills = [];
  const unknownSkills = [];

  for (const rawSkill of toArray(parsed.selectedSkills)) {
    const normalized = String(rawSkill || "").trim().toLowerCase();
    if (!normalized) continue;
    const canonicalName = catalogIndex.skillByLowerName.get(normalized);
    if (canonicalName) {
      if (!normalizedSkills.includes(canonicalName)) normalizedSkills.push(canonicalName);
    } else {
      unknownSkills.push(String(rawSkill).trim());
    }
  }

  return {
    selectedSkills: normalizedSkills,
    unknownSkills: dedupe(unknownSkills.filter(Boolean)),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    closestAlternatives: dedupe(
      toArray(parsed.closestAlternatives)
        .map((skill) => String(skill || "").trim())
        .filter(Boolean),
    ),
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
  };
}

function getQueryExpectations(pack, collectionName, query) {
  const expectedSkills = dedupe(
    toArray(query.expectedSkills).length > 0
      ? toArray(query.expectedSkills)
      : (collectionName === "shouldTrigger" ? [pack.skill] : []),
  );
  const forbiddenSkills = dedupe(
    toArray(query.forbiddenSkills).length > 0
      ? toArray(query.forbiddenSkills)
      : (collectionName === "shouldNotTrigger" ? [pack.skill] : []),
  );

  return {
    expectedSkills,
    forbiddenSkills,
    allowAdditionalSkills: query.allowAdditionalSkills ?? true,
  };
}

export function gradeTriggerAttempt({ pack, collectionName, query, response }) {
  const expectations = getQueryExpectations(pack, collectionName, query);
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
    targetSkillSelected: selectedSkills.includes(pack.skill),
  };
}

export function summarizeQueryAttempts(queryAttempts, targetSkill) {
  const totalRuns = queryAttempts.length;
  const successfulRuns = queryAttempts.filter((attempt) => !attempt.error);
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
    targetSkillSelectionRate: successfulRuns.length > 0
      ? successfulRuns.filter((attempt) => attempt.selectedSkills.includes(targetSkill)).length / successfulRuns.length
      : null,
    selectionFrequency,
  };
}

export function summarizeTriggerReport(report) {
  const allQueries = report.queries || [];
  const allSummaries = allQueries.map((entry) => entry.summary);

  const overallSuccessfulRuns = allSummaries.reduce(
    (sum, summary) => sum + (summary.successfulRuns || 0),
    0,
  );
  const overallPassCount = allSummaries.reduce(
    (sum, summary) => sum + (summary.passCount || 0),
    0,
  );
  const overallTargetSelections = allQueries.reduce((sum, entry) => {
    const rate = entry.summary.targetSkillSelectionRate;
    const successfulRuns = entry.summary.successfulRuns || 0;
    return sum + (typeof rate === "number" ? rate * successfulRuns : 0);
  }, 0);

  const byCollection = Object.fromEntries(
    TRIGGER_EVAL_COLLECTIONS.map((collectionName) => {
      const collectionQueries = allQueries.filter((entry) => entry.collectionName === collectionName);
      const successfulRuns = collectionQueries.reduce(
        (sum, entry) => sum + (entry.summary.successfulRuns || 0),
        0,
      );
      const passCount = collectionQueries.reduce(
        (sum, entry) => sum + (entry.summary.passCount || 0),
        0,
      );
      const targetSelections = collectionQueries.reduce((sum, entry) => {
        const rate = entry.summary.targetSkillSelectionRate;
        const runs = entry.summary.successfulRuns || 0;
        return sum + (typeof rate === "number" ? rate * runs : 0);
      }, 0);

      return [collectionName, {
        queries: collectionQueries.length,
        successfulRuns,
        passRate: successfulRuns > 0 ? passCount / successfulRuns : null,
        targetSkillSelectionRate: successfulRuns > 0 ? targetSelections / successfulRuns : null,
      }];
    }),
  );

  const bySet = Object.fromEntries(
    TRIGGER_EVAL_SETS.map((setName) => {
      const setQueries = allQueries.filter((entry) => entry.query.set === setName);
      const successfulRuns = setQueries.reduce(
        (sum, entry) => sum + (entry.summary.successfulRuns || 0),
        0,
      );
      const passCount = setQueries.reduce(
        (sum, entry) => sum + (entry.summary.passCount || 0),
        0,
      );

      return [setName, {
        queries: setQueries.length,
        successfulRuns,
        passRate: successfulRuns > 0 ? passCount / successfulRuns : null,
      }];
    }),
  );

  return {
    overall: {
      queries: allQueries.length,
      successfulRuns: overallSuccessfulRuns,
      passRate: overallSuccessfulRuns > 0 ? overallPassCount / overallSuccessfulRuns : null,
      targetSkillSelectionRate: overallSuccessfulRuns > 0
        ? overallTargetSelections / overallSuccessfulRuns
        : null,
    },
    byCollection,
    bySet,
  };
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .replace(/[^a-z0-9-_]+/giu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

export function invokeRouter(prompt, options = {}) {
  const cli = process.env.ARCANA_TRIGGER_EVAL_CLAUDE_BIN || "claude";
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxTurns = options.maxTurns || DEFAULT_MAX_TURNS;
  const permissionMode = process.env.ARCANA_TRIGGER_EVAL_PERMISSION_MODE || "bypassPermissions";
  const model = process.env.ARCANA_TRIGGER_EVAL_MODEL;

  return execFileSync(
    cli,
    [
      "-p",
      prompt,
      "--bare",
      "--disable-slash-commands",
      "--tools",
      "",
      "--max-turns",
      String(maxTurns),
      "--permission-mode",
      permissionMode,
      "--json-schema",
      JSON.stringify(ROUTER_RESPONSE_SCHEMA),
      "--no-session-persistence",
      ...(model ? ["--model", model] : []),
    ],
    {
      encoding: "utf-8",
      timeout: timeoutMs,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
    },
  );
}

function runQueryAttempt(pack, collectionName, query, runIndex, catalogIndex) {
  const prompt = buildRouterPrompt(query.prompt, catalogIndex.skills);

  try {
    const rawOutput = invokeRouter(prompt);
    const response = parseRouterResponse(rawOutput, catalogIndex);
    const graded = gradeTriggerAttempt({
      pack,
      collectionName,
      query,
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
      selectedSkills: [],
      unknownSkills: [],
      missingExpected: [],
      forbiddenSelected: [],
      unexpectedSelected: [],
      reasoning: "",
      closestAlternatives: [],
      confidence: null,
      expectedSkills: getQueryExpectations(pack, collectionName, query).expectedSkills,
      forbiddenSkills: getQueryExpectations(pack, collectionName, query).forbiddenSkills,
      allowAdditionalSkills: getQueryExpectations(pack, collectionName, query).allowAdditionalSkills,
      targetSkillSelected: false,
    };
  }
}

function writeReportArtifacts(report) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = Date.now();
  const artifactDir = join(RESULTS_DIR, `${report.skill}_${timestamp}`);
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  for (const entry of report.queries) {
    for (const attempt of entry.attempts) {
      const filename = `${sanitizeFileSegment(entry.collectionName)}_${sanitizeFileSegment(entry.query.id)}_run${attempt.runIndex}.txt`;
      writeFileSync(join(artifactDir, filename), attempt.rawOutput || "");
    }
  }

  return artifactDir;
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    skill: null,
    run: false,
    runs: DEFAULT_RUNS,
    setFilter: "all",
    collectionFilter: "all",
  };

  while (args.length > 0) {
    const current = args.shift();
    if (!current) continue;

    switch (current) {
      case "--skill":
        options.skill = args.shift() || null;
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
      case "--collection":
        options.collectionFilter = parseCollectionFilter(args.shift());
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
  console.error("  node evals/run-trigger-eval.js");
  console.error("  node evals/run-trigger-eval.js --skill pressure-test");
  console.error("  node evals/run-trigger-eval.js --skill pressure-test --run");
  console.error("  node evals/run-trigger-eval.js --skill pressure-test --run --runs 3");
  console.error("  node evals/run-trigger-eval.js --skill pressure-test --run --set validation");
  console.error("  node evals/run-trigger-eval.js --skill pressure-test --run --collection shouldNotTrigger");
  process.exit(message ? 1 : 0);
}

function printPlan(pack, plan) {
  const countsByCollection = Object.fromEntries(
    TRIGGER_EVAL_COLLECTIONS.map((collectionName) => [
      collectionName,
      plan.filter((entry) => entry.collectionName === collectionName).length,
    ]),
  );
  const countsBySet = Object.fromEntries(
    TRIGGER_EVAL_SETS.map((setName) => [
      setName,
      plan.filter((entry) => entry.query.set === setName).length,
    ]),
  );

  console.log(`  ${pack.skill}`);
  console.log(`    ${pack.description}`);
  console.log(`    Queries: ${plan.length}`);
  console.log(`    shouldTrigger: ${countsByCollection.shouldTrigger} | shouldNotTrigger: ${countsByCollection.shouldNotTrigger}`);
  console.log(`    Train: ${countsBySet.train} | Validation: ${countsBySet.validation}`);
}

function printRunSummary(report) {
  console.log(`  ${report.skill}`);
  console.log(`    ${report.description}`);
  console.log(`    Queries: ${report.summary.overall.queries} | Successful runs: ${report.summary.overall.successfulRuns}`);
  console.log(
    `    shouldTrigger pass ${toPercent(report.summary.byCollection.shouldTrigger.passRate)} | target selected ${toPercent(report.summary.byCollection.shouldTrigger.targetSkillSelectionRate)}`,
  );
  console.log(
    `    shouldNotTrigger pass ${toPercent(report.summary.byCollection.shouldNotTrigger.passRate)} | false trigger ${toPercent(report.summary.byCollection.shouldNotTrigger.targetSkillSelectionRate)}`,
  );
  console.log(
    `    train pass ${toPercent(report.summary.bySet.train.passRate)} | validation pass ${toPercent(report.summary.bySet.validation.passRate)}`,
  );

  const weakQueries = report.queries
    .filter((entry) => entry.summary.passRate !== null && entry.summary.passRate < 1)
    .sort((a, b) => (a.summary.passRate ?? 0) - (b.summary.passRate ?? 0))
    .slice(0, 5);

  if (weakQueries.length > 0) {
    console.log("    Weak queries:");
    for (const entry of weakQueries) {
      const selectionSummary = Object.entries(entry.summary.selectionFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([skill, count]) => `${skill}:${count}`)
        .join(", ");
      console.log(
        `      - ${entry.query.id} (${entry.collectionName}, ${entry.query.set}) pass ${toPercent(entry.summary.passRate)}${selectionSummary ? ` | selections ${selectionSummary}` : ""}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.runs) printUsageAndExit("Invalid --runs value. Use a positive integer.");
  if (!options.setFilter) printUsageAndExit("Invalid --set value. Use all, train, or validation.");
  if (!options.collectionFilter) printUsageAndExit("Invalid --collection value. Use all, shouldTrigger, or shouldNotTrigger.");

  const catalogIndex = buildCatalogIndex();
  const skillNames = options.skill ? [options.skill] : listTriggerEvalSkills();

  if (skillNames.length === 0) {
    console.log("No trigger packs found under evals/triggers.");
    process.exit(0);
  }

  console.log("✦ Arcana Trigger Eval\n");

  for (const skillName of skillNames) {
    const pack = readTriggerEvalPack(skillName);
    const validationIssues = validateTriggerPackAgainstCatalog(pack, catalogIndex.skillNames);
    if (validationIssues.length > 0) {
      console.log(`  ${skillName}`);
      for (const issue of validationIssues) {
        console.log(`    - ${issue}`);
      }
      console.log("");
      continue;
    }

    const plan = buildTriggerPlan(pack, options);

    if (!options.run) {
      printPlan(pack, plan);
      console.log("");
      continue;
    }

    const queryReports = [];
    for (const entry of plan) {
      const attempts = [];
      for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
        attempts.push(runQueryAttempt(pack, entry.collectionName, entry.query, runIndex, catalogIndex));
      }

      queryReports.push({
        collectionName: entry.collectionName,
        query: entry.query,
        attempts,
        summary: summarizeQueryAttempts(attempts, pack.skill),
      });
    }

    const report = {
      skill: pack.skill,
      description: pack.description,
      runsRequested: options.runs,
      setFilter: options.setFilter,
      collectionFilter: options.collectionFilter,
      evaluatedAt: new Date().toISOString(),
      catalogSkillCount: catalogIndex.skills.length,
      queries: queryReports,
    };
    report.summary = summarizeTriggerReport(report);
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
