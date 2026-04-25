import { readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  FEEDBACK_PROFILES,
  SKILL_PHASE_ORDER,
  getCatalogStats,
  getRuleCatalog,
  getSkillCatalog,
  getUtilitySkillCatalog,
  getUtilityModuleCatalog,
  getWorkflowSkillCatalog,
  normalizeSkillPhase,
  summarizeDescription,
} from "../src/utils/catalog.js";
import { getPackageRoot } from "../src/utils/paths.js";

describe("skill catalog metadata", () => {
  it("requires phase, feedback profile, and catalog order on built-in skills", () => {
    for (const skill of getSkillCatalog()) {
      expect(SKILL_PHASE_ORDER).toContain(skill.phase);
      expect(FEEDBACK_PROFILES).toContain(skill.feedbackProfile);
      expect(Number.isFinite(skill.catalogOrder)).toBe(true);
      expect(skill.catalogOrder).toBeLessThan(Number.MAX_SAFE_INTEGER);
    }
  });

  it("splits workflow and utility skills without overlap", () => {
    const workflow = getWorkflowSkillCatalog().map((skill) => skill.name);
    const utility = getUtilitySkillCatalog().map((skill) => skill.name);

    expect(workflow.length + utility.length).toBe(getSkillCatalog().length);
    expect(workflow.some((name) => utility.includes(name))).toBe(false);
  });

  it("uses catalog order as the display order source of truth", () => {
    const orders = getSkillCatalog().map((skill) => skill.catalogOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("catalog summaries", () => {
  it("strips routing-only guidance from generated summaries", () => {
    const summary = summarizeDescription(
      "Creates a pull request. Use when the user says create a PR. Manual via /create-pr.",
    );
    expect(summary).toBe("Creates a pull request.");
  });
});

describe("phase normalization", () => {
  it("maps legacy phase names onto the canonical taxonomy", () => {
    expect(normalizeSkillPhase("ideate")).toBe("plan");
    expect(normalizeSkillPhase("validate")).toBe("analyze");
    expect(normalizeSkillPhase("debug")).toBe("fix");
    expect(normalizeSkillPhase("ship")).toBe("release");
    expect(normalizeSkillPhase("toolkit")).toBe("utility");
  });
});

describe("catalog stats", () => {
  it("reports non-zero counts for shipped inventory", () => {
    const stats = getCatalogStats();
    expect(stats.skillCount).toBeGreaterThan(0);
    expect(stats.agentCount).toBeGreaterThan(0);
    expect(stats.ruleCount).toBeGreaterThan(0);
    expect(stats.publicCommandCount).toBeGreaterThan(0);
  });
});

describe("utility module catalog", () => {
  it("covers every shipped utility module exactly once", () => {
    const catalogNames = getUtilityModuleCatalog()
      .map((module) => module.name)
      .sort();
    const actualNames = readdirSync(join(getPackageRoot(), "src", "utils"))
      .filter((name) => name.endsWith(".js"))
      .sort();

    expect(catalogNames).toEqual(actualNames);
  });
});

describe("rule catalog", () => {
  it("covers every shipped rule file", () => {
    const stats = getCatalogStats();
    expect(getRuleCatalog().length).toBe(stats.ruleCount);
  });
});
