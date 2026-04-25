import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  getPackageMigrationsPath,
  getPackageSkillsDir,
  getPackageAgentsDir,
  getPackageRulesDir,
  getTargetDirs,
  getAvailableSkills,
  getAvailableAgents,
  getAllInstallLocations,
} from "../src/utils/paths.js";
import { getAgentCatalog, getSkillCatalog } from "../src/utils/catalog.js";

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

describe("getPackageMigrationsPath", () => {
  it("returns the shipped migrations.json path", () => {
    expect(existsSync(getPackageMigrationsPath())).toBe(true);
    expect(getPackageMigrationsPath()).toBe(
      join(getPackageSkillsDir(), "..", "migrations.json"),
    );
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

  it("filters to project locations when requested", () => {
    const locs = getAllInstallLocations({ scope: "project" });
    expect(locs.skills).toHaveLength(2);
    expect(locs.agents).toHaveLength(1);
    expect(locs.skills.every((loc) => loc.level === "project")).toBe(true);
  });

  it("filters to user locations when requested", () => {
    const locs = getAllInstallLocations({ scope: "user" });
    expect(locs.skills).toHaveLength(2);
    expect(locs.agents).toHaveLength(1);
    expect(locs.skills.every((loc) => loc.level === "user")).toBe(true);
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
  it("matches the catalog inventory", () => {
    expect([...getAvailableSkills()].sort()).toEqual(
      getSkillCatalog().map((skill) => skill.name).sort(),
    );
  });

  it("includes idea-audit (renamed from new-project-idea)", () => {
    const skills = getAvailableSkills();
    expect(skills).toContain("idea-audit");
    expect(skills).not.toContain("new-project-idea");
  });
});

describe("getAvailableAgents", () => {
  it("matches the catalog inventory", () => {
    expect([...getAvailableAgents()].sort()).toEqual(
      getAgentCatalog().map((agent) => agent.name).sort(),
    );
  });

  it("includes code-reviewer, feature-auditor, feature-designer, and review-team", () => {
    const agents = getAvailableAgents();
    expect(agents).toContain("code-reviewer");
    expect(agents).toContain("feature-auditor");
    expect(agents).toContain("feature-designer");
    expect(agents).toContain("review-team");
  });
});
