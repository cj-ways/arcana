import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SCORECARD_GATE_THRESHOLDS,
  SCORE_DIMENSIONS,
  buildSkillScorecard,
  buildScorecardIndex,
  evaluateScorecardGate,
  writeSkillScorecards,
} from "../evals/run-eval.js";

const tempDirs = [];

function makeDimensionAggregate(score) {
  return {
    weight: 1 / SCORE_DIMENSIONS.length,
    active: true,
    activeRuns: 3,
    averageDetectionRate: score,
    averageFalsePositiveRate: 0,
    averageScore: score,
  };
}

function makeAttemptSummary(score) {
  return {
    runsRequested: 3,
    successfulRuns: 3,
    erroredRuns: 0,
    gradeCounts: {
      PASS: score === 1 ? 3 : 0,
      PARTIAL: score < 1 && score >= 0.75 ? 3 : 0,
      FAIL: score < 0.75 ? 3 : 0,
      ERROR: 0,
    },
    averageDetectionRate: score,
    averageFalsePositiveRate: 0,
    averageAggregateScore: score,
    averageScore: score,
    bestScore: score,
    worstScore: score,
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => [dimension, makeDimensionAggregate(score)]),
    ),
  };
}

function makeComparison(scoreDelta) {
  return {
    pairedRuns: 3,
    detectionDelta: scoreDelta,
    falsePositiveDelta: 0,
    aggregateScoreDelta: scoreDelta,
    scoreDelta,
    wins: scoreDelta > 0 ? 3 : 0,
    losses: scoreDelta < 0 ? 3 : 0,
    ties: scoreDelta === 0 ? 3 : 0,
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => [dimension, {
        detectionDelta: scoreDelta,
        falsePositiveDelta: 0,
        scoreDelta,
      }]),
    ),
  };
}

function makeScenarioResult({
  skill,
  name,
  mode = "compare",
  skillScore = 1,
  baselineScore = 0.5,
  scoreDelta = 0.5,
}) {
  return {
    manifest: {
      skill,
      name,
      description: `${name} description`,
    },
    artifactDir: join("/tmp", `${name}-artifact`),
    report: {
      mode,
      runsRequested: 3,
      baseline: makeAttemptSummary(baselineScore),
      skillRuns: makeAttemptSummary(skillScore),
      comparison: mode === "compare" ? makeComparison(scoreDelta) : null,
    },
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("skill scorecards", () => {
  it("builds a per-skill scorecard with previous comparison data", () => {
    const scorecard = buildSkillScorecard({
      skill: "security-check",
      allScenarioNamesForSkill: ["sql-audit", "secret-audit"],
      previousScorecard: {
        generatedAt: "2026-04-01T00:00:00.000Z",
        summary: {
          status: "flat",
          averageScoreDelta: 0.2,
          dimensions: {
            route: { averageScoreDelta: 0.1 },
            process: { averageScoreDelta: 0.2 },
            outcome: { averageScoreDelta: 0.3 },
          },
        },
      },
      scenarioResults: [
        makeScenarioResult({
          skill: "security-check",
          name: "sql-audit",
          skillScore: 0.9,
          baselineScore: 0.4,
          scoreDelta: 0.5,
        }),
        makeScenarioResult({
          skill: "security-check",
          name: "secret-audit",
          skillScore: 1,
          baselineScore: 0.5,
          scoreDelta: 0.5,
        }),
      ],
    });

    expect(scorecard.coverage.complete).toBe(true);
    expect(scorecard.summary.averageSkillScore).toBe(0.95);
    expect(scorecard.summary.averageScoreDelta).toBe(0.5);
    expect(scorecard.summary.status).toBe("improved");
    expect(scorecard.previousComparison.previousStatus).toBe("flat");
    expect(scorecard.previousComparison.scoreDeltaChange).toBe(0.3);
    expect(scorecard.scenarios).toHaveLength(2);
  });

  it("writes complete compare-mode scorecards and skips incomplete or non-compare runs", () => {
    const scorecardsDir = mkdtempSync(join(tmpdir(), "arcana-scorecards-"));
    tempDirs.push(scorecardsDir);
    writeFileSync(
      join(scorecardsDir, "security-check.json"),
      JSON.stringify({
        generatedAt: "2026-04-01T00:00:00.000Z",
        summary: {
          status: "flat",
          averageScoreDelta: 0.1,
          dimensions: {
            route: { averageScoreDelta: 0.1 },
            process: { averageScoreDelta: 0.1 },
            outcome: { averageScoreDelta: 0.1 },
          },
        },
      }),
    );

    const result = writeSkillScorecards(
      [
        makeScenarioResult({
          skill: "security-check",
          name: "sql-audit",
          scoreDelta: 0.4,
        }),
        makeScenarioResult({
          skill: "quick-review",
          name: "diff-audit",
          mode: "skill",
          scoreDelta: 0.4,
        }),
        makeScenarioResult({
          skill: "agent-audit",
          name: "config-audit",
          scoreDelta: 0.2,
        }),
      ],
      {
        scorecardsDir,
        scenarioCatalog: [
          { scenarioName: "sql-audit", manifest: { name: "sql-audit", skill: "security-check" } },
          { scenarioName: "diff-audit", manifest: { name: "diff-audit", skill: "quick-review" } },
          { scenarioName: "config-audit", manifest: { name: "config-audit", skill: "agent-audit" } },
          { scenarioName: "rules-audit", manifest: { name: "rules-audit", skill: "agent-audit" } },
        ],
      },
    );

    expect(result.written.map((entry) => entry.skill)).toEqual(["security-check"]);
    expect(result.skipped).toEqual([
      {
        skill: "quick-review",
        reason: "scorecards require compare mode for every scenario",
      },
      {
        skill: "agent-audit",
        reason: "missing scenarios",
        missingScenarios: ["rules-audit"],
      },
    ]);

    const scorecard = JSON.parse(
      readFileSync(join(scorecardsDir, "security-check.json"), "utf-8"),
    );
    expect(scorecard.previousComparison.scoreDeltaChange).toBe(0.3);

    const index = JSON.parse(
      readFileSync(join(scorecardsDir, "index.json"), "utf-8"),
    );
    expect(index.skills).toHaveLength(1);
    expect(index.skills[0].skill).toBe("security-check");
  });

  it("builds a stable index from stored scorecards", () => {
    const index = buildScorecardIndex([
      {
        skill: "security-check",
        generatedAt: "2026-04-09T00:00:00.000Z",
        summary: {
          scenarioCount: 1,
          averageSkillScore: 0.9,
          averageBaselineScore: 0.4,
          averageScoreDelta: 0.5,
          status: "improved",
        },
      },
      {
        skill: "quick-review",
        generatedAt: "2026-04-09T00:00:00.000Z",
        summary: {
          scenarioCount: 1,
          averageSkillScore: 0.7,
          averageBaselineScore: 0.6,
          averageScoreDelta: 0.1,
          status: "flat",
        },
      },
    ]);

    expect(index.skills.map((entry) => entry.skill)).toEqual([
      "quick-review",
      "security-check",
    ]);
    expect(index.skills[1].scorecardPath).toBe("evals/scorecards/security-check.json");
  });

  it("evaluates scorecard regression gates against the previous stored baseline", () => {
    const scorecard = buildSkillScorecard({
      skill: "security-check",
      allScenarioNamesForSkill: ["sql-audit"],
      previousScorecard: {
        generatedAt: "2026-04-01T00:00:00.000Z",
        summary: {
          status: "improved",
          averageScoreDelta: 0.4,
          dimensions: {
            route: { averageScoreDelta: 0.35 },
            process: { averageScoreDelta: 0.4 },
            outcome: { averageScoreDelta: 0.45 },
          },
        },
      },
      scenarioResults: [
        makeScenarioResult({
          skill: "security-check",
          name: "sql-audit",
          skillScore: 0.7,
          baselineScore: 0.5,
          scoreDelta: 0.2,
        }),
      ],
    });

    const gate = evaluateScorecardGate(scorecard);

    expect(gate.status).toBe("blocked");
    expect(gate.currentStatus).toBe("improved");
    expect(gate.averageFailure).toMatchObject({
      previousAverageScoreDelta: 0.4,
      currentAverageScoreDelta: 0.2,
      scoreDeltaChange: -0.2,
      threshold: DEFAULT_SCORECARD_GATE_THRESHOLDS.maxAverageRegression,
    });
    expect(gate.dimensionFailures.map((entry) => entry.dimension)).toEqual([
      "route",
      "process",
      "outcome",
    ]);
  });

  it("does not overwrite a stored scorecard when the regression gate blocks it", () => {
    const scorecardsDir = mkdtempSync(join(tmpdir(), "arcana-scorecards-"));
    tempDirs.push(scorecardsDir);
    const existingScorecard = {
      generatedAt: "2026-04-01T00:00:00.000Z",
      summary: {
        status: "improved",
        averageScoreDelta: 0.4,
        dimensions: {
          route: { averageScoreDelta: 0.4 },
          process: { averageScoreDelta: 0.4 },
          outcome: { averageScoreDelta: 0.4 },
        },
      },
    };

    writeFileSync(
      join(scorecardsDir, "security-check.json"),
      JSON.stringify(existingScorecard),
    );

    const result = writeSkillScorecards(
      [
        makeScenarioResult({
          skill: "security-check",
          name: "sql-audit",
          skillScore: 0.7,
          baselineScore: 0.55,
          scoreDelta: 0.15,
        }),
      ],
      {
        gate: {
          maxAverageRegression: 0.05,
          maxDimensionRegression: 0.05,
        },
        scorecardsDir,
        scenarioCatalog: [
          { scenarioName: "sql-audit", manifest: { name: "sql-audit", skill: "security-check" } },
        ],
      },
    );

    expect(result.written).toEqual([]);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].skill).toBe("security-check");

    const stored = JSON.parse(
      readFileSync(join(scorecardsDir, "security-check.json"), "utf-8"),
    );
    expect(stored.generatedAt).toBe(existingScorecard.generatedAt);
    expect(stored.summary.averageScoreDelta).toBe(existingScorecard.summary.averageScoreDelta);
  });
});
