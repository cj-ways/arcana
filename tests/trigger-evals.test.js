import { describe, expect, it } from "vitest";
import { getSkillCatalog } from "../src/utils/catalog.js";
import {
  listTriggerEvalSkills,
  readTriggerEvalPack,
  validateTriggerEvalPack,
} from "../src/utils/trigger-evals.js";
import { validateTriggerPackAgainstCatalog } from "../evals/run-trigger-eval.js";

describe("trigger eval packs", () => {
  const skillNames = listTriggerEvalSkills();

  it("includes pressure-test trigger coverage", () => {
    expect(skillNames).toContain("pressure-test");
  });

  it("gives every shipped first-party skill a trigger pack", () => {
    const coveredSkills = new Set(skillNames);

    for (const skill of getSkillCatalog()) {
      expect(
        coveredSkills.has(skill.name),
        `Missing trigger pack for skill '${skill.name}'`,
      ).toBe(true);
    }
  });

  it("keeps every stored trigger pack valid and non-placeholder", () => {
    const catalogNames = getSkillCatalog().map((skill) => skill.name);

    for (const skillName of skillNames) {
      const pack = readTriggerEvalPack(skillName);
      expect(
        validateTriggerEvalPack(pack),
        `Trigger pack for '${skillName}' is invalid`,
      ).toEqual([]);
      expect(
        validateTriggerPackAgainstCatalog(pack, catalogNames),
        `Trigger pack for '${skillName}' references unknown skills`,
      ).toEqual([]);
    }
  });
});
