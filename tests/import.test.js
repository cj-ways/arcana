import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import { execSync } from "child_process";

const TMP = join(import.meta.dirname, ".tmp-test-import");
const BIN = join(import.meta.dirname, "..", "bin", "arcana.js");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

function run(args) {
  try {
    return execSync(`node "${BIN}" ${args}`, {
      encoding: "utf-8",
      timeout: 15000,
      cwd: TMP,
    });
  } catch (err) {
    return err.stdout + err.stderr;
  }
}

describe("arcana import", () => {
  it("shows usage with no arguments", () => {
    const output = run("import");
    expect(output).toContain("Usage:");
    expect(output).toContain("arcana import");
  });

  it("lists skills in a GitHub repo", () => {
    const output = run("import anthropics/skills");
    expect(output).toContain("Found");
    expect(output).toContain("skills in anthropics/skills");
  });

  it("imports a skill from GitHub by owner/repo skill-name", () => {
    const output = run("import anthropics/skills claude-api --scope project");
    expect(output).toContain("Imported to");
    expect(output).toContain("claude-api");

    const skillDir = join(TMP, ".claude", "skills", "claude-api");
    expect(fsExtra.existsSync(join(skillDir, "SKILL.md"))).toBe(true);

    const content = fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Imported by Arcana from:");
    expect(content).toContain("name: claude-api");
  });

  it("imports from a full GitHub tree URL", () => {
    const output = run("import https://github.com/anthropics/skills/tree/main/skills/skill-creator --scope project");
    expect(output).toContain("Imported to");

    const skillDir = join(TMP, ".claude", "skills", "skill-creator");
    expect(fsExtra.existsSync(join(skillDir, "SKILL.md"))).toBe(true);
  });

  it("imports from a local path", () => {
    // Create a local skill to import
    const localSkill = join(TMP, "my-skill");
    fsExtra.ensureDirSync(localSkill);
    fsExtra.writeFileSync(join(localSkill, "SKILL.md"), "---\nname: my-skill\ndescription: 'Test skill'\n---\n# My Skill\n\nDoes things.");

    const output = run(`import ./my-skill --scope project`);
    expect(output).toContain("Imported to");
    expect(output).toContain("my-skill");
  });

  it("detects quality gaps", () => {
    const output = run("import anthropics/skills claude-api --scope project");
    expect(output).toContain("Quality gaps");
    expect(output).toContain("allowed-tools");
  });

  it("prevents overwriting without --force", () => {
    // Import once
    run("import anthropics/skills claude-api --scope project");
    // Import again should fail
    const output = run("import anthropics/skills claude-api --scope project");
    expect(output).toContain("already exists");
  });

  it("allows overwriting with --force", () => {
    run("import anthropics/skills claude-api --scope project");
    const output = run("import anthropics/skills claude-api --scope project --force");
    expect(output).toContain("Imported to");
  });

  it("shows error for nonexistent skill in repo", () => {
    const output = run("import anthropics/skills nonexistent-skill-xyz");
    expect(output).toContain("not found");
  });
});
