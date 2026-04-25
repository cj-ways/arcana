import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import { spawnSync } from "child_process";

const TMP = join(import.meta.dirname, ".tmp-test-sync");
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
  return {
    output: (result.stdout || "") + (result.stderr || ""),
    status: result.status ?? 1,
  };
}

describe("arcana sync", () => {
  it("exits non-zero when .agents/skills/ does not exist", () => {
    const { output, status } = run("sync");
    expect(status).not.toBe(0);
    expect(output).toContain("No .agents/skills/");
  });

  it("syncs canonical to .claude/skills/", () => {
    const canonical = join(TMP, ".agents", "skills", "test-skill");
    fsExtra.ensureDirSync(canonical);
    fsExtra.writeFileSync(join(canonical, "SKILL.md"), "---\nname: test-skill\n---\n# Test");
    fsExtra.ensureDirSync(join(TMP, ".claude"));

    const { output, status } = run("sync");
    expect(status).toBe(0);
    expect(output).toContain("Sync complete");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "test-skill", "SKILL.md"))).toBe(true);
  });

  it("creates .claude/skills/ even without .claude/ parent", () => {
    const canonical = join(TMP, ".agents", "skills", "test-skill");
    fsExtra.ensureDirSync(canonical);
    fsExtra.writeFileSync(join(canonical, "SKILL.md"), "---\nname: test-skill\n---\n# Test");

    const { output, status } = run("sync");
    expect(status).toBe(0);
    expect(output).toContain("Sync complete");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "test-skill", "SKILL.md"))).toBe(true);
  });
});

describe("arcana sync --clean", () => {
  it("removes stale arcana-managed skill from mirror", () => {
    const canonical = join(TMP, ".agents", "skills");
    fsExtra.ensureDirSync(join(canonical, "skill-a"));
    fsExtra.writeFileSync(join(canonical, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");

    const mirror = join(TMP, ".claude", "skills");
    fsExtra.ensureDirSync(join(mirror, "skill-a"));
    fsExtra.writeFileSync(join(mirror, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");
    fsExtra.ensureDirSync(join(mirror, "stale-skill"));
    fsExtra.writeFileSync(join(mirror, "stale-skill", "SKILL.md"), "---\nname: stale-skill\n---\n<!-- arcana-managed -->\n");

    const { output } = run("sync --clean");
    expect(output).toContain("Removed stale");
    expect(fsExtra.existsSync(join(mirror, "stale-skill"))).toBe(false);
    expect(fsExtra.existsSync(join(mirror, "skill-a"))).toBe(true);
  });

  it("preserves non-arcana-managed skill in mirror", () => {
    const canonical = join(TMP, ".agents", "skills");
    fsExtra.ensureDirSync(join(canonical, "skill-a"));
    fsExtra.writeFileSync(join(canonical, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");

    const mirror = join(TMP, ".claude", "skills");
    fsExtra.ensureDirSync(join(mirror, "skill-a"));
    fsExtra.writeFileSync(join(mirror, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");
    fsExtra.ensureDirSync(join(mirror, "user-skill"));
    fsExtra.writeFileSync(join(mirror, "user-skill", "SKILL.md"), "---\nname: user-skill\n---\n# Custom");

    run("sync --clean");
    expect(fsExtra.existsSync(join(mirror, "user-skill", "SKILL.md"))).toBe(true);
  });

  it("preserves directories without SKILL.md in mirror", () => {
    const canonical = join(TMP, ".agents", "skills");
    fsExtra.ensureDirSync(join(canonical, "skill-a"));
    fsExtra.writeFileSync(join(canonical, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");

    const mirror = join(TMP, ".claude", "skills");
    fsExtra.ensureDirSync(join(mirror, "skill-a"));
    fsExtra.writeFileSync(join(mirror, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");
    fsExtra.ensureDirSync(join(mirror, "my-tools"));
    fsExtra.writeFileSync(join(mirror, "my-tools", "README.md"), "# My tools");

    run("sync --clean");
    expect(fsExtra.existsSync(join(mirror, "my-tools", "README.md"))).toBe(true);
  });

  it("reports no stale skills when mirror is clean", () => {
    const canonical = join(TMP, ".agents", "skills");
    fsExtra.ensureDirSync(join(canonical, "skill-a"));
    fsExtra.writeFileSync(join(canonical, "skill-a", "SKILL.md"), "---\nname: skill-a\n---\n");
    fsExtra.ensureDirSync(join(TMP, ".claude"));

    const { output } = run("sync --clean");
    expect(output).toContain("No stale skills found");
  });
});
