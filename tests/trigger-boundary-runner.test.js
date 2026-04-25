import { describe, expect, it } from "vitest";
import {
  buildBoundaryPlan,
  gradeBoundaryAttempt,
  summarizeBoundaryCaseAttempts,
  summarizeBoundaryReport,
  validateBoundarySuiteAgainstCatalog,
} from "../evals/run-trigger-boundary.js";

describe("trigger boundary runner helpers", () => {
  const suite = {
    name: "feature-taxonomy",
    description: "Cross-skill taxonomy routing checks",
    topics: [
      {
        id: "invite-approvals",
        set: "train",
        description: "Invite approval topic",
        cases: [
          {
            id: "audit-current-state",
            prompt: "Audit the current invite approval flow",
            reason: "Current-state diagnosis",
            expectedSkills: ["feature-audit"],
            allowAdditionalSkills: false,
          },
          {
            id: "design-future-state",
            prompt: "Design the invite approval flow before implementation",
            reason: "Future-state design",
            expectedSkills: ["feature-design"],
            allowAdditionalSkills: false,
          },
        ],
      },
      {
        id: "subscription-cancellation",
        set: "validation",
        description: "Cancellation topic",
        cases: [
          {
            id: "challenge-proposal",
            prompt: "Pressure-test this cancellation proposal",
            reason: "Challenge one proposal",
            expectedSkills: ["pressure-test"],
            allowAdditionalSkills: false,
          },
        ],
      },
    ],
  };

  it("validates referenced skills against the catalog", () => {
    const issues = validateBoundarySuiteAgainstCatalog(suite, [
      "feature-audit",
      "feature-design",
      "pressure-test",
    ]);

    expect(issues).toEqual([]);
  });

  it("rejects unknown skills referenced by a boundary suite", () => {
    const issues = validateBoundarySuiteAgainstCatalog(
      {
        ...suite,
        topics: [
          {
            ...suite.topics[0],
            cases: [
              {
                ...suite.topics[0].cases[0],
                forbiddenSkills: ["missing-skill"],
              },
              ...suite.topics[0].cases.slice(1),
            ],
          },
          suite.topics[1],
        ],
      },
      ["feature-audit", "feature-design", "pressure-test"],
    );

    expect(issues).toContain(
      "topic 'invite-approvals' case 'audit-current-state' references unknown skill 'missing-skill' in forbiddenSkills",
    );
  });

  it("builds a filtered boundary plan by set and topic", () => {
    const trainPlan = buildBoundaryPlan(suite, { setFilter: "train" });
    const topicPlan = buildBoundaryPlan(suite, { topicFilter: "subscription-cancellation" });

    expect(trainPlan).toHaveLength(2);
    expect(trainPlan.every((entry) => entry.topic.set === "train")).toBe(true);
    expect(topicPlan).toHaveLength(1);
    expect(topicPlan[0].topic.id).toBe("subscription-cancellation");
  });

  it("grades an exact boundary route as a pass", () => {
    const result = gradeBoundaryAttempt({
      topic: suite.topics[0],
      caseEntry: suite.topics[0].cases[0],
      response: {
        selectedSkills: ["feature-audit"],
        unknownSkills: [],
        reasoning: "Current-state audit",
        closestAlternatives: ["feature-design"],
        confidence: 0.88,
      },
    });

    expect(result.pass).toBe(true);
    expect(result.missingExpected).toEqual([]);
    expect(result.unexpectedSelected).toEqual([]);
  });

  it("fails when the router selects extra skills on an exact boundary route", () => {
    const result = gradeBoundaryAttempt({
      topic: suite.topics[0],
      caseEntry: suite.topics[0].cases[1],
      response: {
        selectedSkills: ["feature-design", "feature-audit"],
        unknownSkills: [],
        reasoning: "Too broad",
        closestAlternatives: [],
        confidence: 0.42,
      },
    });

    expect(result.pass).toBe(false);
    expect(result.unexpectedSelected).toEqual(["feature-audit"]);
  });

  it("summarizes per-case attempts", () => {
    const summary = summarizeBoundaryCaseAttempts([
      {
        pass: true,
        error: null,
        selectedSkills: ["feature-audit"],
      },
      {
        pass: false,
        error: null,
        selectedSkills: ["feature-design"],
      },
      {
        pass: false,
        error: "router failed",
        selectedSkills: [],
      },
    ]);

    expect(summary.successfulRuns).toBe(2);
    expect(summary.erroredRuns).toBe(1);
    expect(summary.passRate).toBe(0.5);
    expect(summary.selectionFrequency).toEqual({
      "feature-audit": 1,
      "feature-design": 1,
    });
  });

  it("summarizes a boundary report by set and topic", () => {
    const summary = summarizeBoundaryReport({
      topics: suite.topics,
      cases: [
        {
          topic: suite.topics[0],
          caseEntry: suite.topics[0].cases[0],
          summary: {
            successfulRuns: 2,
            passCount: 2,
          },
        },
        {
          topic: suite.topics[0],
          caseEntry: suite.topics[0].cases[1],
          summary: {
            successfulRuns: 2,
            passCount: 1,
          },
        },
        {
          topic: suite.topics[1],
          caseEntry: suite.topics[1].cases[0],
          summary: {
            successfulRuns: 2,
            passCount: 1,
          },
        },
      ],
    });

    expect(summary.overall.passRate).toBe(2 / 3);
    expect(summary.bySet.train.passRate).toBe(0.75);
    expect(summary.bySet.validation.passRate).toBe(0.5);
    expect(summary.byTopic["invite-approvals"].passRate).toBe(0.75);
    expect(summary.byTopic["subscription-cancellation"].passRate).toBe(0.5);
  });
});
