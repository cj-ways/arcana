import { describe, expect, it } from "vitest";
import {
  buildRouterPrompt,
  buildTriggerPlan,
  gradeTriggerAttempt,
  parseRouterResponse,
  summarizeQueryAttempts,
  summarizeTriggerReport,
  validateTriggerPackAgainstCatalog,
} from "../evals/run-trigger-eval.js";

describe("trigger runner helpers", () => {
  function buildEntries(collectionName, expectedSkills) {
    return Array.from({ length: 10 }, (_, index) => ({
      id: `${collectionName}-${index + 1}`,
      set: index < 6 ? "train" : "validation",
      prompt: `${collectionName} prompt ${index + 1}`,
      reason: `${collectionName} reason ${index + 1}`,
      expectedSkills,
      allowAdditionalSkills: false,
    }));
  }

  const catalogIndex = {
    skills: [
      { name: "pressure-test", description: "Stress-tests one proposal." },
      { name: "feature-audit", description: "Broad feature audit." },
      { name: "quick-review", description: "Fast code review." },
    ],
    skillByLowerName: new Map([
      ["pressure-test", "pressure-test"],
      ["feature-audit", "feature-audit"],
      ["quick-review", "quick-review"],
    ]),
  };

  const pack = {
    skill: "pressure-test",
    description: "Routing boundary",
    shouldTrigger: buildEntries("should-trigger", ["pressure-test"]),
    shouldNotTrigger: buildEntries("should-not-trigger", ["feature-audit"]),
  };

  it("validates referenced skills against the catalog", () => {
    const issues = validateTriggerPackAgainstCatalog(pack, [
      "pressure-test",
      "feature-audit",
      "quick-review",
    ]);

    expect(issues).toEqual([]);
  });

  it("rejects unknown expected skills in a trigger pack", () => {
    const issues = validateTriggerPackAgainstCatalog(
      {
        ...pack,
        shouldNotTrigger: [
          {
            ...pack.shouldNotTrigger[0],
            expectedSkills: ["missing-skill"],
          },
          ...pack.shouldNotTrigger.slice(1),
        ],
      },
      ["pressure-test", "feature-audit"],
    );

    expect(issues).toContain(
      "shouldNotTrigger query 'should-not-trigger-1' references unknown skill 'missing-skill' in expectedSkills",
    );
  });

  it("builds a filtered trigger plan by set and collection", () => {
    const plan = buildTriggerPlan(pack, {
      setFilter: "validation",
      collectionFilter: "shouldNotTrigger",
    });

    expect(plan).toHaveLength(4);
    expect(plan.every((entry) => entry.collectionName === "shouldNotTrigger")).toBe(true);
    expect(plan.every((entry) => entry.query.set === "validation")).toBe(true);
  });

  it("builds a router prompt from the skill catalog", () => {
    const prompt = buildRouterPrompt("Pressure-test this memo", catalogIndex.skills);

    expect(prompt).toContain("Available Arcana skills:");
    expect(prompt).toContain("- pressure-test: Stress-tests one proposal.");
    expect(prompt).toContain("User request:");
    expect(prompt).toContain("Pressure-test this memo");
  });

  it("parses direct JSON router output", () => {
    const response = parseRouterResponse(
      JSON.stringify({
        selectedSkills: ["Pressure-Test", "unknown-skill"],
        reasoning: "Specific proposal stress test",
        closestAlternatives: ["feature-audit"],
        confidence: 0.82,
      }),
      catalogIndex,
    );

    expect(response.selectedSkills).toEqual(["pressure-test"]);
    expect(response.unknownSkills).toEqual(["unknown-skill"]);
    expect(response.closestAlternatives).toEqual(["feature-audit"]);
    expect(response.confidence).toBe(0.82);
  });

  it("parses a JSON object embedded in surrounding text", () => {
    const response = parseRouterResponse(
      "Here is the result:\n{\"selectedSkills\":[\"feature-audit\"],\"reasoning\":\"broad audit\"}",
      catalogIndex,
    );

    expect(response.selectedSkills).toEqual(["feature-audit"]);
    expect(response.reasoning).toBe("broad audit");
  });

  it("grades exact-match should-trigger routing", () => {
    const result = gradeTriggerAttempt({
      pack,
      collectionName: "shouldTrigger",
      query: pack.shouldTrigger[0],
      response: {
        selectedSkills: ["pressure-test"],
        unknownSkills: [],
        reasoning: "Direct match",
        closestAlternatives: [],
        confidence: 0.9,
      },
    });

    expect(result.pass).toBe(true);
    expect(result.targetSkillSelected).toBe(true);
    expect(result.unexpectedSelected).toEqual([]);
  });

  it("fails when extra skills are selected on an exact route", () => {
    const result = gradeTriggerAttempt({
      pack,
      collectionName: "shouldTrigger",
      query: pack.shouldTrigger[0],
      response: {
        selectedSkills: ["pressure-test", "feature-audit"],
        unknownSkills: [],
        reasoning: "Too broad",
        closestAlternatives: [],
        confidence: 0.4,
      },
    });

    expect(result.pass).toBe(false);
    expect(result.unexpectedSelected).toEqual(["feature-audit"]);
  });

  it("summarizes query attempts and target selection rate", () => {
    const summary = summarizeQueryAttempts(
      [
        {
          pass: true,
          error: null,
          selectedSkills: ["pressure-test"],
        },
        {
          pass: false,
          error: null,
          selectedSkills: ["feature-audit"],
        },
        {
          pass: false,
          error: "router failed",
          selectedSkills: [],
        },
      ],
      "pressure-test",
    );

    expect(summary.successfulRuns).toBe(2);
    expect(summary.erroredRuns).toBe(1);
    expect(summary.passRate).toBe(0.5);
    expect(summary.targetSkillSelectionRate).toBe(0.5);
    expect(summary.selectionFrequency).toEqual({
      "pressure-test": 1,
      "feature-audit": 1,
    });
  });

  it("summarizes a trigger report by collection and set", () => {
    const summary = summarizeTriggerReport({
      skill: "pressure-test",
      queries: [
        {
          collectionName: "shouldTrigger",
          query: { set: "train" },
          summary: {
            successfulRuns: 2,
            passCount: 2,
            targetSkillSelectionRate: 1,
          },
        },
        {
          collectionName: "shouldNotTrigger",
          query: { set: "validation" },
          summary: {
            successfulRuns: 2,
            passCount: 1,
            targetSkillSelectionRate: 0.5,
          },
        },
      ],
    });

    expect(summary.overall.passRate).toBe(0.75);
    expect(summary.byCollection.shouldTrigger.passRate).toBe(1);
    expect(summary.byCollection.shouldNotTrigger.targetSkillSelectionRate).toBe(0.5);
    expect(summary.bySet.train.passRate).toBe(1);
    expect(summary.bySet.validation.passRate).toBe(0.5);
  });
});
