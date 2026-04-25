import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import {
  analyzeImportedSkillQuality,
  compareImportedSkillAdaptation,
  inspectImportedSkillAdaptation,
} from "../src/utils/import-adaptation.js";
import {
  listImportAdaptationFixtures,
  buildFixtureImportAdaptationReport,
} from "../evals/run-import-adaptation.js";

const TMP = join(import.meta.dirname, ".tmp-test-import-adaptation");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

describe("import adaptation heuristics", () => {
  it("scores a cleaned-up adapted skill above the raw import", () => {
    const raw = [
      "---",
      "name: legacy-skill",
      'description: "You can use this skill when you need to review code fast."',
      "---",
      "",
      "# Legacy Skill",
      "",
      "I can help with quick review.",
    ].join("\n");

    const adapted = [
      "---",
      "name: legacy-skill",
      'description: "Reviews a code change quickly, then reports concrete issues and next steps."',
      "allowed-tools: Read, Grep, Glob",
      "effort: medium",
      "---",
      "",
      "# Legacy Skill",
      "",
      "## Gotchas",
      "",
      "1. Avoid speculative findings without evidence.",
      "",
      "## Steps",
      "",
      "1. Read the relevant files.",
      "",
      "## Validation",
      "",
      "Re-read each finding before reporting it.",
    ].join("\n");

    const comparison = compareImportedSkillAdaptation(raw, adapted, {
      expectedName: "legacy-skill",
    });

    expect(comparison.status).toBe("improved");
    expect(comparison.adaptedScore).toBeGreaterThan(comparison.rawScore);
    expect(comparison.improvedAreas).toContain("frontmatter");
    expect(comparison.improvedAreas).toContain("structure");
    expect(comparison.regressedAreas).toEqual([]);
  });

  it("inspects imported skills only when a raw snapshot is present", () => {
    const skillDir = join(TMP, "legacy-skill");
    fsExtra.ensureDirSync(skillDir);
    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: legacy-skill\ndescription: 'ok'\n---\n# Legacy Skill\n",
    );

    const unavailable = inspectImportedSkillAdaptation(skillDir);
    expect(unavailable.available).toBe(false);
    expect(unavailable.reason).toBe("raw-import-snapshot-missing");

    fsExtra.writeFileSync(
      join(skillDir, ".arcana-import.raw.md"),
      "---\nname: legacy-skill\ndescription: 'You should use this skill'\n---\n# Legacy Skill\n",
    );
    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: legacy-skill",
        'description: "Reviews a code change and reports concrete next steps."',
        "allowed-tools: Read, Grep",
        "---",
        "",
        "# Legacy Skill",
        "",
        "## Steps",
        "",
        "1. Read the task.",
        "",
        "## Validation",
        "",
        "Validate each finding before reporting it.",
      ].join("\n"),
    );

    const available = inspectImportedSkillAdaptation(skillDir);
    expect(available.available).toBe(true);
    expect(available.status).toBe("improved");
  });
});

describe("import adaptation fixture runner", () => {
  it("exposes shipped fixture pairs and reports improvement", () => {
    const fixtures = listImportAdaptationFixtures();
    expect(fixtures).toContain("legacy-skill");
    expect(fixtures).toContain("review-helper");

    const report = buildFixtureImportAdaptationReport("legacy-skill");
    expect(report.kind).toBe("fixture");
    expect(report.status).toBe("improved");
    expect(report.scoreDelta).toBeGreaterThan(0);
  });

  it("detects unsupported frontmatter fields in raw fixture quality", () => {
    const report = buildFixtureImportAdaptationReport("review-helper");
    const raw = analyzeImportedSkillQuality(
      fsExtra.readFileSync(
        join(
          import.meta.dirname,
          "..",
          "evals",
          "import-adaptation",
          "fixtures",
          "review-helper",
          "raw.md",
        ),
        "utf-8",
      ),
      { expectedName: "review-helper" },
    );

    expect(raw.unsupportedFields).toContain("foo");
    expect(report.status).toBe("improved");
  });
});
