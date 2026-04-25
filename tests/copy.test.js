import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import {
  copySkills,
  copyAgents,
  renameExistingSkill,
  renameExistingAgent,
  mirrorSkills,
  parseArcanaMarker,
  markArcanaManaged,
  getManagedContentHash,
  stripArcanaMarker,
} from "../src/utils/copy.js";
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
    expect(parseArcanaMarker(content)).toMatchObject({
      version: expect.any(String),
      hash: expect.any(String),
    });
  });

  it("marker is placed after frontmatter, not inside it", () => {
    const target = join(TMP, "skills");
    copySkills(["deep-fix"], target);

    const content = fsExtra.readFileSync(join(target, "deep-fix", "SKILL.md"), "utf-8");
    const fmEnd = content.indexOf("---", content.indexOf("---") + 3);
    const markerPos = content.indexOf("<!-- arcana-managed");
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
    expect(results[0].status).toBe("updated");
  });

  it("reports current when the installed Arcana skill already matches package source", () => {
    const target = join(TMP, "skills");
    // First install
    copySkills(["deep-fix"], target);
    // Second install should not conflict
    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("current");
  });

  it("handles multiple skills at once", () => {
    const target = join(TMP, "skills");
    const results = copySkills(["deep-fix", "create-pr", "nonexistent"], target);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("installed");
    expect(results[1].status).toBe("installed");
    expect(results[2].status).toBe("not found");
  });

  it("supports dry-run without writing files", () => {
    const target = join(TMP, "skills");
    const results = copySkills(["deep-fix"], target, { dryRun: true });

    expect(results).toEqual([{ name: "deep-fix", status: "installed" }]);
    expect(fsExtra.existsSync(join(target, "deep-fix", "SKILL.md"))).toBe(false);
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
    expect(parseArcanaMarker(content)).toMatchObject({
      version: expect.any(String),
      hash: expect.any(String),
    });
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

  it("supports dry-run without writing agent files", () => {
    const target = join(TMP, "agents");
    const results = copyAgents(["code-reviewer"], target, { dryRun: true });

    expect(results).toEqual([{ name: "code-reviewer", status: "installed" }]);
    expect(fsExtra.existsSync(join(target, "code-reviewer.md"))).toBe(false);
  });
});

describe("addMarker (via copySkills)", () => {
  it("does not duplicate marker on re-install", () => {
    const target = join(TMP, "skills");
    copySkills(["deep-fix"], target);
    copySkills(["deep-fix"], target);

    const content = fsExtra.readFileSync(join(target, "deep-fix", "SKILL.md"), "utf-8");
    const markerCount = (content.match(/<!-- arcana-managed\b/g) || []).length;
    expect(markerCount).toBe(1);
  });

  it("preserves content with --- in code blocks", () => {
    const target = join(TMP, "skills");
    copySkills(["release-check"], target);

    const content = fsExtra.readFileSync(join(target, "release-check", "SKILL.md"), "utf-8");
    // Should have marker
    expect(parseArcanaMarker(content)).not.toBeNull();
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
    expect(results[0].status).toBe("updated");
  });

  it("marker is placed after frontmatter in agent files", () => {
    const target = join(TMP, "agents");
    copyAgents(["code-reviewer"], target);

    const content = fsExtra.readFileSync(join(target, "code-reviewer.md"), "utf-8");
    expect(parseArcanaMarker(content)).not.toBeNull();
    // Frontmatter should still start at line 1
    expect(content).toMatch(/^---\n/);
  });
});

describe("ownership detection", () => {
  it("treats same-name custom skills without a marker as conflicts", () => {
    const target = join(TMP, "skills");
    const customDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(join(customDir, "SKILL.md"), "---\nname: deep-fix\n---\n# User custom content");

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("conflict");
  });

  it("treats unmarked Arcana content as managed for legacy installs", () => {
    const target = join(TMP, "skills");
    const customDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(customDir);

    const packageContent = fsExtra
      .readFileSync(join(getPackageSkillsDir(), "deep-fix", "SKILL.md"), "utf-8")
      .replace(/<!-- arcana-managed(?:\s+version:[^\s>]+)?(?:\s+hash:[a-f0-9]{64})?\s*-->\n?/g, "");

    fsExtra.writeFileSync(join(customDir, "SKILL.md"), packageContent);

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("updated");
  });
});

describe("version-aware managed updates", () => {
  it("upgrades an older Arcana-managed skill when the stored hash still matches installed content", () => {
    const target = join(TMP, "skills");
    const skillDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    const oldContent = "---\nname: deep-fix\ndescription: old\n---\n# Old packaged content\n";
    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      markArcanaManaged(oldContent, {
        version: "1.8.0",
        hash: getManagedContentHash(oldContent),
      })
    );

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("updated");

    const installed = fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    const marker = parseArcanaMarker(installed);
    expect(marker?.hash).toBe(getManagedContentHash(installed));
    expect(stripArcanaMarker(installed)).toBe(
      fsExtra.readFileSync(join(getPackageSkillsDir(), "deep-fix", "SKILL.md"), "utf-8")
    );
  });

  it("skips locally modified Arcana-managed skills without force", () => {
    const target = join(TMP, "skills");
    const skillDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    const sourceContent = fsExtra.readFileSync(
      join(getPackageSkillsDir(), "deep-fix", "SKILL.md"),
      "utf-8"
    );
    const customized = `${sourceContent}\n## Local Notes\nCustom local edit\n`;

    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      markArcanaManaged(customized, {
        version: "1.8.0",
        hash: getManagedContentHash(sourceContent),
      })
    );

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("modified");
    expect(stripArcanaMarker(fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8"))).toBe(customized);
  });

  it("refreshes legacy markers when content already matches package source", () => {
    const target = join(TMP, "skills");
    const skillDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    const sourceContent = fsExtra.readFileSync(
      join(getPackageSkillsDir(), "deep-fix", "SKILL.md"),
      "utf-8"
    );
    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      sourceContent.replace(/^---\n[\s\S]*?\n---\n?/, (match) => `${match}<!-- arcana-managed -->\n`)
    );

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("updated");

    const marker = parseArcanaMarker(fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8"));
    expect(marker?.version).toBeTruthy();
    expect(marker?.hash).toBeTruthy();
  });

  it("treats legacy managed installs with changed content as unsafe without force", () => {
    const target = join(TMP, "skills");
    const skillDir = join(target, "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: deep-fix\n---\n<!-- arcana-managed -->\n# Legacy content\n"
    );

    const results = copySkills(["deep-fix"], target);
    expect(results[0].status).toBe("legacy");
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

  it("supports dry-run without creating mirror directories", () => {
    const canonical = join(TMP, "canonical");
    const mirror = join(TMP, "mirror");

    fsExtra.ensureDirSync(join(canonical, "test-skill"));
    fsExtra.writeFileSync(join(canonical, "test-skill", "SKILL.md"), "# test");

    const results = mirrorSkills(canonical, [mirror], { dryRun: true });
    expect(results).toEqual([{ dir: mirror, status: "synced" }]);
    expect(fsExtra.existsSync(mirror)).toBe(false);
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
