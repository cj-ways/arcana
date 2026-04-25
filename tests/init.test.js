import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import inquirer from "inquirer";
import { copyRules, hasArcanaSkills, runInit } from "../src/commands/init.js";
import { getPackageRulesDir } from "../src/utils/paths.js";

const TMP = join(import.meta.dirname, ".tmp-test-init");
const ORIGINAL_CWD = process.cwd();

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
  process.chdir(TMP);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.chdir(ORIGINAL_CWD);
  fsExtra.removeSync(TMP);
});

describe("copyRules", () => {
  it("copies Arcana rules into the target directory", () => {
    const targetDir = join(TMP, ".claude", "rules");
    const results = copyRules(targetDir);

    expect(results.every((r) => r.status === "installed")).toBe(true);
    expect(fsExtra.existsSync(join(targetDir, "arcana-methodology.md"))).toBe(true);
    expect(fsExtra.existsSync(join(targetDir, "arcana-quality.md"))).toBe(true);
    expect(fsExtra.existsSync(join(targetDir, "arcana-research.md"))).toBe(true);
  });

  it("preserves user-modified Arcana rule files as conflicts", () => {
    const targetDir = join(TMP, ".claude", "rules");
    fsExtra.ensureDirSync(targetDir);
    fsExtra.writeFileSync(join(targetDir, "arcana-methodology.md"), "CUSTOM RULE");

    const results = copyRules(targetDir);
    const methodology = results.find((r) => r.name === "arcana-methodology.md");

    expect(methodology).toEqual({ name: "arcana-methodology.md", status: "conflict" });
    expect(fsExtra.readFileSync(join(targetDir, "arcana-methodology.md"), "utf-8")).toBe("CUSTOM RULE");
  });

  it("does not conflict when the destination already matches Arcana", () => {
    const targetDir = join(TMP, ".claude", "rules");
    fsExtra.ensureDirSync(targetDir);

    const source = fsExtra.readFileSync(join(getPackageRulesDir(), "arcana-quality.md"), "utf-8");
    fsExtra.writeFileSync(join(targetDir, "arcana-quality.md"), source);

    const results = copyRules(targetDir);
    const quality = results.find((r) => r.name === "arcana-quality.md");
    expect(quality?.status).toBe("installed");
  });

  it("supports dry-run without writing rule files", () => {
    const targetDir = join(TMP, ".claude", "rules");
    const results = copyRules(targetDir, { dryRun: true });

    expect(results.every((r) => r.status === "installed")).toBe(true);
    expect(fsExtra.existsSync(targetDir)).toBe(false);
  });
});

describe("hasArcanaSkills", () => {
  it("returns false for custom skills without Arcana ownership markers", () => {
    const skillsDir = join(TMP, ".claude", "skills", "custom-skill");
    fsExtra.ensureDirSync(skillsDir);
    fsExtra.writeFileSync(join(skillsDir, "SKILL.md"), "---\nname: custom-skill\n---\n# Custom");

    expect(hasArcanaSkills(TMP)).toBe(false);
  });

  it("returns true when an Arcana-managed skill is present", () => {
    const skillsDir = join(TMP, ".claude", "skills", "quick-review");
    fsExtra.ensureDirSync(skillsDir);
    const content = fsExtra.readFileSync(
      join(import.meta.dirname, "..", "skills", "quick-review", "SKILL.md"),
      "utf-8"
    );
    fsExtra.writeFileSync(join(skillsDir, "SKILL.md"), `<!-- arcana-managed -->\n${content}`);

    expect(hasArcanaSkills(TMP)).toBe(true);
  });
});

describe("runInit --dry-run", () => {
  it("walks setup prompts without writing files", async () => {
    vi.spyOn(inquirer, "prompt")
      .mockResolvedValueOnce({ scope: "project" })
      .mockResolvedValueOnce({ agent: "claude" })
      .mockResolvedValueOnce({ selectionMode: "all" })
      .mockResolvedValueOnce({ installRules: true });

    await runInit({ dryRun: true });

    expect(fsExtra.existsSync(join(TMP, ".claude", "skills"))).toBe(false);
    expect(fsExtra.existsSync(join(TMP, ".claude", "agents"))).toBe(false);
    expect(fsExtra.existsSync(join(TMP, ".claude", "rules"))).toBe(false);
    expect(fsExtra.existsSync(join(TMP, "AGENTS.md"))).toBe(false);
  });
});
