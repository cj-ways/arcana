import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import { copySkills, copyAgents, renameExistingSkill, renameExistingAgent, mirrorSkills } from "../src/utils/copy.js";
import { getPackageSkillsDir, getPackageAgentsDir } from "../src/utils/paths.js";
import { parseFrontmatter } from "../src/utils/frontmatter.js";

const TMP = join(import.meta.dirname, ".tmp-test");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

describe("copySkills", () => {
  it("installs a valid skill", () => {
    const target = join(TMP, "skills");
    const results = copySkills(["deep-fix"], target);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ name: "deep-fix", status: "installed" });
    expect(fsExtra.existsSync(join(target, "deep-fix", "SKILL.md"))).toBe(true);
  });

  it("adds arcana marker to installed skill", () => {
    const target = join(TMP, "skills");
    copySkills(["deep-fix"], target);

    const content = fsExtra.readFileSync(join(target, "deep-fix", "SKILL.md"), "utf-8");
    expect(content).toContain("<!-- arcana-managed -->");
  });

  it("marker is placed after frontmatter, not inside it", () => {
    const target = join(TMP, "skills");
    copySkills(["deep-fix"], target);

    const content = fsExtra.readFileSync(join(target, "deep-fix", "SKILL.md"), "utf-8");
    const fmEnd = content.indexOf("---", content.indexOf("---") + 3);
    const markerPos = content.indexOf("<!-- arcana-managed -->");
    expect(markerPos).toBeGreaterThan(fmEnd);
  });

  it("returns not found for nonexistent skill", () => {
    const target = join(TMP, "skills");
    const results = copySkills(["nonexistent-skill"], target);

    expect(results).toEqual([{ name: "nonexistent-skill", status: "not found" }]);
  });

  it("detects conflict with non-arcana skill", () => {
    const target = join(TMP, "skills");
    const customDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(join(customDir, "SKILL.md"), "---\nname: my-custom-skill\n---\n# Custom");

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("conflict");
  });

  it("overwrites conflict when force is true", () => {
    const target = join(TMP, "skills");
    const customDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(join(customDir, "SKILL.md"), "---\nname: my-custom-skill\n---\n# Custom");

    const results = copySkills(["deep-fix"], target, { force: true });
    expect(results[0].status).toBe("installed");
  });

  it("overwrites arcana-managed skill without conflict", () => {
    const target = join(TMP, "skills");
    // First install
    copySkills(["deep-fix"], target);
    // Second install should not conflict
    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("installed");
  });

  it("handles multiple skills at once", () => {
    const target = join(TMP, "skills");
    const results = copySkills(["deep-fix", "create-pr", "nonexistent"], target);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("installed");
    expect(results[1].status).toBe("installed");
    expect(results[2].status).toBe("not found");
  });
});

describe("copyAgents", () => {
  it("installs a valid agent", () => {
    const target = join(TMP, "agents");
    const results = copyAgents(["code-reviewer"], target);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ name: "code-reviewer", status: "installed" });
    expect(fsExtra.existsSync(join(target, "code-reviewer.md"))).toBe(true);
  });

  it("adds marker to installed agent", () => {
    const target = join(TMP, "agents");
    copyAgents(["code-reviewer"], target);

    const content = fsExtra.readFileSync(join(target, "code-reviewer.md"), "utf-8");
    expect(content).toContain("<!-- arcana-managed -->");
  });

  it("returns empty array when targetAgentsDir is null", () => {
    const results = copyAgents(["code-reviewer"], null);
    expect(results).toEqual([]);
  });

  it("returns not found for nonexistent agent", () => {
    const target = join(TMP, "agents");
    const results = copyAgents(["nonexistent-agent"], target);
    expect(results).toEqual([{ name: "nonexistent-agent", status: "not found" }]);
  });
});

describe("addMarker (via copySkills)", () => {
  it("does not duplicate marker on re-install", () => {
    const target = join(TMP, "skills");
    copySkills(["deep-fix"], target);
    copySkills(["deep-fix"], target);

    const content = fsExtra.readFileSync(join(target, "deep-fix", "SKILL.md"), "utf-8");
    const markerCount = (content.match(/<!-- arcana-managed -->/g) || []).length;
    expect(markerCount).toBe(1);
  });

  it("preserves content with --- in code blocks", () => {
    const target = join(TMP, "skills");
    copySkills(["release-check"], target);

    const content = fsExtra.readFileSync(join(target, "release-check", "SKILL.md"), "utf-8");
    // Should have marker
    expect(content).toContain("<!-- arcana-managed -->");
    // Frontmatter should still be valid (name field present)
    expect(content).toMatch(/^---\nname: release-check/);
  });
});

describe("renameExistingSkill", () => {
  it("renames skill directory and updates frontmatter", () => {
    const skillsDir = join(TMP, "skills");
    const skillDir = join(skillsDir, "old-skill");
    fsExtra.ensureDirSync(skillDir);
    fsExtra.writeFileSync(join(skillDir, "SKILL.md"), "---\nname: old-skill\ndescription: 'test'\n---\n# Old");

    const result = renameExistingSkill(skillsDir, "old-skill", "new-skill");
    expect(result).toBe(true);
    expect(fsExtra.existsSync(join(skillsDir, "new-skill", "SKILL.md"))).toBe(true);
    expect(fsExtra.existsSync(join(skillsDir, "old-skill"))).toBe(false);

    const content = fsExtra.readFileSync(join(skillsDir, "new-skill", "SKILL.md"), "utf-8");
    expect(content).toContain("name: new-skill");
    expect(content).not.toContain("name: old-skill");
  });

  it("returns false if source does not exist", () => {
    const result = renameExistingSkill(TMP, "nonexistent", "new-name");
    expect(result).toBe(false);
  });

  it("returns false if destination already exists", () => {
    const skillsDir = join(TMP, "skills");
    fsExtra.ensureDirSync(join(skillsDir, "old-skill"));
    fsExtra.writeFileSync(join(skillsDir, "old-skill", "SKILL.md"), "---\nname: old-skill\n---\n");
    fsExtra.ensureDirSync(join(skillsDir, "new-skill"));

    const result = renameExistingSkill(skillsDir, "old-skill", "new-skill");
    expect(result).toBe(false);
  });
});

describe("copyAgents — conflict detection", () => {
  it("detects conflict with non-arcana agent", () => {
    const target = join(TMP, "agents");
    fsExtra.ensureDirSync(target);
    fsExtra.writeFileSync(join(target, "code-reviewer.md"), "---\nname: my-custom-reviewer\n---\n# Custom");

    const results = copyAgents(["code-reviewer"], target);
    expect(results[0].status).toBe("conflict");
  });

  it("overwrites conflict when force is true", () => {
    const target = join(TMP, "agents");
    fsExtra.ensureDirSync(target);
    fsExtra.writeFileSync(join(target, "code-reviewer.md"), "---\nname: my-custom-reviewer\n---\n# Custom");

    const results = copyAgents(["code-reviewer"], target, { force: true });
    expect(results[0].status).toBe("installed");
  });

  it("marker is placed after frontmatter in agent files", () => {
    const target = join(TMP, "agents");
    copyAgents(["code-reviewer"], target);

    const content = fsExtra.readFileSync(join(target, "code-reviewer.md"), "utf-8");
    expect(content).toContain("<!-- arcana-managed -->");
    // Frontmatter should still start at line 1
    expect(content).toMatch(/^---\n/);
  });
});

describe("legacy name-match detection (known limitation)", () => {
  it("treats skill with matching arcana name but no marker as arcana-managed", () => {
    const target = join(TMP, "skills");
    const customDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(customDir);
    // Name matches an Arcana skill name — legacy detection fires
    fsExtra.writeFileSync(join(customDir, "SKILL.md"), "---\nname: deep-fix\n---\n# User custom content");

    const results = copySkills(["deep-fix"], target);
    // Known behavior: treated as arcana-managed, gets overwritten
    expect(results[0].status).toBe("installed");
  });
});

describe("renameExistingAgent", () => {
  it("renames agent file and updates frontmatter", () => {
    const agentsDir = join(TMP, "agents");
    fsExtra.ensureDirSync(agentsDir);
    fsExtra.writeFileSync(join(agentsDir, "old-agent.md"), "---\nname: old-agent\ndescription: 'test'\n---\n# Old");

    const result = renameExistingAgent(agentsDir, "old-agent", "new-agent");
    expect(result).toBe(true);
    expect(fsExtra.existsSync(join(agentsDir, "new-agent.md"))).toBe(true);
    expect(fsExtra.existsSync(join(agentsDir, "old-agent.md"))).toBe(false);

    const content = fsExtra.readFileSync(join(agentsDir, "new-agent.md"), "utf-8");
    expect(content).toContain("name: new-agent");
    expect(content).not.toContain("name: old-agent");
  });

  it("returns false if source does not exist", () => {
    const agentsDir = join(TMP, "agents");
    fsExtra.ensureDirSync(agentsDir);
    const result = renameExistingAgent(agentsDir, "nonexistent", "new-name");
    expect(result).toBe(false);
  });

  it("returns false if destination already exists", () => {
    const agentsDir = join(TMP, "agents");
    fsExtra.ensureDirSync(agentsDir);
    fsExtra.writeFileSync(join(agentsDir, "old.md"), "---\nname: old\n---\n");
    fsExtra.writeFileSync(join(agentsDir, "new.md"), "---\nname: new\n---\n");

    const result = renameExistingAgent(agentsDir, "old", "new");
    expect(result).toBe(false);
  });
});

describe("rewriteFrontmatterName (via renameExistingSkill)", () => {
  it("handles SKILL.md with no frontmatter — content unchanged", () => {
    const skillsDir = join(TMP, "skills");
    const skillDir = join(skillsDir, "old-skill");
    fsExtra.ensureDirSync(skillDir);
    fsExtra.writeFileSync(join(skillDir, "SKILL.md"), "# No frontmatter here");

    renameExistingSkill(skillsDir, "old-skill", "new-skill");
    const content = fsExtra.readFileSync(join(skillsDir, "new-skill", "SKILL.md"), "utf-8");
    expect(content).toBe("# No frontmatter here");
  });

  it("handles frontmatter with name not being first field", () => {
    const skillsDir = join(TMP, "skills");
    const skillDir = join(skillsDir, "old-skill");
    fsExtra.ensureDirSync(skillDir);
    fsExtra.writeFileSync(join(skillDir, "SKILL.md"), "---\ndescription: 'test'\nname: old-skill\nallowed-tools: Read\n---\n# Body");

    renameExistingSkill(skillsDir, "old-skill", "new-skill");
    const content = fsExtra.readFileSync(join(skillsDir, "new-skill", "SKILL.md"), "utf-8");
    expect(content).toContain("name: new-skill");
    expect(content).toContain("description: 'test'");
    expect(content).toContain("allowed-tools: Read");
  });

  it("handles frontmatter without a name field — content unchanged", () => {
    const skillsDir = join(TMP, "skills");
    const skillDir = join(skillsDir, "old-skill");
    fsExtra.ensureDirSync(skillDir);
    fsExtra.writeFileSync(join(skillDir, "SKILL.md"), "---\ndescription: 'no name'\n---\n# Body");

    renameExistingSkill(skillsDir, "old-skill", "new-skill");
    const content = fsExtra.readFileSync(join(skillsDir, "new-skill", "SKILL.md"), "utf-8");
    expect(content).not.toContain("name:");
    expect(content).toContain("description: 'no name'");
  });
});

describe("mirrorSkills", () => {
  it("copies canonical to all mirror targets", () => {
    const canonical = join(TMP, "canonical");
    const mirror1 = join(TMP, "mirror1");
    const mirror2 = join(TMP, "mirror2");

    fsExtra.ensureDirSync(join(canonical, "test-skill"));
    fsExtra.writeFileSync(join(canonical, "test-skill", "SKILL.md"), "# test");

    const results = mirrorSkills(canonical, [mirror1, mirror2]);
    expect(results).toHaveLength(2);
    expect(fsExtra.existsSync(join(mirror1, "test-skill", "SKILL.md"))).toBe(true);
    expect(fsExtra.existsSync(join(mirror2, "test-skill", "SKILL.md"))).toBe(true);
  });

  it("preserves file content in mirrors", () => {
    const canonical = join(TMP, "canonical");
    const mirror = join(TMP, "mirror");

    fsExtra.ensureDirSync(join(canonical, "test-skill"));
    fsExtra.writeFileSync(join(canonical, "test-skill", "SKILL.md"), "---\nname: test-skill\n---\n# Content here");

    mirrorSkills(canonical, [mirror]);
    const content = fsExtra.readFileSync(join(mirror, "test-skill", "SKILL.md"), "utf-8");
    expect(content).toBe("---\nname: test-skill\n---\n# Content here");
  });
});

describe("post-marker frontmatter integrity", () => {
  it("installed skill frontmatter is still parseable after marker injection", () => {
    const target = join(TMP, "skills");
    copySkills(["deep-fix"], target);

    const content = fsExtra.readFileSync(join(target, "deep-fix", "SKILL.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("deep-fix");
    expect(fm.description).toBeDefined();
    expect(fm["allowed-tools"]).toBeDefined();
  });

  it("installed agent frontmatter is still parseable after marker injection", () => {
    const target = join(TMP, "agents");
    copyAgents(["code-reviewer"], target);

    const content = fsExtra.readFileSync(join(target, "code-reviewer.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe("code-reviewer");
    // Frontmatter should start at line 1 (--- at position 0)
    expect(content.startsWith("---\n")).toBe(true);
  });
});
