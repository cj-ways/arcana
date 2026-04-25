import { describe, expect, it } from "vitest";
import {
  buildScenarioPlan,
  compareAttemptSets,
  gradeAttempt,
  matchesTextRules,
  SCORE_DIMENSIONS,
  summarizeAttempts,
  validateScenario,
} from "../evals/run-eval.js";

describe("eval manifest validation", () => {
  it("requires a prompt for scenario execution", () => {
    const issues = validateScenario({
      name: "demo",
      skill: "security-check",
      description: "demo",
      expected: [],
    });

    expect(issues).toContain("Missing 'prompt'");
  });

  it("rejects invalid setupCommands and workdir values", () => {
    const issues = validateScenario({
      name: "demo",
      skill: "security-check",
      description: "demo",
      prompt: "Audit the codebase",
      expected: [],
      setupCommands: ["git init", ""],
      workdir: "",
    });

    expect(issues).toContain("Invalid 'setupCommands' entry: commands must be non-empty strings");
    expect(issues).toContain("Invalid 'workdir' value: expected a non-empty string");
  });

  it("rejects invalid dimensions and scoring weights", () => {
    const issues = validateScenario({
      name: "demo",
      skill: "security-check",
      description: "demo",
      prompt: "Audit the codebase",
      scoring: {
        weights: {
          route: -1,
        },
      },
      expected: [
        {
          id: "case-1",
          description: "bad dimension",
          dimension: "bad",
        },
      ],
      falsePositives: [],
    });

    expect(issues).toContain("expected item 'case-1' has invalid 'dimension'");
    expect(issues).toContain("Invalid scoring weight for 'route': expected a non-negative number");
  });

  it("accepts file-contains assertions with any-of content rules", () => {
    const issues = validateScenario({
      name: "demo",
      skill: "generate-tests",
      description: "demo",
      prompt: "Generate tests",
      expected: [
        {
          id: "case-1",
          description: "has one acceptable pattern",
          type: "file-contains",
          file: "tests/orders.test.js",
          contentMatchesAny: ["/orders/"],
        },
      ],
      falsePositives: [],
    });

    expect(issues).toEqual([]);
  });

  it("accepts workspace-clean assertions without file fields", () => {
    const issues = validateScenario({
      name: "demo",
      skill: "quick-review",
      description: "demo",
      prompt: "Review the diff",
      expected: [
        {
          id: "stay-read-only",
          description: "review should not edit files",
          type: "workspace-clean",
        },
      ],
      falsePositives: [],
    });

    expect(issues).toEqual([]);
  });

  it("accepts reported-context assertions with contextual rules", () => {
    const issues = validateScenario({
      name: "demo",
      skill: "security-check",
      description: "demo",
      prompt: "Audit the codebase",
      expected: [
        {
          id: "sql-inject",
          description: "reported with severity and file context",
          type: "reported-context",
          file: "src/routes/users.js",
          contextMatches: ["/critical/i"],
        },
      ],
      falsePositives: [],
    });

    expect(issues).toEqual([]);
  });
});

describe("text matching helpers", () => {
  it("supports any-of include and regex rules", () => {
    const matched = matchesTextRules("alpha beta gamma", {
      includesAny: ["delta", "beta"],
      matchesAny: ["/zeta/", "/ga.m/"],
      excludes: ["omega"],
    });

    expect(matched).toBe(true);
  });
});

describe("attempt grading", () => {
  const manifest = {
    name: "untested-api",
    skill: "generate-tests",
    scoring: {
      weights: {
        route: 0.2,
        process: 0.3,
        outcome: 0.5,
      },
    },
    expected: [
      {
        id: "test-file-created",
        description: "new test file exists",
        dimension: "outcome",
        type: "file-created",
        file: "tests/orders.test.js",
      },
      {
        id: "style-match",
        description: "vitest style is used",
        dimension: "route",
        type: "file-contains",
        file: "tests/orders.test.js",
        contentMatches: ["/from ['\\\"]vitest['\\\"]/"],
      },
      {
        id: "validation-path",
        description: "at least one validation case is covered",
        dimension: "process",
        type: "file-contains",
        file: "tests/orders.test.js",
        contentMatchesAny: [
          "/userId is required/",
          "/items must be a non-empty array/",
        ],
      },
    ],
    falsePositives: [
      {
        id: "existing-file-stable",
        description: "existing users test stays unchanged",
        dimension: "outcome",
        type: "file-unchanged",
        file: "tests/users.test.js",
      },
    ],
  };

  it("grades file-based assertions against workspace snapshots", () => {
    const beforeSnapshot = {
      "tests/users.test.js": "import { describe } from 'vitest';\n",
    };
    const afterSnapshot = {
      ...beforeSnapshot,
      "tests/orders.test.js": [
        "import { describe, it, expect } from \"vitest\";",
        "describe(\"createOrder\", () => {",
        "  it(\"throws on missing userId\", () => {",
        "    expect(() => createOrder()).toThrow(\"userId is required\");",
        "  });",
        "});",
      ].join("\n"),
    };

    const result = gradeAttempt({
      output: "Created tests/orders.test.js",
      manifest,
      beforeSnapshot,
      afterSnapshot,
      mode: "skill",
      runIndex: 1,
    });

    expect(result.grade).toBe("PASS");
    expect(result.workspaceDiff.created).toContain("tests/orders.test.js");
    expect(result.found).toEqual([
      "test-file-created",
      "style-match",
      "validation-path",
    ]);
    expect(result.clean).toEqual(["existing-file-stable"]);
    expect(result.score).toBe(1);
    expect(result.aggregateScore).toBe(1);
    expect(result.dimensions.route.score).toBe(1);
    expect(result.dimensions.process.score).toBe(1);
    expect(result.dimensions.outcome.score).toBe(1);
  });

  it("uses weighted route/process/outcome scoring", () => {
    const weightedManifest = {
      ...manifest,
      expected: manifest.expected,
      falsePositives: manifest.falsePositives,
    };
    const beforeSnapshot = {
      "tests/users.test.js": "import { describe } from 'vitest';\n",
    };
    const afterSnapshot = {
      ...beforeSnapshot,
      "tests/orders.test.js": [
        "describe(\"createOrder\", () => {",
        "  it(\"throws on missing userId\", () => {",
        "    expect(() => createOrder()).toThrow(\"userId is required\");",
        "  });",
        "});",
      ].join("\n"),
    };

    const result = gradeAttempt({
      output: "Created tests/orders.test.js",
      manifest: weightedManifest,
      beforeSnapshot,
      afterSnapshot,
      mode: "skill",
      runIndex: 1,
    });

    expect(result.dimensions.route.score).toBe(0);
    expect(result.dimensions.process.score).toBe(1);
    expect(result.dimensions.outcome.score).toBe(1);
    expect(result.score).toBeCloseTo(0.8, 5);
    expect(result.aggregateScore).toBeCloseTo(0.6666666667, 5);
  });

  it("supports workspace-clean assertions for read-only workflows", () => {
    const manifest = {
      name: "idea-audit",
      skill: "idea-audit",
      scoring: {
        weights: {
          route: 0.2,
          process: 0.3,
          outcome: 0.5,
        },
      },
      expected: [
        {
          id: "asks-for-approval",
          description: "asks for approval before scaffolding",
          dimension: "route",
          type: "output-contains",
          outputIncludes: ["Does this plan look right?"],
        },
      ],
      falsePositives: [
        {
          id: "workspace-clean",
          description: "does not edit files before approval",
          dimension: "process",
          type: "workspace-clean",
        },
      ],
    };

    const cleanResult = gradeAttempt({
      output: "Phase 1\nDoes this plan look right?",
      manifest,
      beforeSnapshot: {
        "idea.md": "Idea",
      },
      afterSnapshot: {
        "idea.md": "Idea",
      },
      mode: "skill",
      runIndex: 1,
    });

    expect(cleanResult.clean).toEqual(["workspace-clean"]);
    expect(cleanResult.falsePositives).toEqual([]);
    expect(cleanResult.grade).toBe("PASS");

    const dirtyResult = gradeAttempt({
      output: "Phase 1\nDoes this plan look right?",
      manifest,
      beforeSnapshot: {
        "idea.md": "Idea",
      },
      afterSnapshot: {
        "idea.md": "Idea",
        "PLAN.md": "created too early",
      },
      mode: "skill",
      runIndex: 1,
    });

    expect(dirtyResult.clean).toEqual([]);
    expect(dirtyResult.falsePositives).toEqual(["workspace-clean"]);
    expect(dirtyResult.dimensions.process.falsePositiveRate).toBe(1);
  });

  it("supports contextual reported findings anchored to a file reference", () => {
    const manifest = {
      name: "security-check",
      skill: "security-check",
      scoring: {
        weights: {
          route: 0.2,
          process: 0.3,
          outcome: 0.5,
        },
      },
      expected: [
        {
          id: "sql-inject",
          description: "reported with file, line, severity, and vulnerability context",
          dimension: "outcome",
          type: "reported-context",
          file: "src/routes/users.js",
          contextMatches: [
            "/src\\/routes\\/users\\.js:7\\b/i",
            "/\\bcritical\\b/i",
          ],
          contextMatchesAny: [
            "/sql injection/i",
            "/raw sql/i",
          ],
        },
      ],
      falsePositives: [
        {
          id: "safe-posts",
          description: "safe parameterized query stays unflagged",
          dimension: "outcome",
          type: "reported-context",
          file: "src/routes/posts.js",
          contextMatchesAny: [
            "/sql injection/i",
            "/\\bcritical\\b/i",
          ],
        },
      ],
    };

    const result = gradeAttempt({
      output: [
        "## Security Check Report",
        "#### [CRITICAL] SQL injection",
        "- **File:** src/routes/users.js:7",
        "- **Recommendation:** Use parameterized queries instead.",
        "",
        "Checked src/routes/posts.js and found no issues.",
      ].join("\n"),
      manifest,
      beforeSnapshot: {},
      afterSnapshot: {},
      mode: "skill",
      runIndex: 1,
    });

    expect(result.found).toEqual(["sql-inject"]);
    expect(result.clean).toEqual(["safe-posts"]);
    expect(result.falsePositives).toEqual([]);
    expect(result.grade).toBe("PASS");
  });
});

describe("attempt summaries", () => {
  it("aggregates attempts and compares skill vs baseline", () => {
    const baselineSummary = summarizeAttempts([
      {
        grade: "FAIL",
        detectionRate: 0.25,
        falsePositiveRate: 0.5,
        aggregateScore: -0.25,
        score: -0.1,
        dimensions: {
          route: { active: true, weight: 0.2, detectionRate: 0, falsePositiveRate: 0, score: 0 },
          process: { active: true, weight: 0.3, detectionRate: 0.5, falsePositiveRate: 0.5, score: 0 },
          outcome: { active: true, weight: 0.5, detectionRate: 0.25, falsePositiveRate: 1, score: -0.75 },
        },
      },
      {
        grade: "PARTIAL",
        detectionRate: 0.5,
        falsePositiveRate: 0.25,
        aggregateScore: 0.25,
        score: 0.35,
        dimensions: {
          route: { active: true, weight: 0.2, detectionRate: 0.5, falsePositiveRate: 0, score: 0.5 },
          process: { active: true, weight: 0.3, detectionRate: 0.5, falsePositiveRate: 0, score: 0.5 },
          outcome: { active: true, weight: 0.5, detectionRate: 0.5, falsePositiveRate: 0.5, score: 0 },
        },
      },
    ]);
    const skillSummary = summarizeAttempts([
      {
        grade: "PASS",
        detectionRate: 1,
        falsePositiveRate: 0,
        aggregateScore: 1,
        score: 1,
        dimensions: Object.fromEntries(
          SCORE_DIMENSIONS.map((dimension, index) => [dimension, {
            active: true,
            weight: [0.2, 0.3, 0.5][index],
            detectionRate: 1,
            falsePositiveRate: 0,
            score: 1,
          }]),
        ),
      },
      {
        grade: "PASS",
        detectionRate: 1,
        falsePositiveRate: 0,
        aggregateScore: 1,
        score: 1,
        dimensions: Object.fromEntries(
          SCORE_DIMENSIONS.map((dimension, index) => [dimension, {
            active: true,
            weight: [0.2, 0.3, 0.5][index],
            detectionRate: 1,
            falsePositiveRate: 0,
            score: 1,
          }]),
        ),
      },
    ]);

    const comparison = compareAttemptSets(skillSummary, baselineSummary);

    expect(comparison.detectionDelta).toBeGreaterThan(0);
    expect(comparison.falsePositiveDelta).toBeLessThan(0);
    expect(comparison.wins).toBe(2);
    expect(comparison.dimensions.route.scoreDelta).toBeGreaterThan(0);
  });

  it("plans compare mode as paired baseline and skill attempts", () => {
    const plan = buildScenarioPlan(
      {
        prompt: "Audit the codebase",
      },
      { mode: "compare", runs: 3 },
    );

    expect(plan.attemptsPerScenario).toBe(6);
    expect(plan.baselineEnabled).toBe(true);
    expect(plan.skillEnabled).toBe(true);
    expect(plan.scoring.weights).toEqual({
      route: 0.2,
      process: 0.3,
      outcome: 0.5,
    });
  });
});
