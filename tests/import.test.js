import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import { spawnSync } from "child_process";

const TMP = join(import.meta.dirname, ".tmp-test-import");
const BIN = join(import.meta.dirname, "..", "bin", "arcana.js");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

function run(args) {
  const result = spawnSync(`"${process.execPath}" "${BIN}" ${args}`, {
    shell: true,
    encoding: "utf-8",
    timeout: 15000,
    cwd: TMP,
    stdio: "pipe",
  });
  return (result.stdout || "") + (result.stderr || "");
}

describe("arcana import (local)", () => {
  it("shows usage with no arguments", () => {
    const output = run("import");
    expect(output).toContain("Usage:");
    expect(output).toContain("arcana import");
  });

  it("imports from a local path", () => {
    // Create a local skill to import
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill\n\nDoes things.");

    const output = run(`import ./my-skill --scope project`);
    expect(output).toContain("Imported to");
    expect(output).toContain("my-skill");

    const skillDir = join(TMP, ".claude", "skills", "my-skill");
    expect(fsExtra.existsSync(join(skillDir, ".arcana-import.json"))).toBe(true);
    expect(fsExtra.existsSync(join(skillDir, ".arcana-import.raw.md"))).toBe(true);
    const content = fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Imported by Arcana from: file:");
  });

  it("prevents overwriting without --force (local)", () => {
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill");

    run("import ./my-skill --scope project");
    const output = run("import ./my-skill --scope project");
    expect(output).toContain("already exists");
  });

  it("allows overwriting with --force (local)", () => {
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill");

    run("import ./my-skill --scope project");
    const output = run("import ./my-skill --scope project --force");
    expect(output).toContain("Imported to");
  });

  it("supports review mode without writing files", () => {
    const localSkill = join(TMP, "review-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: review-skill\ndescription: 'Test skill'\n---\n# Review Skill");

    const output = run("import ./review-skill --scope project --review");
    expect(output).toContain("Import Review");
    expect(output).toContain("Risk:");
    expect(output).toContain("Review complete. No files were written.");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "review-skill"))).toBe(false);
  });

  it("shows troubleshooting details with --verbose", () => {
    const localSkill = join(TMP, "verbose-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: verbose-skill\ndescription: 'Verbose skill'\n---\n# Verbose Skill");

    const output = run("import ./verbose-skill --scope project --verbose");
    expect(output).toContain("[debug] resolved source");
    expect(output).toContain("[debug] resolved local path");
    expect(output).toContain("[debug] target skills dir");
    expect(output).toContain("[debug] overwrite risk");
  });

  it("shows overwrite review for existing imported skills", () => {
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill\n\nv1");

    run("import ./my-skill --scope project");

    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill\n\nv2");
    const output = run("import ./my-skill --scope project --review");
    expect(output).toContain("Overwrite Review");
    expect(output).toContain("Risk:");
    expect(output).toContain("Review complete. No files were written.");
  });

  it("reports provenance for imported skills via info, doctor, and update", () => {
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill");

    run("import ./my-skill --scope project");

    const infoOutput = run("info my-skill");
    expect(infoOutput).toContain("Type:");
    expect(infoOutput).toContain("imported skill");
    expect(infoOutput).toContain("Provenance:");
    expect(infoOutput).toContain("file:");
    expect(infoOutput).toContain("Trust State:");
    expect(infoOutput).toContain("current");

    const doctorOutput = run("doctor --scope project");
    expect(doctorOutput).toContain("Imported Skills");
    expect(doctorOutput).toContain("my-skill");

    const updateOutput = run("update --scope project");
    expect(updateOutput).toContain("Imported skills are not updated by package refresh");
    expect(updateOutput).toContain("my-skill");
    expect(updateOutput).toContain("Review before overwrite:");
  });

  it("emits imported skill trust data in JSON surfaces", () => {
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill");

    run("import ./my-skill --scope project");

    const listReport = JSON.parse(run("list --scope project --json"));
    expect(listReport.importedSkills).toHaveLength(1);
    expect(listReport.importedSkills[0]).toMatchObject({
      name: "my-skill",
      trustState: "current",
    });

    const infoReport = JSON.parse(run("info my-skill --json"));
    expect(infoReport.type).toBe("imported skill");
    expect(infoReport.provenance).toContain("file:");
    expect(infoReport.trustState).toBe("current");
    expect(infoReport.rawSnapshotPath).toContain(".arcana-import.raw.md");
    expect(infoReport.adaptation).toMatchObject({
      status: "unchanged",
    });

    const doctorReport = JSON.parse(run("doctor --scope project --json"));
    expect(doctorReport.importedSkills).toHaveLength(1);
    expect(doctorReport.importedSkills[0]).toMatchObject({
      name: "my-skill",
      trustState: "current",
      status: "pass",
    });
    expect(doctorReport.importedSkills[0].rawSnapshotPath).toContain(
      ".arcana-import.raw.md",
    );
    expect(doctorReport.importedSkills[0].adaptation).toMatchObject({
      status: "unchanged",
    });
  });

  it("reports adaptation improvement after an imported skill is cleaned up locally", () => {
    const localSkill = join(TMP, "legacy-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(
      join(localSkill, "SKILL.md"),
      [
        "---",
        "name: legacy-skill",
        'description: "You can use this skill when you need a review."',
        "---",
        "",
        "# Legacy Skill",
        "",
        "I can help with quick review.",
      ].join("\n"),
    );

    run("import ./legacy-skill --scope project");

    const installedPath = join(
      TMP,
      ".claude",
      "skills",
      "legacy-skill",
      "SKILL.md",
    );
    fsExtra.writeFileSync(
      installedPath,
      [
        "---",
        "name: legacy-skill",
        'description: "Reviews a code change quickly, then reports concrete next steps."',
        "allowed-tools: Read, Grep, Glob",
        "effort: medium",
        "disable-model-invocation: true",
        "---",
        "",
        "# Legacy Skill",
        "",
        "## Gotchas",
        "",
        "1. Avoid speculative findings.",
        "",
        "## Steps",
        "",
        "1. Read the target files.",
        "",
        "## Validation",
        "",
        "Validate each finding before reporting it.",
      ].join("\n"),
    );

    const infoReport = JSON.parse(run("info legacy-skill --json"));
    expect(infoReport.adaptation.status).toBe("improved");
    expect(infoReport.adaptation.scoreDelta).toBeGreaterThan(0);
    expect(infoReport.adaptation.improvedAreas).toContain("frontmatter");
    expect(infoReport.adaptation.improvedAreas).toContain("structure");
  });

  it("suggests the next action when the local path does not contain SKILL.md", () => {
    const missingSkill = join(TMP, "not-a-skill");
    fsExtra.ensureDirSync(missingSkill);

    const output = run("import ./not-a-skill --scope project");
    expect(output).toContain("No SKILL.md found at:");
    expect(output).toContain("Point Arcana at a directory that contains `SKILL.md`");
  });
});

describe.skipIf(process.env.SKIP_NETWORK_TESTS)("arcana import (network)", () => {
  it("lists skills in a GitHub repo", () => {
    const output = run("import openai/skills");
    expect(output).toContain("Found");
    expect(output).toContain("skills in openai/skills");
  });

  it("imports a skill from GitHub by owner/repo skill-name", () => {
    const output = run("import openai/skills .curated/gh-address-comments --scope project");
    expect(output).toContain("Imported to");
    expect(output).toContain("gh-address-comments");

    const skillDir = join(TMP, ".claude", "skills", "gh-address-comments");
    expect(fsExtra.existsSync(join(skillDir, "SKILL.md"))).toBe(true);

    const content = fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Imported by Arcana from:");
    expect(content).toContain("name: gh-address-comments");
  });

  it("imports from a full GitHub tree URL", () => {
    const output = run("import https://github.com/openai/skills/tree/main/skills/.curated/gh-address-comments --scope project");
    expect(output).toContain("Imported to");

    const skillDir = join(TMP, ".claude", "skills", "gh-address-comments");
    expect(fsExtra.existsSync(join(skillDir, "SKILL.md"))).toBe(true);
  });

  it("shows error for nonexistent skill in repo", () => {
    const output = run("import openai/skills nonexistent-skill-xyz");
    expect(output).toContain("not found");
  });
});
