import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import { execSync } from "child_process";

const TMP = join(import.meta.dirname, ".tmp-test-commands");
const BIN = join(import.meta.dirname, "..", "bin", "arcana.js");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

function run(args) {
  try {
    const output = execSync(`node "${BIN}" ${args}`, {
      encoding: "utf-8",
      timeout: 15000,
      cwd: TMP,
    });
    return { output, status: 0 };
  } catch (err) {
    return {
      output: (err.stdout || "") + (err.stderr || ""),
      status: err.status || 1,
    };
  }
}

describe("arcana add", () => {
  it("installs a skill to project scope", () => {
    const { output, status } = run("add deep-fix --scope project --agent claude");
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "deep-fix", "SKILL.md"))).toBe(true);
  });

  it("installs multiple skills", () => {
    const { output, status } = run("add deep-fix create-pr --scope project --agent claude");
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
    expect(output).toContain("✓ create-pr");
  });

  it("exits non-zero for unknown skill name", () => {
    const { output, status } = run("add nonexistent-xyz --scope project");
    expect(status).not.toBe(0);
    expect(output).toContain("Unknown skill");
  });

  it("exits non-zero with no arguments", () => {
    const { output, status } = run("add");
    expect(status).not.toBe(0);
    expect(output).toContain("Usage:");
  });

  it("installs all skills with --all", () => {
    const { output, status } = run("add --all --scope project --agent claude");
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
    expect(output).toContain("✓ deep-review");
    expect(output).toContain("agent");
  });

  it("detects conflict with existing non-arcana skill", () => {
    const customDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(join(customDir, "SKILL.md"), "---\nname: my-custom\n---\n# Custom");

    const { output } = run("add deep-fix --scope project --agent claude");
    expect(output).toContain("skipped");
  });

  it("--force overrides conflict", () => {
    const customDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(join(customDir, "SKILL.md"), "---\nname: my-custom\n---\n# Custom");

    const { output, status } = run("add deep-fix --scope project --agent claude --force");
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
  });
});

describe("arcana remove", () => {
  it("removes an installed skill", () => {
    run("add deep-fix --scope project --agent claude");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "deep-fix"))).toBe(true);

    const { output, status } = run("remove deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("Removed deep-fix");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "deep-fix"))).toBe(false);
  });

  it("exits non-zero for non-installed skill", () => {
    const { output, status } = run("remove deep-fix");
    expect(status).not.toBe(0);
    expect(output).toContain("not found");
  });

  it("exits non-zero with no arguments", () => {
    const { output, status } = run("remove");
    expect(status).not.toBe(0);
    expect(output).toContain("Usage:");
  });
});

describe("arcana list", () => {
  it("lists available skills (exit 0)", () => {
    const { output, status } = run("list");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Skills");
    expect(output).toContain("deep-fix");
    expect(output).toContain("deep-review");
  });

  it("shows installed status after adding", () => {
    run("add deep-fix --scope project --agent claude");
    const { output } = run("list");
    expect(output).toContain("✓ deep-fix");
  });
});

describe("arcana use", () => {
  it("prints skill content to stdout (exit 0)", () => {
    const { output, status } = run("use deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("name: deep-fix");
    expect(output).toContain("description:");
  });

  it("prints agent content to stdout", () => {
    const { output, status } = run("use code-reviewer");
    expect(status).toBe(0);
    expect(output).toContain("name: code-reviewer");
  });

  it("exits non-zero for unknown skill", () => {
    const { output, status } = run("use nonexistent-xyz");
    expect(status).not.toBe(0);
    expect(output).toContain("Unknown skill or agent");
    expect(output).toContain("Available:");
  });
});

describe("arcana info", () => {
  it("shows skill metadata (exit 0)", () => {
    const { output, status } = run("info deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("deep-fix");
    expect(output).toContain("Type:");
    expect(output).toContain("skill");
    expect(output).toContain("Lines:");
    expect(output).toContain("Size:");
  });

  it("shows agent metadata", () => {
    const { output, status } = run("info code-reviewer");
    expect(status).toBe(0);
    expect(output).toContain("code-reviewer");
    expect(output).toContain("agent");
  });

  it("exits non-zero for unknown name", () => {
    const { output, status } = run("info nonexistent-xyz");
    expect(status).not.toBe(0);
    expect(output).toContain("Unknown skill or agent");
  });
});

describe("arcana doctor", () => {
  it("runs without error in a clean directory", () => {
    const { output, status } = run("doctor");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Doctor");
    expect(output).toContain("Summary:");
  });

  it("finds installed skills after adding", () => {
    run("add deep-fix --scope project --agent claude");
    const { output } = run("doctor");
    expect(output).toContain("deep-fix");
    expect(output).toContain("PASS");
  });
});

describe("arcana update", () => {
  it("updates installed skills (exit 0)", () => {
    run("add deep-fix --scope project --agent claude");
    const { output, status } = run("update");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Update");
    expect(output).toContain("deep-fix");
  });

  it("runs without error even with no project-level skills", () => {
    const { output, status } = run("update");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Update");
  });
});

describe("arcana sync (exit codes)", () => {
  it("exits non-zero when .agents/skills/ does not exist", () => {
    const { status } = run("sync");
    expect(status).not.toBe(0);
  });

  it("exits 0 on successful sync", () => {
    const canonical = join(TMP, ".agents", "skills", "test-skill");
    fsExtra.ensureDirSync(canonical);
    fsExtra.writeFileSync(join(canonical, "SKILL.md"), "---\nname: test-skill\n---\n# Test");
    fsExtra.ensureDirSync(join(TMP, ".claude"));

    const { status } = run("sync");
    expect(status).toBe(0);
  });
});

describe("upgrade path: migration + update + sync", () => {
  it("renames skill via migration and updates it", () => {
    // Simulate pre-migration state: user has old-named skill installed
    const skillsDir = join(TMP, ".claude", "skills");
    fsExtra.ensureDirSync(join(skillsDir, "new-project-idea"));
    fsExtra.writeFileSync(
      join(skillsDir, "new-project-idea", "SKILL.md"),
      "---\nname: new-project-idea\n---\n<!-- arcana-managed -->\n# Old content"
    );

    // Run update — should apply migration (rename) then re-copy
    const { output } = run("update");
    expect(output).toContain("Arcana Update");

    // The old name should be gone, new name should exist with latest content
    expect(fsExtra.existsSync(join(skillsDir, "new-project-idea"))).toBe(false);
    expect(fsExtra.existsSync(join(skillsDir, "idea-audit", "SKILL.md"))).toBe(true);
  });
});
