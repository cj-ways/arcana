import { describe, expect, it } from "vitest";
import { getSkillCatalog } from "../src/utils/catalog.js";
import {
  listTriggerBoundarySuites,
  readTriggerBoundarySuite,
  validateTriggerBoundarySuite,
} from "../src/utils/trigger-boundaries.js";
import { validateBoundarySuiteAgainstCatalog } from "../evals/run-trigger-boundary.js";

describe("trigger boundary suites", () => {
  const suiteNames = listTriggerBoundarySuites();

  it("includes feature-taxonomy coverage", () => {
    expect(suiteNames).toContain("feature-taxonomy");
  });

  it("keeps every stored boundary suite valid and catalog-safe", () => {
    const catalogNames = getSkillCatalog().map((skill) => skill.name);

    for (const suiteName of suiteNames) {
      const suite = readTriggerBoundarySuite(suiteName);
      expect(
        validateTriggerBoundarySuite(suite),
        `Boundary suite '${suiteName}' is invalid`,
      ).toEqual([]);
      expect(
        validateBoundarySuiteAgainstCatalog(suite, catalogNames),
        `Boundary suite '${suiteName}' references unknown skills`,
      ).toEqual([]);
    }
  });

  it("keeps feature-taxonomy focused on audit, design, and pressure-test separation", () => {
    const suite = readTriggerBoundarySuite("feature-taxonomy");

    expect(suite.topics.length).toBeGreaterThanOrEqual(2);

    for (const topic of suite.topics) {
      expect(topic.cases).toHaveLength(3);
      expect(
        topic.cases.map((caseEntry) => caseEntry.expectedSkills[0]).sort(),
      ).toEqual(["feature-audit", "feature-design", "pressure-test"]);
    }
  });

  it("rejects duplicate prompts, placeholder text, and invalid topic sets", () => {
    const errors = validateTriggerBoundarySuite({
      name: "bad-suite",
      description: "TODO: replace boundary description",
      topics: [
        {
          id: "topic-a",
          set: "staging",
          description: "Valid topic description",
          cases: [
            {
              id: "route-audit",
              prompt: "Same prompt",
              reason: "Valid reason",
              expectedSkills: ["feature-audit"],
            },
            {
              id: "route-design",
              prompt: "Same prompt",
              reason: "Replace this reason",
              expectedSkills: ["feature-design"],
            },
          ],
        },
      ],
    });

    expect(errors).toContain("description still contains placeholder text");
    expect(errors).toContain("topics[0].set must be one of: train, validation");
    expect(errors).toContain("topics[0].cases[1].prompt must be unique within the suite");
    expect(errors).toContain("topics[0].cases[1].reason still contains placeholder text");
  });
});
