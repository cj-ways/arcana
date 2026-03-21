import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  getPackageSkillsDir,
  getPackageAgentsDir,
  getPackageRulesDir,
  getTargetDirs,
  getAvailableSkills,
  getAvailableAgents,
  getAllInstallLocations,
} from "../src/utils/paths.js";

describe("getPackageSkillsDir", () => {
  it("returns a directory that exists", () => {
    expect(existsSync(getPackageSkillsDir())).toBe(true);
  });
});

describe("getPackageAgentsDir", () => {
  it("returns a directory that exists", () => {
    expect(existsSync(getPackageAgentsDir())).toBe(true);
  });
});

describe("getPackageRulesDir", () => {
  it("returns a directory that exists", () => {
    expect(existsSync(getPackageRulesDir())).toBe(true);
  });
});

describe("getTargetDirs", () => {
  it("returns correct paths for claude agent (project scope)", () => {
    const dirs = getTargetDirs("claude", "project");
    expect(dirs.skills).toContain(".claude/skills");
    expect(dirs.agents).toContain(".claude/agents");
    expect(dirs.mirrors).toBeUndefined();
  });

  it("returns correct paths for codex agent", () => {
    const dirs = getTargetDirs("codex", "project");
    expect(dirs.skills).toContain(".agents/skills");
    expect(dirs.agents).toBeNull();
  });

  it("returns correct paths for multi agent", () => {
    const dirs = getTargetDirs("multi", "project");
    expect(dirs.skills).toContain(".agents/skills");
    expect(dirs.agents).toContain(".claude/agents");
    expect(dirs.mirrors).toBeDefined();
    expect(dirs.mirrors).toHaveLength(1);
    expect(dirs.mirrors[0]).toContain(".claude/skills");
  });

  it("does not include cursor or gemini in multi mirrors", () => {
    const dirs = getTargetDirs("multi", "project");
    for (const mirror of dirs.mirrors) {
      expect(mirror).not.toContain(".cursor");
      expect(mirror).not.toContain(".gemini");
    }
  });

  it("uses homedir for user scope", () => {
    const dirs = getTargetDirs("claude", "user");
    expect(dirs.skills).toContain(homedir());
    expect(dirs.skills).toContain(".claude/skills");
  });

  it("throws for unknown agent", () => {
    expect(() => getTargetDirs("unknown", "project")).toThrow("Unknown agent");
  });

  it("throws for gemini (removed)", () => {
    expect(() => getTargetDirs("gemini", "project")).toThrow("Unknown agent");
  });
});

describe("getAllInstallLocations", () => {
  it("returns skills and agents arrays", () => {
    const locs = getAllInstallLocations();
    expect(locs).toHaveProperty("skills");
    expect(locs).toHaveProperty("agents");
    expect(Array.isArray(locs.skills)).toBe(true);
    expect(Array.isArray(locs.agents)).toBe(true);
  });

  it("returns 4 skill locations", () => {
    const locs = getAllInstallLocations();
    expect(locs.skills).toHaveLength(4);
  });

  it("returns 2 agent locations", () => {
    const locs = getAllInstallLocations();
    expect(locs.agents).toHaveLength(2);
  });

  it("each location has label, dir, and level", () => {
    const locs = getAllInstallLocations();
    for (const loc of [...locs.skills, ...locs.agents]) {
      expect(loc).toHaveProperty("label");
      expect(loc).toHaveProperty("dir");
      expect(loc).toHaveProperty("level");
      expect(["project", "user"]).toContain(loc.level);
    }
  });
});

describe("getAvailableSkills", () => {
  const expected = [
    "agent-audit", "create-pr", "deep-fix", "deep-review",
    "feature-audit", "generate-tests", "idea-audit",
    "import-skill", "persist-knowledge", "quick-review", "refactor-plan",
    "release-check", "security-check", "skill-scout", "v0-design",
  ];

  it("includes all expected skills", () => {
    const skills = getAvailableSkills();
    for (const s of expected) {
      expect(skills).toContain(s);
    }
  });

  it("skill count matches expected list", () => {
    expect(getAvailableSkills()).toHaveLength(expected.length);
  });

  it("includes idea-audit (renamed from new-project-idea)", () => {
    const skills = getAvailableSkills();
    expect(skills).toContain("idea-audit");
    expect(skills).not.toContain("new-project-idea");
  });
});

describe("getAvailableAgents", () => {
  it("returns 2 agents", () => {
    const agents = getAvailableAgents();
    expect(agents).toHaveLength(2);
  });

  it("includes code-reviewer and review-team", () => {
    const agents = getAvailableAgents();
    expect(agents).toContain("code-reviewer");
    expect(agents).toContain("review-team");
  });
});
