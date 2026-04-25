import { describe, expect, it } from "vitest";
import {
  buildSkillScaffoldPlan,
  formatSkillTitle,
  getDefaultEvalArtifactPath,
  getDefaultEvalScenarioName,
  getDefaultTriggerEvalPath,
  getDefaultFeedbackProfile,
  getSuggestedCatalogOrder,
  renderEvalManifestTemplate,
  renderTriggerEvalTemplate,
  renderSkillTemplate,
  slugifySkillName,
} from "../src/utils/skill-scaffold.js";
import { validateScenario } from "../evals/run-eval.js";

describe("skill scaffold helpers", () => {
  it("slugifies arbitrary skill names into lowercase kebab-case", () => {
    expect(slugifySkillName("Dependency Prune")).toBe("dependency-prune");
    expect(slugifySkillName("dependency_prune!")).toBe("dependency-prune");
  });

  it("formats skill titles from kebab-case names", () => {
    expect(formatSkillTitle("dependency-prune")).toBe("Dependency Prune");
  });

  it("derives default feedback profiles from workflow phase", () => {
    expect(getDefaultFeedbackProfile("review")).toBe("diagnostic");
    expect(getDefaultFeedbackProfile("fix")).toBe("execution");
    expect(getDefaultFeedbackProfile("design")).toBe("advisory");
  });

  it("suggests the next catalog order within an occupied phase", () => {
    const order = getSuggestedCatalogOrder(
      [
        { phase: "review", catalogOrder: 70 },
        { phase: "review", catalogOrder: 80 },
      ],
      "review",
    );

    expect(order).toBe(90);
  });

  it("inserts an empty phase between neighboring phase ranges", () => {
    const order = getSuggestedCatalogOrder(
      [
        { phase: "plan", catalogOrder: 10 },
        { phase: "design", catalogOrder: 30 },
      ],
      "analyze",
    );

    expect(order).toBeGreaterThan(10);
    expect(order).toBeLessThan(30);
  });

  it("renders a scaffold with required metadata and placeholders", () => {
    const content = renderSkillTemplate({
      name: "dependency-prune",
      phase: "refactor",
      feedbackProfile: "execution",
      catalogOrder: 65,
    });

    expect(content).toContain("name: dependency-prune");
    expect(content).toContain("phase: refactor");
    expect(content).toContain("feedback-profile: execution");
    expect(content).toContain("catalog-order: 65");
    expect(content).toContain("# Dependency Prune");
    expect(content).toContain("TODO:");
  });

  it("derives a default primary eval scenario name from the skill name", () => {
    expect(getDefaultEvalScenarioName("dependency-prune")).toBe("dependency-prune-primary");
  });

  it("derives a default eval artifact path from the skill name", () => {
    expect(getDefaultEvalArtifactPath("dependency-prune")).toBe("artifacts/dependency-prune-report.md");
  });

  it("derives a default trigger eval path from the skill name", () => {
    expect(getDefaultTriggerEvalPath("dependency-prune")).toBe("evals/triggers/dependency-prune.json");
  });

  it("renders a valid eval manifest scaffold", () => {
    const manifest = JSON.parse(renderEvalManifestTemplate({
      name: "dependency-prune",
      phase: "refactor",
    }));

    expect(validateScenario(manifest)).toEqual([]);
    expect(manifest.name).toBe("dependency-prune-primary");
    expect(manifest.skill).toBe("dependency-prune");
    expect(manifest.scoring.weights).toEqual({
      route: 0.2,
      process: 0.3,
      outcome: 0.5,
    });
    expect(manifest.expected).toHaveLength(3);
    expect(manifest.falsePositives).toHaveLength(1);
    expect(manifest.prompt).toContain("TODO:");
    expect(manifest.expected.map((assertion) => assertion.dimension)).toEqual([
      "route",
      "process",
      "outcome",
    ]);
    expect(manifest.expected[0]).toMatchObject({
      type: "file-created",
      file: "artifacts/dependency-prune-report.md",
    });
    expect(manifest.expected[1]).toMatchObject({
      type: "file-contains",
      file: "artifacts/dependency-prune-report.md",
    });
    expect(manifest.expected[2]).toMatchObject({
      type: "file-contains",
      file: "artifacts/dependency-prune-report.md",
    });
    expect(manifest.falsePositives[0]).toMatchObject({
      type: "file-contains",
      file: "artifacts/dependency-prune-report.md",
    });
  });

  it("renders a valid trigger eval scaffold", () => {
    const pack = JSON.parse(renderTriggerEvalTemplate({
      name: "dependency-prune",
    }));

    expect(pack.skill).toBe("dependency-prune");
    expect(pack.shouldTrigger).toHaveLength(10);
    expect(pack.shouldNotTrigger).toHaveLength(10);
    expect(pack.shouldTrigger.slice(0, 6).every((entry) => entry.set === "train")).toBe(true);
    expect(pack.shouldTrigger.slice(6).every((entry) => entry.set === "validation")).toBe(true);
    expect(pack.shouldNotTrigger.slice(0, 6).every((entry) => entry.set === "train")).toBe(true);
    expect(pack.shouldNotTrigger.slice(6).every((entry) => entry.set === "validation")).toBe(true);
    expect(pack.description).toContain("TODO:");
    expect(pack.shouldTrigger[0].prompt).toContain("TODO:");
    expect(pack.shouldNotTrigger[0].reason).toContain("TODO:");
  });

  it("builds a combined skill and eval file plan", () => {
    const plan = buildSkillScaffoldPlan({
      skills: [{ phase: "refactor", catalogOrder: 60 }],
      name: "dependency-prune",
      phase: "refactor",
      feedbackProfile: "execution",
      catalogOrder: 70,
    });

    expect(plan.scenarioName).toBe("dependency-prune-primary");
    expect(plan.files.map((file) => file.path)).toEqual([
      "skills/dependency-prune/SKILL.md",
      "evals/scenarios/dependency-prune-primary/manifest.json",
      "evals/scenarios/dependency-prune-primary/README.md",
      "evals/scenarios/dependency-prune-primary/src/example.js",
      "evals/triggers/dependency-prune.json",
    ]);
    expect(plan.files[0].content).toContain("feedback-profile: execution");
    expect(plan.files[1].content).toContain("\"skill\": \"dependency-prune\"");
    expect(plan.files[2].content).toContain("Layer 2 eval scenario");
    expect(plan.files[3].content).toContain("smallest realistic code sample");
    expect(plan.files[4].content).toContain("\"skill\": \"dependency-prune\"");
  });
});
