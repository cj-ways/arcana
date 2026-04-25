#!/usr/bin/env node

/**
 * Arcana Layer 2 Eval Runner
 *
 * Compares baseline prompting vs explicit Arcana skill prompting against the
 * same planted scenario, then grades both attempts against the manifest.
 *
 * Usage:
 *   node evals/run-eval.js
 *   node evals/run-eval.js --scenario <name>
 *   node evals/run-eval.js --skill <skill>
 *   node evals/run-eval.js --scenario <name> --run
 *   node evals/run-eval.js --scenario <name> --run --runs 3
 *   node evals/run-eval.js --scenario <name> --run --mode skill
 *
 * Without --run, it validates scenario setup and shows what would be tested.
 */

import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, "scenarios");
const RESULTS_DIR = join(__dirname, "results");
const SCORECARDS_DIR = join(__dirname, "scorecards");
const SCORECARD_SCHEMA_VERSION = 1;
const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TIMEOUT_MS = 120000;
export const DEFAULT_SCORECARD_GATE_THRESHOLDS = Object.freeze({
  maxAverageRegression: 0.05,
  maxDimensionRegression: 0.05,
});
const MODES = Object.freeze(["compare", "skill", "baseline"]);
export const SCORE_DIMENSIONS = Object.freeze(["route", "process", "outcome"]);
export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  route: 0.2,
  process: 0.3,
  outcome: 0.5,
});
const FALSE_POSITIVE_FLAG_WORDS = Object.freeze([
  "issue",
  "vulnerability",
  "vuln",
  "unused",
  "dead",
  "orphan",
  "flag",
  "warning",
  "risk",
  "bug",
  "problem",
]);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toPercent(value) {
  if (typeof value !== "number") return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

function toSignedPercentagePoints(value) {
  if (typeof value !== "number") return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}pp`;
}

function roundMetric(value, digits = 4) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function averageMetrics(values) {
  const numbers = values.filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRunCount(value) {
  if (value === undefined || value === null) return 1;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseMode(value) {
  if (!value) return "compare";
  return MODES.includes(value) ? value : null;
}

function parseRegex(pattern) {
  if (pattern instanceof RegExp) return pattern;
  if (typeof pattern !== "string") {
    throw new Error(`Invalid regex pattern: ${String(pattern)}`);
  }

  const literalMatch = pattern.match(/^\/([\s\S]*)\/([a-z]*)$/);
  if (literalMatch) {
    return new RegExp(literalMatch[1], literalMatch[2]);
  }

  return new RegExp(pattern);
}

export function matchesTextRules(text, {
  includes = [],
  includesAny = [],
  matches = [],
  matchesAny = [],
  excludes = [],
  excludeMatches = [],
} = {}) {
  const normalizedText = String(text || "");

  const hasAllIncludes = toArray(includes).every((entry) =>
    normalizedText.includes(String(entry)),
  );
  const hasAnyIncludes = toArray(includesAny).length === 0
    || toArray(includesAny).some((entry) => normalizedText.includes(String(entry)));
  const hasAllMatches = toArray(matches).every((entry) =>
    parseRegex(entry).test(normalizedText),
  );
  const hasAnyMatches = toArray(matchesAny).length === 0
    || toArray(matchesAny).some((entry) => parseRegex(entry).test(normalizedText));
  const hasNoExcludes = toArray(excludes).every((entry) =>
    !normalizedText.includes(String(entry)),
  );
  const hasNoExcludeMatches = toArray(excludeMatches).every((entry) =>
    !parseRegex(entry).test(normalizedText),
  );

  return hasAllIncludes
    && hasAnyIncludes
    && hasAllMatches
    && hasAnyMatches
    && hasNoExcludes
    && hasNoExcludeMatches;
}

function listFiles(rootDir) {
  if (!existsSync(rootDir)) return [];
  const entries = [];

  function walk(currentDir) {
    for (const name of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, name);
      const relativePath = relative(rootDir, absolutePath);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      entries.push(relativePath);
    }
  }

  walk(rootDir);
  return entries.sort();
}

function createWorkspaceSnapshot(rootDir) {
  const snapshot = {};

  for (const relativePath of listFiles(rootDir)) {
    snapshot[relativePath] = readFileSync(join(rootDir, relativePath), "utf-8");
  }

  return snapshot;
}

function diffWorkspaceSnapshots(before, after) {
  const created = [];
  const modified = [];
  const deleted = [];

  const beforeFiles = new Set(Object.keys(before));
  const afterFiles = new Set(Object.keys(after));

  for (const file of afterFiles) {
    if (!beforeFiles.has(file)) {
      created.push(file);
      continue;
    }
    if (before[file] !== after[file]) {
      modified.push(file);
    }
  }

  for (const file of beforeFiles) {
    if (!afterFiles.has(file)) {
      deleted.push(file);
    }
  }

  return {
    created: created.sort(),
    modified: modified.sort(),
    deleted: deleted.sort(),
  };
}

function extractAnchoredContexts(text, anchor, windowSize = 240) {
  const source = String(text || "");
  const normalizedAnchor = String(anchor || "").toLowerCase();
  if (!normalizedAnchor) return [];

  const lowerSource = source.toLowerCase();
  const contexts = [];
  let searchIndex = 0;

  while (searchIndex < lowerSource.length) {
    const matchIndex = lowerSource.indexOf(normalizedAnchor, searchIndex);
    if (matchIndex === -1) break;

    const blockStart = source.lastIndexOf("\n\n", matchIndex);
    const blockEnd = source.indexOf("\n\n", matchIndex + normalizedAnchor.length);
    const fallbackStart = Math.max(0, matchIndex - windowSize);
    const fallbackEnd = Math.min(source.length, matchIndex + normalizedAnchor.length + windowSize);
    const start = blockStart === -1 ? fallbackStart : Math.max(fallbackStart, blockStart + 2);
    const end = blockEnd === -1 ? fallbackEnd : Math.min(fallbackEnd, blockEnd);
    contexts.push(source.slice(start, end));
    searchIndex = matchIndex + normalizedAnchor.length;
  }

  return contexts;
}

function loadManifest(scenarioName) {
  const manifestPath = join(SCENARIOS_DIR, scenarioName, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`  No manifest.json in scenarios/${scenarioName}`);
    return null;
  }
  return JSON.parse(readFileSync(manifestPath, "utf-8"));
}

function listScenarios() {
  if (!existsSync(SCENARIOS_DIR)) return [];
  return readdirSync(SCENARIOS_DIR).filter((name) =>
    existsSync(join(SCENARIOS_DIR, name, "manifest.json")),
  );
}

function validateAssertion(assertion, collectionName) {
  const issues = [];
  const kind = collectionName === "falsePositives" ? "false positive" : "expected";
  const type = assertion.type || "reported";

  if (!assertion.id) issues.push(`${kind} item missing 'id'`);
  if (!assertion.description) {
    issues.push(`${kind} item '${assertion.id || "unknown"}' missing 'description'`);
  }
  if (assertion.dimension && !SCORE_DIMENSIONS.includes(assertion.dimension)) {
    issues.push(`${kind} item '${assertion.id || "unknown"}' has invalid 'dimension'`);
  }

  if (["file-created", "file-contains", "file-unchanged", "reported-context"].includes(type) && !assertion.file) {
    issues.push(`${kind} item '${assertion.id || "unknown"}' requires 'file' for type '${type}'`);
  }

  if (
    type === "file-contains"
    && toArray(assertion.contentIncludes).length === 0
    && toArray(assertion.contentIncludesAny).length === 0
    && toArray(assertion.contentMatches).length === 0
    && toArray(assertion.contentMatchesAny).length === 0
  ) {
    issues.push(`${kind} item '${assertion.id || "unknown"}' requires contentIncludes or contentMatches for type 'file-contains'`);
  }

  if (
    type === "reported-context"
    && toArray(assertion.contextIncludes).length === 0
    && toArray(assertion.contextIncludesAny).length === 0
    && toArray(assertion.contextMatches).length === 0
    && toArray(assertion.contextMatchesAny).length === 0
  ) {
    issues.push(`${kind} item '${assertion.id || "unknown"}' requires contextIncludes or contextMatches for type 'reported-context'`);
  }

  return issues;
}

function validateScoringConfig(scoring) {
  const issues = [];

  if (scoring === undefined) return issues;
  if (!isPlainObject(scoring)) {
    return ["Invalid 'scoring' value: expected an object"];
  }

  if (scoring.weights !== undefined) {
    if (!isPlainObject(scoring.weights)) {
      issues.push("Invalid 'scoring.weights' value: expected an object");
    } else {
      let totalWeight = 0;

      for (const dimension of SCORE_DIMENSIONS) {
        const weight = scoring.weights[dimension];
        if (weight === undefined) continue;
        if (typeof weight !== "number" || Number.isNaN(weight) || weight < 0) {
          issues.push(`Invalid scoring weight for '${dimension}': expected a non-negative number`);
          continue;
        }
        totalWeight += weight;
      }

      if (totalWeight <= 0) {
        issues.push("Invalid 'scoring.weights': total configured weight must be greater than 0");
      }
    }
  }

  return issues;
}

export function validateScenario(manifest) {
  const issues = [];

  if (!manifest.name) issues.push("Missing 'name'");
  if (!manifest.skill) issues.push("Missing 'skill'");
  if (!manifest.description) issues.push("Missing 'description'");
  if (!manifest.prompt) issues.push("Missing 'prompt'");
  if (!manifest.expected || !Array.isArray(manifest.expected)) {
    issues.push("Missing or invalid 'expected' array");
  }
  if (manifest.setupCommands !== undefined && !Array.isArray(manifest.setupCommands)) {
    issues.push("Invalid 'setupCommands' value: expected an array of shell commands");
  }
  if (Array.isArray(manifest.setupCommands)) {
    for (const command of manifest.setupCommands) {
      if (typeof command !== "string" || command.trim().length === 0) {
        issues.push("Invalid 'setupCommands' entry: commands must be non-empty strings");
      }
    }
  }
  if (manifest.workdir !== undefined && (typeof manifest.workdir !== "string" || manifest.workdir.trim().length === 0)) {
    issues.push("Invalid 'workdir' value: expected a non-empty string");
  }
  issues.push(...validateScoringConfig(manifest.scoring));

  for (const assertion of manifest.expected || []) {
    issues.push(...validateAssertion(assertion, "expected"));
  }

  for (const assertion of manifest.falsePositives || []) {
    issues.push(...validateAssertion(assertion, "falsePositives"));
  }

  return issues;
}

function getAssertionDimension(assertion) {
  return SCORE_DIMENSIONS.includes(assertion.dimension) ? assertion.dimension : "outcome";
}

function getManifestScoring(manifest) {
  const rawWeights = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...(manifest.scoring?.weights || {}),
  };

  const total = SCORE_DIMENSIONS.reduce((sum, dimension) => sum + rawWeights[dimension], 0);
  const safeTotal = total > 0 ? total : 1;

  return {
    weights: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => [dimension, rawWeights[dimension] / safeTotal]),
    ),
  };
}

function createDimensionScorecard(weights) {
  return Object.fromEntries(
    SCORE_DIMENSIONS.map((dimension) => [
      dimension,
      {
        weight: weights[dimension],
        expectedTotal: 0,
        found: 0,
        falsePositiveTotal: 0,
        falsePositives: 0,
        clean: 0,
        active: false,
        detectionRate: null,
        falsePositiveRate: null,
        score: null,
      },
    ]),
  );
}

function finalizeDimensionScorecard(scorecard) {
  for (const dimension of SCORE_DIMENSIONS) {
    const entry = scorecard[dimension];
    entry.active = entry.expectedTotal > 0 || entry.falsePositiveTotal > 0;

    if (!entry.active) {
      entry.detectionRate = null;
      entry.falsePositiveRate = null;
      entry.score = null;
      continue;
    }

    entry.detectionRate = entry.expectedTotal > 0 ? entry.found / entry.expectedTotal : 1;
    entry.falsePositiveRate = entry.falsePositiveTotal > 0
      ? entry.falsePositives / entry.falsePositiveTotal
      : 0;
    entry.score = entry.detectionRate - entry.falsePositiveRate;
  }

  return scorecard;
}

function calculateWeightedScore(scorecard) {
  const activeDimensions = SCORE_DIMENSIONS
    .map((dimension) => scorecard[dimension])
    .filter((entry) => entry.active);

  if (activeDimensions.length === 0) return null;

  const totalWeight = activeDimensions.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return null;

  return activeDimensions.reduce(
    (sum, entry) => sum + (entry.score * entry.weight),
    0,
  ) / totalWeight;
}

function gradeFromDimensions(scorecard, weightedScore) {
  const activeScores = SCORE_DIMENSIONS
    .map((dimension) => scorecard[dimension])
    .filter((entry) => entry.active)
    .map((entry) => entry.score);

  if (activeScores.length === 0 || weightedScore === null) return "FAIL";
  if (activeScores.every((score) => score === 1)) return "PASS";
  if (weightedScore >= 0.75 && activeScores.every((score) => score >= 0.5)) {
    return "PARTIAL";
  }
  return "FAIL";
}

function defaultOutputIndicators(assertion) {
  return [
    assertion.file,
    assertion.description,
    assertion.id ? assertion.id.replace(/-/g, " ") : null,
  ].filter(Boolean);
}

function isAssertionReportedInOutput(assertion, output) {
  const normalizedOutput = String(output || "").toLowerCase();
  const explicitIndicators = toArray(assertion.outputIncludes);
  const indicators = explicitIndicators.length > 0
    ? explicitIndicators
    : defaultOutputIndicators(assertion);
  const outputMatches = toArray(assertion.outputMatches);

  const includesMatch = indicators.some((indicator) =>
    normalizedOutput.includes(String(indicator).toLowerCase()),
  );
  const regexMatch = outputMatches.some((pattern) =>
    parseRegex(pattern).test(output),
  );

  return includesMatch || regexMatch;
}

function isFalsePositiveFlagged(assertion, output) {
  const explicitIndicators = toArray(assertion.outputIncludes);
  const explicitMatches = toArray(assertion.outputMatches);
  if (explicitIndicators.length > 0 || explicitMatches.length > 0) {
    return isAssertionReportedInOutput(assertion, output);
  }

  const fileRef = String(assertion.file || "").toLowerCase();
  if (!fileRef) return false;

  const outputLower = String(output || "").toLowerCase();
  const idx = outputLower.indexOf(fileRef);
  if (idx === -1) return false;

  const context = outputLower.slice(
    Math.max(0, idx - 120),
    idx + fileRef.length + 120,
  );

  return FALSE_POSITIVE_FLAG_WORDS.some((word) => context.includes(word));
}

function isContextualAssertionReported(assertion, output) {
  const contexts = extractAnchoredContexts(
    output,
    assertion.file,
    assertion.contextWindow,
  );

  if (contexts.length === 0) return false;

  return contexts.some((context) =>
    matchesTextRules(context, {
      includes: assertion.contextIncludes,
      includesAny: assertion.contextIncludesAny,
      matches: assertion.contextMatches,
      matchesAny: assertion.contextMatchesAny,
      excludes: assertion.contextExcludes,
      excludeMatches: assertion.contextExcludeMatches,
    }),
  );
}

function doesAssertionPass(assertion, context, collectionName) {
  const type = assertion.type || (collectionName === "falsePositives" && assertion.mustNotModify ? "file-unchanged" : "reported");
  const afterContent = assertion.file
    ? (context.afterSnapshot[assertion.file] ?? null)
    : null;
  const beforeContent = assertion.file
    ? (context.beforeSnapshot[assertion.file] ?? null)
    : null;

  switch (type) {
    case "reported":
      return collectionName === "falsePositives"
        ? !isFalsePositiveFlagged(assertion, context.output)
        : isAssertionReportedInOutput(assertion, context.output);
    case "output-contains":
      return collectionName === "falsePositives"
        ? !matchesTextRules(context.output, {
            includes: assertion.outputIncludes,
            includesAny: assertion.outputIncludesAny,
            matches: assertion.outputMatches,
            matchesAny: assertion.outputMatchesAny,
            excludes: assertion.outputExcludes,
            excludeMatches: assertion.outputExcludeMatches,
          })
        : matchesTextRules(context.output, {
            includes: assertion.outputIncludes,
            includesAny: assertion.outputIncludesAny,
            matches: assertion.outputMatches,
            matchesAny: assertion.outputMatchesAny,
            excludes: assertion.outputExcludes,
            excludeMatches: assertion.outputExcludeMatches,
          });
    case "reported-context":
      return collectionName === "falsePositives"
        ? !isContextualAssertionReported(assertion, context.output)
        : isContextualAssertionReported(assertion, context.output);
    case "file-created":
      return afterContent !== null && beforeContent === null;
    case "file-contains":
      if (afterContent === null) return false;
      if (assertion.mustBeModified && beforeContent === afterContent) return false;
      return matchesTextRules(afterContent, {
        includes: assertion.contentIncludes,
        includesAny: assertion.contentIncludesAny,
        matches: assertion.contentMatches,
        matchesAny: assertion.contentMatchesAny,
        excludes: assertion.contentExcludes,
        excludeMatches: assertion.contentExcludeMatches,
      });
    case "file-unchanged":
      return beforeContent !== null && beforeContent === afterContent;
    case "workspace-clean":
      return context.workspaceDiff.created.length === 0
        && context.workspaceDiff.modified.length === 0
        && context.workspaceDiff.deleted.length === 0;
    default:
      throw new Error(`Unknown assertion type: ${type}`);
  }
}

export function gradeAttempt({ output, manifest, beforeSnapshot, afterSnapshot, mode, runIndex }) {
  const workspaceDiff = diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot);
  const scoring = getManifestScoring(manifest);
  const result = {
    scenario: manifest.name,
    skill: manifest.skill,
    mode,
    runIndex,
    timestamp: new Date().toISOString(),
    found: [],
    missed: [],
    falsePositives: [],
    clean: [],
    workspaceDiff,
    outputLength: String(output || "").length,
    scoring: scoring.weights,
    dimensions: createDimensionScorecard(scoring.weights),
  };

  const context = {
    output: String(output || ""),
    beforeSnapshot,
    afterSnapshot,
    workspaceDiff,
  };

  for (const assertion of manifest.expected || []) {
    const dimension = getAssertionDimension(assertion);
    result.dimensions[dimension].expectedTotal += 1;

    if (doesAssertionPass(assertion, context, "expected")) {
      result.found.push(assertion.id);
      result.dimensions[dimension].found += 1;
    } else {
      result.missed.push(assertion.id);
    }
  }

  for (const assertion of manifest.falsePositives || []) {
    const dimension = getAssertionDimension(assertion);
    result.dimensions[dimension].falsePositiveTotal += 1;

    if (doesAssertionPass(assertion, context, "falsePositives")) {
      result.clean.push(assertion.id);
      result.dimensions[dimension].clean += 1;
    } else {
      result.falsePositives.push(assertion.id);
      result.dimensions[dimension].falsePositives += 1;
    }
  }

  const totalExpected = toArray(manifest.expected).length;
  const totalFalsePositives = toArray(manifest.falsePositives).length;

  result.detectionRate = totalExpected > 0 ? result.found.length / totalExpected : 1;
  result.falsePositiveRate = totalFalsePositives > 0
    ? result.falsePositives.length / totalFalsePositives
    : 0;
  result.aggregateScore = result.detectionRate - result.falsePositiveRate;
  result.dimensions = finalizeDimensionScorecard(result.dimensions);
  result.score = calculateWeightedScore(result.dimensions) ?? result.aggregateScore;
  result.grade = gradeFromDimensions(result.dimensions, result.score);

  return result;
}

function summarizeDimensionAverages(successful) {
  return Object.fromEntries(
    SCORE_DIMENSIONS.map((dimension) => {
      const activeAttempts = successful
        .map((attempt) => attempt.dimensions?.[dimension])
        .filter((entry) => entry?.active);

      if (activeAttempts.length === 0) {
        const weight = successful[0]?.dimensions?.[dimension]?.weight ?? DEFAULT_SCORING_WEIGHTS[dimension];
        return [dimension, {
          weight,
          active: false,
          activeRuns: 0,
          averageDetectionRate: null,
          averageFalsePositiveRate: null,
          averageScore: null,
        }];
      }

      const sums = activeAttempts.reduce(
        (acc, entry) => ({
          detection: acc.detection + entry.detectionRate,
          falsePositive: acc.falsePositive + entry.falsePositiveRate,
          score: acc.score + entry.score,
        }),
        { detection: 0, falsePositive: 0, score: 0 },
      );

      return [dimension, {
        weight: activeAttempts[0].weight,
        active: true,
        activeRuns: activeAttempts.length,
        averageDetectionRate: sums.detection / activeAttempts.length,
        averageFalsePositiveRate: sums.falsePositive / activeAttempts.length,
        averageScore: sums.score / activeAttempts.length,
      }];
    }),
  );
}

export function summarizeAttempts(attempts) {
  const successful = attempts.filter((attempt) => !attempt.error);
  const gradeCounts = {
    PASS: 0,
    PARTIAL: 0,
    FAIL: 0,
    ERROR: attempts.length - successful.length,
  };

  for (const attempt of successful) {
    gradeCounts[attempt.grade] += 1;
  }

  const aggregate = {
    runsRequested: attempts.length,
    successfulRuns: successful.length,
    erroredRuns: attempts.length - successful.length,
    gradeCounts,
    attempts,
  };

  if (successful.length === 0) {
    return {
      ...aggregate,
      averageDetectionRate: null,
      averageFalsePositiveRate: null,
      averageScore: null,
      averageAggregateScore: null,
      bestScore: null,
      worstScore: null,
      dimensions: summarizeDimensionAverages(successful),
    };
  }

  const sum = successful.reduce(
    (acc, attempt) => ({
      detection: acc.detection + attempt.detectionRate,
      falsePositive: acc.falsePositive + attempt.falsePositiveRate,
      score: acc.score + attempt.score,
      aggregateScore: acc.aggregateScore + (attempt.aggregateScore ?? attempt.score),
    }),
    { detection: 0, falsePositive: 0, score: 0, aggregateScore: 0 },
  );

  const scores = successful.map((attempt) => attempt.score);

  return {
    ...aggregate,
    averageDetectionRate: sum.detection / successful.length,
    averageFalsePositiveRate: sum.falsePositive / successful.length,
    averageScore: sum.score / successful.length,
    averageAggregateScore: sum.aggregateScore / successful.length,
    bestScore: Math.max(...scores),
    worstScore: Math.min(...scores),
    dimensions: summarizeDimensionAverages(successful),
  };
}

export function compareAttemptSets(skillSummary, baselineSummary) {
  if (!skillSummary || !baselineSummary) return null;
  if (skillSummary.successfulRuns === 0 || baselineSummary.successfulRuns === 0) {
    return {
      detectionDelta: null,
      falsePositiveDelta: null,
      scoreDelta: null,
      aggregateScoreDelta: null,
      dimensions: Object.fromEntries(
        SCORE_DIMENSIONS.map((dimension) => [dimension, {
          scoreDelta: null,
          detectionDelta: null,
          falsePositiveDelta: null,
        }]),
      ),
      wins: 0,
      losses: 0,
      ties: 0,
    };
  }

  const pairedCount = Math.min(
    skillSummary.successfulRuns,
    baselineSummary.successfulRuns,
  );

  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (let index = 0; index < pairedCount; index += 1) {
    const skillAttempt = skillSummary.attempts.filter((attempt) => !attempt.error)[index];
    const baselineAttempt = baselineSummary.attempts.filter((attempt) => !attempt.error)[index];

    if (!skillAttempt || !baselineAttempt) continue;

    if (skillAttempt.score > baselineAttempt.score) wins += 1;
    else if (skillAttempt.score < baselineAttempt.score) losses += 1;
    else ties += 1;
  }

  return {
    pairedRuns: pairedCount,
    detectionDelta: skillSummary.averageDetectionRate - baselineSummary.averageDetectionRate,
    falsePositiveDelta: skillSummary.averageFalsePositiveRate - baselineSummary.averageFalsePositiveRate,
    scoreDelta: skillSummary.averageScore - baselineSummary.averageScore,
    aggregateScoreDelta: skillSummary.averageAggregateScore - baselineSummary.averageAggregateScore,
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => {
        const skillDimension = skillSummary.dimensions?.[dimension];
        const baselineDimension = baselineSummary.dimensions?.[dimension];

        if (!skillDimension?.active || !baselineDimension?.active) {
          return [dimension, {
            scoreDelta: null,
            detectionDelta: null,
            falsePositiveDelta: null,
          }];
        }

        return [dimension, {
          scoreDelta: skillDimension.averageScore - baselineDimension.averageScore,
          detectionDelta: skillDimension.averageDetectionRate - baselineDimension.averageDetectionRate,
          falsePositiveDelta: skillDimension.averageFalsePositiveRate - baselineDimension.averageFalsePositiveRate,
        }];
      }),
    ),
    wins,
    losses,
    ties,
  };
}

function compactDimensionAggregate(entry) {
  return {
    weight: roundMetric(entry.weight),
    active: Boolean(entry.active),
    activeRuns: entry.activeRuns ?? null,
    averageDetectionRate: roundMetric(entry.averageDetectionRate),
    averageFalsePositiveRate: roundMetric(entry.averageFalsePositiveRate),
    averageScore: roundMetric(entry.averageScore),
  };
}

function compactAttemptSummary(summary) {
  if (!summary) return null;

  return {
    runsRequested: summary.runsRequested,
    successfulRuns: summary.successfulRuns,
    erroredRuns: summary.erroredRuns,
    gradeCounts: summary.gradeCounts,
    averageDetectionRate: roundMetric(summary.averageDetectionRate),
    averageFalsePositiveRate: roundMetric(summary.averageFalsePositiveRate),
    averageAggregateScore: roundMetric(summary.averageAggregateScore),
    averageScore: roundMetric(summary.averageScore),
    bestScore: roundMetric(summary.bestScore),
    worstScore: roundMetric(summary.worstScore),
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => [
        dimension,
        compactDimensionAggregate(summary.dimensions?.[dimension] || {}),
      ]),
    ),
  };
}

function compactComparison(comparison) {
  if (!comparison) return null;

  return {
    pairedRuns: comparison.pairedRuns ?? 0,
    detectionDelta: roundMetric(comparison.detectionDelta),
    falsePositiveDelta: roundMetric(comparison.falsePositiveDelta),
    aggregateScoreDelta: roundMetric(comparison.aggregateScoreDelta),
    scoreDelta: roundMetric(comparison.scoreDelta),
    wins: comparison.wins,
    losses: comparison.losses,
    ties: comparison.ties,
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => [
        dimension,
        {
          detectionDelta: roundMetric(comparison.dimensions?.[dimension]?.detectionDelta),
          falsePositiveDelta: roundMetric(comparison.dimensions?.[dimension]?.falsePositiveDelta),
          scoreDelta: roundMetric(comparison.dimensions?.[dimension]?.scoreDelta),
        },
      ]),
    ),
  };
}

function normalizeScorecardGateOptions(overrides = {}) {
  return {
    maxAverageRegression: overrides.maxAverageRegression ?? DEFAULT_SCORECARD_GATE_THRESHOLDS.maxAverageRegression,
    maxDimensionRegression: overrides.maxDimensionRegression ?? DEFAULT_SCORECARD_GATE_THRESHOLDS.maxDimensionRegression,
  };
}

function getScorecardStatus(averageScoreDelta) {
  if (typeof averageScoreDelta !== "number" || Number.isNaN(averageScoreDelta)) {
    return "no-baseline";
  }
  if (averageScoreDelta > 0.05) return "improved";
  if (averageScoreDelta < -0.05) return "regressed";
  return "flat";
}

function inferPreviousMetric(currentValue, changeValue) {
  return (
    typeof currentValue === "number" && typeof changeValue === "number"
  )
    ? roundMetric(currentValue - changeValue)
    : null;
}

function summarizeScorecardDimensions(scenarioResults) {
  return Object.fromEntries(
    SCORE_DIMENSIONS.map((dimension) => {
      const skillScores = scenarioResults.map((result) =>
        result.report?.skillRuns?.dimensions?.[dimension]?.averageScore,
      );
      const baselineScores = scenarioResults.map((result) =>
        result.report?.baseline?.dimensions?.[dimension]?.averageScore,
      );
      const deltaScores = scenarioResults.map((result) =>
        result.report?.comparison?.dimensions?.[dimension]?.scoreDelta,
      );

      return [dimension, {
        averageSkillScore: roundMetric(averageMetrics(skillScores)),
        averageBaselineScore: roundMetric(averageMetrics(baselineScores)),
        averageScoreDelta: roundMetric(averageMetrics(deltaScores)),
      }];
    }),
  );
}

function summarizeSkillScorecard(scenarioResults) {
  const skillScores = scenarioResults.map((result) => result.report?.skillRuns?.averageScore);
  const baselineScores = scenarioResults.map((result) => result.report?.baseline?.averageScore);
  const scoreDeltas = scenarioResults.map((result) => result.report?.comparison?.scoreDelta);
  const aggregateScoreDeltas = scenarioResults.map((result) =>
    result.report?.comparison?.aggregateScoreDelta,
  );
  const detectionDeltas = scenarioResults.map((result) => result.report?.comparison?.detectionDelta);
  const falsePositiveDeltas = scenarioResults.map((result) =>
    result.report?.comparison?.falsePositiveDelta,
  );

  const wins = scenarioResults.reduce(
    (sum, result) => sum + (result.report?.comparison?.wins || 0),
    0,
  );
  const losses = scenarioResults.reduce(
    (sum, result) => sum + (result.report?.comparison?.losses || 0),
    0,
  );
  const ties = scenarioResults.reduce(
    (sum, result) => sum + (result.report?.comparison?.ties || 0),
    0,
  );

  const averageScoreDelta = averageMetrics(scoreDeltas);

  return {
    scenarioCount: scenarioResults.length,
    averageSkillScore: roundMetric(averageMetrics(skillScores)),
    averageBaselineScore: roundMetric(averageMetrics(baselineScores)),
    averageScoreDelta: roundMetric(averageScoreDelta),
    averageAggregateScoreDelta: roundMetric(averageMetrics(aggregateScoreDeltas)),
    averageDetectionDelta: roundMetric(averageMetrics(detectionDeltas)),
    averageFalsePositiveDelta: roundMetric(averageMetrics(falsePositiveDeltas)),
    wins,
    losses,
    ties,
    status: getScorecardStatus(averageScoreDelta),
    dimensions: summarizeScorecardDimensions(scenarioResults),
  };
}

function compareToPreviousScorecard(summary, previousScorecard) {
  if (!previousScorecard?.summary) return null;

  const previousSummary = previousScorecard.summary;
  const currentDelta = summary.averageScoreDelta;
  const previousDelta = previousSummary.averageScoreDelta;
  const deltaChange = (
    typeof currentDelta === "number" && typeof previousDelta === "number"
  )
    ? currentDelta - previousDelta
    : null;

  return {
    previousGeneratedAt: previousScorecard.generatedAt || null,
    previousStatus: previousSummary.status || null,
    scoreDeltaChange: roundMetric(deltaChange),
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => {
        const currentDimension = summary.dimensions?.[dimension]?.averageScoreDelta;
        const previousDimension = previousSummary.dimensions?.[dimension]?.averageScoreDelta;
        const change = (
          typeof currentDimension === "number" && typeof previousDimension === "number"
        )
          ? currentDimension - previousDimension
          : null;

        return [dimension, {
          scoreDeltaChange: roundMetric(change),
        }];
      }),
    ),
  };
}

export function buildSkillScorecard({
  skill,
  scenarioResults,
  allScenarioNamesForSkill,
  previousScorecard = null,
}) {
  const generatedAt = new Date().toISOString();
  const coveredScenarios = scenarioResults
    .map((result) => result.manifest?.name || result.scenario)
    .filter(Boolean)
    .sort();
  const missingScenarios = [...allScenarioNamesForSkill]
    .filter((scenarioName) => !coveredScenarios.includes(scenarioName))
    .sort();
  const complete = missingScenarios.length === 0;
  const summary = summarizeSkillScorecard(scenarioResults);

  const scorecard = {
    schemaVersion: SCORECARD_SCHEMA_VERSION,
    generatedAt,
    skill,
    coverage: {
      complete,
      coveredScenarios,
      missingScenarios,
      totalScenariosForSkill: allScenarioNamesForSkill.length,
    },
    summary,
    scenarios: scenarioResults
      .slice()
      .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
      .map((result) => ({
        name: result.manifest.name,
        description: result.manifest.description,
        mode: result.report.mode,
        runsRequested: result.report.runsRequested,
        artifactDir: result.artifactDir ? relative(resolve(__dirname, ".."), result.artifactDir) : null,
        baseline: compactAttemptSummary(result.report.baseline),
        skillRuns: compactAttemptSummary(result.report.skillRuns),
        comparison: compactComparison(result.report.comparison),
      })),
  };

  scorecard.previousComparison = compareToPreviousScorecard(summary, previousScorecard);
  return scorecard;
}

export function buildScorecardIndex(scorecards) {
  return {
    schemaVersion: SCORECARD_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    skills: scorecards
      .slice()
      .sort((a, b) => a.skill.localeCompare(b.skill))
      .map((scorecard) => ({
        skill: scorecard.skill,
        generatedAt: scorecard.generatedAt,
        scorecardPath: `evals/scorecards/${scorecard.skill}.json`,
        scenarioCount: scorecard.summary.scenarioCount,
        averageSkillScore: scorecard.summary.averageSkillScore,
        averageBaselineScore: scorecard.summary.averageBaselineScore,
        averageScoreDelta: scorecard.summary.averageScoreDelta,
        status: scorecard.summary.status,
      })),
  };
}

export function evaluateScorecardGate(scorecard, options = {}) {
  const thresholds = normalizeScorecardGateOptions(options);
  const previousComparison = scorecard?.previousComparison;

  if (!previousComparison) {
    return {
      status: "skipped",
      reason: "no previous scorecard",
      thresholds,
    };
  }

  const currentStatus = scorecard.summary?.status || null;
  const previousStatus = previousComparison.previousStatus || null;
  const averageChange = previousComparison.scoreDeltaChange;
  const currentAverageScoreDelta = scorecard.summary?.averageScoreDelta ?? null;
  const previousAverageScoreDelta = inferPreviousMetric(currentAverageScoreDelta, averageChange);
  const statusRegression = currentStatus === "regressed" && previousStatus !== "regressed";
  const averageFailure = (
    typeof averageChange === "number" && averageChange < -thresholds.maxAverageRegression
  )
    ? {
        currentAverageScoreDelta,
        previousAverageScoreDelta,
        scoreDeltaChange: averageChange,
        threshold: thresholds.maxAverageRegression,
      }
    : null;

  const dimensionFailures = SCORE_DIMENSIONS
    .map((dimension) => {
      const currentAverage = scorecard.summary?.dimensions?.[dimension]?.averageScoreDelta ?? null;
      const change = previousComparison.dimensions?.[dimension]?.scoreDeltaChange ?? null;
      if (typeof change !== "number" || change >= -thresholds.maxDimensionRegression) return null;

      return {
        dimension,
        currentAverageScoreDelta: currentAverage,
        previousAverageScoreDelta: inferPreviousMetric(currentAverage, change),
        scoreDeltaChange: change,
        threshold: thresholds.maxDimensionRegression,
      };
    })
    .filter(Boolean);

  return {
    status: statusRegression || averageFailure || dimensionFailures.length > 0
      ? "blocked"
      : "passed",
    thresholds,
    currentStatus,
    previousStatus,
    statusRegression,
    averageFailure,
    dimensionFailures,
  };
}

function listScenarioCatalog() {
  return listScenarios()
    .map((scenarioName) => {
      const manifest = loadManifest(scenarioName);
      return manifest ? { scenarioName, manifest } : null;
    })
    .filter(Boolean);
}

export function writeSkillScorecards(
  scenarioResults,
  {
    scenarioCatalog = listScenarioCatalog(),
    scorecardsDir = SCORECARDS_DIR,
    gate = null,
  } = {},
) {
  const resultsBySkill = new Map();
  const scenariosBySkill = new Map();
  const normalizedGate = gate ? normalizeScorecardGateOptions(gate) : null;

  for (const entry of scenarioCatalog) {
    const skill = entry.manifest.skill;
    const current = scenariosBySkill.get(skill) || [];
    current.push(entry.manifest.name);
    scenariosBySkill.set(skill, current);
  }

  for (const result of scenarioResults) {
    if (!result?.report || !result?.manifest?.skill) continue;
    const current = resultsBySkill.get(result.manifest.skill) || [];
    current.push(result);
    resultsBySkill.set(result.manifest.skill, current);
  }

  const written = [];
  const skipped = [];
  const blocked = [];

  for (const [skill, results] of resultsBySkill.entries()) {
    const allScenarioNamesForSkill = (scenariosBySkill.get(skill) || [])
      .slice()
      .sort();
    const ranScenarioNames = results.map((result) => result.manifest.name);
    const missingScenarios = allScenarioNamesForSkill
      .filter((scenarioName) => !ranScenarioNames.includes(scenarioName))
      .sort();

    if (missingScenarios.length > 0) {
      skipped.push({
        skill,
        reason: "missing scenarios",
        missingScenarios,
      });
      continue;
    }

    if (results.some((result) => result.report.mode !== "compare" || !result.report.comparison)) {
      skipped.push({
        skill,
        reason: "scorecards require compare mode for every scenario",
      });
      continue;
    }

    if (!existsSync(scorecardsDir)) mkdirSync(scorecardsDir, { recursive: true });
    const filePath = join(scorecardsDir, `${skill}.json`);
    const previousScorecard = existsSync(filePath)
      ? JSON.parse(readFileSync(filePath, "utf-8"))
      : null;
    const scorecard = buildSkillScorecard({
      skill,
      scenarioResults: results,
      allScenarioNamesForSkill,
      previousScorecard,
    });
    const gateResult = normalizedGate
      ? evaluateScorecardGate(scorecard, normalizedGate)
      : null;

    if (gateResult?.status === "blocked") {
      blocked.push({
        skill,
        filePath,
        scorecard,
        gate: gateResult,
      });
      continue;
    }

    writeFileSync(filePath, `${JSON.stringify(scorecard, null, 2)}\n`);
    written.push({
      skill,
      filePath,
      scorecard,
      gate: gateResult,
    });
  }

  if (written.length > 0) {
    const validSkills = new Set(scenariosBySkill.keys());
    const storedScorecards = readdirSync(scorecardsDir)
      .filter((name) => name.endsWith(".json") && name !== "index.json")
      .map((name) => JSON.parse(readFileSync(join(scorecardsDir, name), "utf-8")))
      .filter((scorecard) => validSkills.has(scorecard.skill));
    const index = buildScorecardIndex(storedScorecards);
    writeFileSync(join(scorecardsDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  }

  return { written, skipped, blocked, gate: normalizedGate };
}

function buildPrompt(manifest, mode, workspaceDir, skillContent) {
  const header = `You are running inside ${workspaceDir}. Operate on this codebase directly and report the result.`;
  const taskPrompt = manifest.prompt.trim();

  if (mode === "skill") {
    return [
      header,
      taskPrompt,
      "",
      "Follow this Arcana skill exactly:",
      "",
      skillContent.trim(),
    ].join("\n");
  }

  return [header, taskPrompt].join("\n\n");
}

function createIsolatedWorkspace(scenarioName) {
  const tempRoot = mkdtempSync(join(tmpdir(), `arcana-eval-${scenarioName}-`));
  const scenarioSource = join(SCENARIOS_DIR, scenarioName);
  const workspaceDir = join(tempRoot, scenarioName);
  cpSync(scenarioSource, workspaceDir, { recursive: true });
  return { tempRoot, workspaceDir };
}

function resolveRunDir(workspaceDir, manifest) {
  const workdir = manifest.workdir ? join(workspaceDir, manifest.workdir) : workspaceDir;
  if (!existsSync(workdir) || !statSync(workdir).isDirectory()) {
    throw new Error(
      `Scenario workdir does not exist or is not a directory: ${manifest.workdir || "."}`,
    );
  }
  return workdir;
}

function runScenarioSetup(manifest, runDir) {
  for (const command of manifest.setupCommands || []) {
    execFileSync("/bin/sh", ["-lc", command], {
      cwd: runDir,
      encoding: "utf-8",
      timeout: manifest.setupTimeoutMs || DEFAULT_TIMEOUT_MS,
      env: {
        ...process.env,
      },
    });
  }
}

function invokeClaude(prompt, workspaceDir, manifest) {
  const cli = process.env.ARCANA_EVAL_CLAUDE_BIN || "claude";
  const maxTurns = manifest.maxTurns || DEFAULT_MAX_TURNS;
  const timeoutMs = manifest.timeoutMs || DEFAULT_TIMEOUT_MS;
  const permissionMode = process.env.ARCANA_EVAL_PERMISSION_MODE || "bypassPermissions";

  return execFileSync(
    cli,
    ["-p", prompt, "--max-turns", String(maxTurns), "--permission-mode", permissionMode],
    {
      cwd: workspaceDir,
      encoding: "utf-8",
      timeout: timeoutMs,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
    },
  );
}

function runAttempt({ scenarioName, manifest, mode, runIndex, skillPath, keepWorkspaces }) {
  const { tempRoot, workspaceDir } = createIsolatedWorkspace(scenarioName);

  try {
    const runDir = resolveRunDir(workspaceDir, manifest);
    runScenarioSetup(manifest, runDir);
    const beforeSnapshot = createWorkspaceSnapshot(runDir);
    const skillContent = mode === "skill"
      ? readFileSync(skillPath, "utf-8")
      : "";
    const prompt = buildPrompt(manifest, mode, runDir, skillContent);
    const output = invokeClaude(prompt, runDir, manifest);
    const afterSnapshot = createWorkspaceSnapshot(runDir);
    const result = gradeAttempt({
      output,
      manifest,
      beforeSnapshot,
      afterSnapshot,
      mode,
      runIndex,
    });

    return {
      ...result,
      rawOutput: output,
      workspaceDir: keepWorkspaces ? runDir : null,
    };
  } catch (err) {
    const stderr = err?.stderr ? String(err.stderr).trim() : "";
    const stdout = err?.stdout ? String(err.stdout).trim() : "";
    const detail = [stderr, stdout].filter(Boolean).join("\n\n");

    return {
      scenario: manifest.name,
      skill: manifest.skill,
      mode,
      runIndex,
      timestamp: new Date().toISOString(),
      grade: "ERROR",
      error: detail
        ? `${err?.message || String(err)}\n${detail}`
        : (err?.message || String(err)),
      rawOutput: detail,
      workspaceDir: keepWorkspaces ? workspaceDir : null,
    };
  } finally {
    if (!keepWorkspaces) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

function saveEvaluationReport(report) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const artifactDirName = `${report.scenario}_${Date.now()}`;
  const artifactDir = join(RESULTS_DIR, artifactDirName);
  mkdirSync(artifactDir, { recursive: true });

  writeFileSync(join(artifactDir, "report.json"), JSON.stringify(report, null, 2));

  for (const attempt of report.attempts) {
    const outputFilename = `${attempt.mode}-run${attempt.runIndex}.txt`;
    writeFileSync(join(artifactDir, outputFilename), attempt.rawOutput || "");
  }

  return artifactDir;
}

function printAttemptSummary(label, summary) {
  if (!summary) return;

  console.log(`    ${label}:`);
  console.log(
    `      Runs: ${summary.successfulRuns}/${summary.runsRequested} successful`,
  );

  if (summary.successfulRuns === 0) {
    console.log("      No successful runs.");
    return;
  }

  console.log(
    `      Detection: ${toPercent(summary.averageDetectionRate)} | False positives: ${toPercent(summary.averageFalsePositiveRate)} | Score: ${summary.averageScore.toFixed(2)}`,
  );
  console.log(
    `      Dimensions: ${SCORE_DIMENSIONS
      .filter((dimension) => summary.dimensions?.[dimension]?.active)
      .map((dimension) => `${dimension} ${summary.dimensions[dimension].averageScore.toFixed(2)}`)
      .join(" | ") || "n/a"}`,
  );
  console.log(
    `      Grades: PASS ${summary.gradeCounts.PASS}, PARTIAL ${summary.gradeCounts.PARTIAL}, FAIL ${summary.gradeCounts.FAIL}, ERROR ${summary.gradeCounts.ERROR}`,
  );
}

function printComparison(comparison) {
  if (!comparison) return;

  console.log("    Delta vs baseline:");
  console.log(
    `      Detection ${toSignedPercentagePoints(comparison.detectionDelta)} | False positives ${toSignedPercentagePoints(comparison.falsePositiveDelta)} | Score ${comparison.scoreDelta === null ? "n/a" : comparison.scoreDelta.toFixed(2)}`,
  );
  console.log(
    `      Dimensions: ${SCORE_DIMENSIONS
      .filter((dimension) => comparison.dimensions?.[dimension]?.scoreDelta !== null)
      .map((dimension) => `${dimension} ${toSignedPercentagePoints(comparison.dimensions[dimension].scoreDelta)}`)
      .join(" | ") || "n/a"}`,
  );
  console.log(
    `      Paired runs: ${comparison.pairedRuns || 0} | Wins ${comparison.wins} | Losses ${comparison.losses} | Ties ${comparison.ties}`,
  );
}

function parseCliArgs(args) {
  const scenarioFlag = args.indexOf("--scenario");
  const skillFlag = args.indexOf("--skill");
  const runsFlag = args.indexOf("--runs");
  const modeFlag = args.indexOf("--mode");
  const maxAverageRegressionFlag = args.indexOf("--max-scorecard-regression");
  const maxDimensionRegressionFlag = args.indexOf("--max-dimension-regression");

  return {
    shouldRun: args.includes("--run"),
    keepWorkspaces: args.includes("--keep-workspaces"),
    writeScorecards: args.includes("--write-scorecards"),
    gateScorecards: args.includes("--gate-scorecards"),
    targetScenario: scenarioFlag !== -1 ? args[scenarioFlag + 1] : null,
    targetSkill: skillFlag !== -1 ? args[skillFlag + 1] : null,
    runs: runsFlag !== -1 ? args[runsFlag + 1] : undefined,
    mode: modeFlag !== -1 ? args[modeFlag + 1] : undefined,
    maxAverageRegression: maxAverageRegressionFlag !== -1 ? args[maxAverageRegressionFlag + 1] : undefined,
    maxDimensionRegression: maxDimensionRegressionFlag !== -1 ? args[maxDimensionRegressionFlag + 1] : undefined,
  };
}

function printUsageAndExit(message) {
  if (message) {
    console.error(`\n  ${message}\n`);
  }

  console.error("  Usage:");
  console.error("    node evals/run-eval.js [--scenario <name>] [--skill <skill>]");
  console.error("    node evals/run-eval.js --scenario <name> --run [--runs <n>] [--mode compare|skill|baseline]");
  console.error("    node evals/run-eval.js --run --runs 3 --write-scorecards");
  console.error("    node evals/run-eval.js --run --runs 3 --write-scorecards --gate-scorecards");
  console.error("    node evals/run-eval.js --scenario <name> --run --keep-workspaces");
  process.exit(1);
}

export function buildScenarioPlan(manifest, options) {
  const mode = parseMode(options.mode) || "compare";
  const runs = parseRunCount(options.runs) || 1;
  const scoring = getManifestScoring(manifest);

  return {
    mode,
    runs,
    attemptsPerScenario: mode === "compare" ? runs * 2 : runs,
    baselineEnabled: mode === "compare" || mode === "baseline",
    skillEnabled: mode === "compare" || mode === "skill",
    prompt: manifest.prompt,
    scoring,
  };
}

export function evaluateScenario(scenarioName, options) {
  const manifest = loadManifest(scenarioName);
  if (!manifest) return null;

  const issues = validateScenario(manifest);
  if (issues.length > 0) {
    return {
      scenario: scenarioName,
      manifest,
      issues,
    };
  }

  const plan = buildScenarioPlan(manifest, options);
  const skillPath = join(__dirname, "..", "skills", manifest.skill, "SKILL.md");

  if (!existsSync(skillPath)) {
    return {
      scenario: scenarioName,
      manifest,
      issues: [`Skill '${manifest.skill}' is not shipped in this repo.`],
      plan,
    };
  }

  if (!options.shouldRun) {
    return {
      scenario: scenarioName,
      manifest,
      plan,
      dryRun: true,
    };
  }

  const attempts = [];
  for (let runIndex = 1; runIndex <= plan.runs; runIndex += 1) {
    if (plan.baselineEnabled) {
      attempts.push(
        runAttempt({
          scenarioName,
          manifest,
          mode: "baseline",
          runIndex,
          skillPath,
          keepWorkspaces: options.keepWorkspaces,
        }),
      );
    }

    if (plan.skillEnabled) {
      attempts.push(
        runAttempt({
          scenarioName,
          manifest,
          mode: "skill",
          runIndex,
          skillPath,
          keepWorkspaces: options.keepWorkspaces,
        }),
      );
    }
  }

  const baselineSummary = plan.baselineEnabled
    ? summarizeAttempts(attempts.filter((attempt) => attempt.mode === "baseline"))
    : null;
  const skillSummary = plan.skillEnabled
    ? summarizeAttempts(attempts.filter((attempt) => attempt.mode === "skill"))
    : null;
  const comparison = plan.mode === "compare"
    ? compareAttemptSets(skillSummary, baselineSummary)
    : null;

  const report = {
    scenario: manifest.name,
    description: manifest.description,
    skill: manifest.skill,
    prompt: manifest.prompt,
    mode: plan.mode,
    runsRequested: plan.runs,
    baseline: baselineSummary,
    skillRuns: skillSummary,
    comparison,
    attempts,
  };

  const artifactDir = saveEvaluationReport(report);

  return {
    scenario: scenarioName,
    manifest,
    plan,
    report,
    artifactDir,
  };
}

export async function main(rawArgs = process.argv.slice(2)) {
  const parsed = parseCliArgs(rawArgs);
  const runs = parseRunCount(parsed.runs);
  const mode = parseMode(parsed.mode);
  const maxAverageRegression = parseNonNegativeNumber(parsed.maxAverageRegression);
  const maxDimensionRegression = parseNonNegativeNumber(parsed.maxDimensionRegression);

  if (runs === null) {
    printUsageAndExit("Invalid --runs value. Use a positive integer.");
  }
  if (mode === null) {
    printUsageAndExit("Invalid --mode value. Use compare, skill, or baseline.");
  }
  if (parsed.gateScorecards && !parsed.shouldRun) {
    printUsageAndExit("--gate-scorecards requires --run.");
  }
  if (parsed.gateScorecards && !parsed.writeScorecards) {
    printUsageAndExit("--gate-scorecards requires --write-scorecards.");
  }
  if (!parsed.gateScorecards && (
    parsed.maxAverageRegression !== undefined || parsed.maxDimensionRegression !== undefined
  )) {
    printUsageAndExit("Scorecard regression thresholds require --gate-scorecards.");
  }
  if (parsed.maxAverageRegression !== undefined && maxAverageRegression === null) {
    printUsageAndExit("Invalid --max-scorecard-regression value. Use a non-negative number.");
  }
  if (parsed.maxDimensionRegression !== undefined && maxDimensionRegression === null) {
    printUsageAndExit("Invalid --max-dimension-regression value. Use a non-negative number.");
  }

  let scenarios = listScenarios();

  if (parsed.targetScenario) {
    scenarios = scenarios.filter((scenarioName) => scenarioName === parsed.targetScenario);
  }

  if (parsed.targetSkill) {
    scenarios = scenarios.filter((scenarioName) => {
      const manifest = loadManifest(scenarioName);
      return manifest && manifest.skill === parsed.targetSkill;
    });
  }

  if (scenarios.length === 0) {
    console.log("\n  No matching scenarios found.\n");
    console.log("  Available scenarios:");
    for (const scenarioName of listScenarios()) {
      const manifest = loadManifest(scenarioName);
      console.log(
        `    ${scenarioName} (${manifest?.skill}) — ${manifest?.description || "no description"}`,
      );
    }
    return;
  }

  console.log("\n✦ Arcana Skill Eval\n");

  const executedResults = [];

  for (const scenarioName of scenarios) {
    const result = evaluateScenario(scenarioName, {
      shouldRun: parsed.shouldRun,
      keepWorkspaces: parsed.keepWorkspaces,
      runs,
      mode,
    });

    if (!result) continue;
    if (result.report) {
      executedResults.push(result);
    }

    const { manifest } = result;
    console.log(`  ${manifest.name} (skill: ${manifest.skill})`);
    console.log(`    ${manifest.description}`);
    console.log(
      `    Expected: ${manifest.expected.length} findings, ${toArray(manifest.falsePositives).length} false-positive traps`,
    );

    if (result.issues?.length) {
      console.log("    ✗ Scenario invalid:");
      for (const issue of result.issues) {
        console.log(`      - ${issue}`);
      }
      console.log();
      continue;
    }

    if (result.dryRun) {
      console.log(
        `    → Dry run. Mode: ${result.plan.mode}, runs: ${result.plan.runs}, attempts: ${result.plan.attemptsPerScenario}`,
      );
      console.log(
        `    → Scoring weights: ${SCORE_DIMENSIONS.map((dimension) => `${dimension} ${result.plan.scoring.weights[dimension].toFixed(2)}`).join(" | ")}`,
      );
      console.log("    → Add --run to invoke Claude Code.\n");
      continue;
    }

    printAttemptSummary("Baseline", result.report.baseline);
    printAttemptSummary("With skill", result.report.skillRuns);
    if (result.report.comparison) {
      printComparison(result.report.comparison);
    }
    console.log(`    Results saved: ${relative(process.cwd(), result.artifactDir)}\n`);
  }

  if (parsed.shouldRun && parsed.writeScorecards) {
    const scorecardUpdate = writeSkillScorecards(executedResults, {
      gate: parsed.gateScorecards
        ? {
            maxAverageRegression: maxAverageRegression ?? DEFAULT_SCORECARD_GATE_THRESHOLDS.maxAverageRegression,
            maxDimensionRegression: maxDimensionRegression ?? DEFAULT_SCORECARD_GATE_THRESHOLDS.maxDimensionRegression,
          }
        : null,
    });

    console.log("  Scorecards:");
    if (scorecardUpdate.written.length === 0) {
      console.log("    No scorecards written.");
    } else {
      for (const entry of scorecardUpdate.written) {
        const gateNote = entry.gate?.status === "skipped"
          ? " [baseline created]"
          : "";
        console.log(
          `    Wrote ${relative(process.cwd(), entry.filePath)} (${entry.scorecard.summary.status}, delta ${entry.scorecard.summary.averageScoreDelta ?? "n/a"})${gateNote}`,
        );
      }
    }
    for (const entry of scorecardUpdate.skipped) {
      const detail = entry.missingScenarios?.length
        ? ` — missing ${entry.missingScenarios.join(", ")}`
        : "";
      console.log(`    Skipped ${entry.skill}: ${entry.reason}${detail}`);
    }
    for (const entry of scorecardUpdate.blocked) {
      console.log(`    Blocked ${entry.skill}: regression gate failed; kept existing scorecard`);
    }
    if (parsed.gateScorecards) {
      console.log("  Scorecard gate:");
      const thresholds = scorecardUpdate.gate || DEFAULT_SCORECARD_GATE_THRESHOLDS;
      console.log(
        `    Thresholds: average ${thresholds.maxAverageRegression.toFixed(2)} | dimension ${thresholds.maxDimensionRegression.toFixed(2)}`,
      );
      if (scorecardUpdate.blocked.length === 0) {
        console.log("    PASS  No blocked scorecard regressions.");
      } else {
        for (const entry of scorecardUpdate.blocked) {
          const gate = entry.gate;
          const currentAverage = gate.averageFailure?.currentAverageScoreDelta ?? entry.scorecard.summary.averageScoreDelta;
          const previousAverage = gate.averageFailure?.previousAverageScoreDelta ?? inferPreviousMetric(
            entry.scorecard.summary.averageScoreDelta,
            entry.scorecard.previousComparison?.scoreDeltaChange ?? null,
          );

          console.log(`    FAIL  ${entry.skill}`);
          if (gate.statusRegression) {
            console.log(
              `      status ${gate.previousStatus || "unknown"} -> ${gate.currentStatus || "unknown"}`,
            );
          }
          if (gate.averageFailure) {
            console.log(
              `      average delta ${previousAverage ?? "n/a"} -> ${currentAverage ?? "n/a"} (change ${gate.averageFailure.scoreDeltaChange.toFixed(2)}, limit -${gate.averageFailure.threshold.toFixed(2)})`,
            );
          }
          for (const dimensionFailure of gate.dimensionFailures) {
            console.log(
              `      ${dimensionFailure.dimension} delta ${dimensionFailure.previousAverageScoreDelta ?? "n/a"} -> ${dimensionFailure.currentAverageScoreDelta ?? "n/a"} (change ${dimensionFailure.scoreDeltaChange.toFixed(2)}, limit -${dimensionFailure.threshold.toFixed(2)})`,
            );
          }
        }
      }
    }
    console.log();

    if (parsed.gateScorecards && scorecardUpdate.blocked.length > 0) {
      process.exitCode = 1;
    }
  }

  if (!parsed.shouldRun) {
    console.log("  Run with --run to invoke Claude Code against scenarios.\n");
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error(`\n  Fatal: ${err?.message || err}\n`);
    process.exit(1);
  });
}
