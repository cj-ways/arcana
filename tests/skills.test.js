import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getPackageSkillsDir, getPackageAgentsDir, getAvailableSkills, getAvailableAgents } from "../src/utils/paths.js";
import { parseFrontmatter } from "../src/utils/frontmatter.js";
import { getSkillCatalog } from "../src/utils/catalog.js";

const skillsDir = getPackageSkillsDir();
const agentsDir = getPackageAgentsDir();
const skills = getAvailableSkills();
const agents = getAvailableAgents();
const skillCatalog = getSkillCatalog();

describe("skill frontmatter compliance", () => {
  for (const skill of skills) {
    describe(skill, () => {
      it("has valid frontmatter", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        expect(fmMatch).not.toBeNull();
      });

      it("has name field matching directory", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const fm = parseFrontmatter(content);
        expect(fm.name).toBe(skill);
      });

      it("has description under 1024 chars", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const fm = parseFrontmatter(content);
        expect(fm.description).toBeDefined();
        expect(fm.description.length).toBeLessThan(1024);
      });

      it("has allowed-tools declared", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const fm = parseFrontmatter(content);
        expect(fm["allowed-tools"]).toBeDefined();
      });

      it("uses comma-separated format for allowed-tools (not JSON array)", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const fm = parseFrontmatter(content);
        if (fm["allowed-tools"]) {
          expect(fm["allowed-tools"]).not.toMatch(/^\[/);
        }
      });

      it("is under 500 lines", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const lines = content.split("\n").length;
        expect(lines).toBeLessThan(500);
      });

      it("does not contain scaffold placeholders", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        expect(content).not.toContain("TODO:");
      });

      it("has name in lowercase-kebab-case", () => {
        expect(skill).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });

      it("has name under 64 chars", () => {
        expect(skill.length).toBeLessThan(64);
      });
    });
  }
});

describe("skill inventory", () => {
  it("catalog names match discovered skills", () => {
    expect([...skills].sort()).toEqual(
      skillCatalog.map((skill) => skill.name).sort(),
    );
  });

  it("skill names are unique", () => {
    expect(new Set(skills).size).toBe(skills.length);
  });
});

describe("feature-audit effort contract", () => {
  const featureAudit = readFileSync(join(skillsDir, "feature-audit", "SKILL.md"), "utf-8");

  it("documents runtime effort decorators and auto selection", () => {
    expect(featureAudit).toContain("effort:auto|low|medium|high|extra");
    expect(featureAudit).toContain("## Auto Effort Selection");
  });

  it("documents distinct effort budgets", () => {
    expect(featureAudit).toContain("| `low` |");
    expect(featureAudit).toContain("| `medium` |");
    expect(featureAudit).toContain("| `high` |");
    expect(featureAudit).toContain("| `extra` |");
    expect(featureAudit).toContain("| `auto` |");
  });

  it("uses progressive-disclosure references for deep passes and persistence", () => {
    expect(featureAudit).toContain("references/high-and-extra.md");
    expect(featureAudit).toContain("references/persistence.md");
    expect(
      readFileSync(join(skillsDir, "feature-audit", "references", "high-and-extra.md"), "utf-8"),
    ).toContain("## High Pass");
    expect(
      readFileSync(join(skillsDir, "feature-audit", "references", "persistence.md"), "utf-8"),
    ).toContain("## Suggested Feature Doc Set");
  });

  it("keeps audit ownership separate from feature design", () => {
    expect(featureAudit).toContain("switch to `/feature-design`");
    expect(featureAudit).not.toContain("the user clearly wants brainstorming or debate");
  });
});

describe("feature-design routing contract", () => {
  const featureDesign = readFileSync(join(skillsDir, "feature-design", "SKILL.md"), "utf-8");

  it("documents boundaries against nearby skills", () => {
    expect(featureDesign).toContain("/feature-audit");
    expect(featureDesign).toContain("/pressure-test");
    expect(featureDesign).toContain("/idea-audit");
    expect(featureDesign).toContain("/v0-design");
  });

  it("uses progressive-disclosure references for spec writing and design lenses", () => {
    expect(featureDesign).toContain("references/spec-template.md");
    expect(featureDesign).toContain("references/design-lenses.md");
    expect(
      readFileSync(join(skillsDir, "feature-design", "references", "spec-template.md"), "utf-8"),
    ).toContain("## Design Frame");
    expect(
      readFileSync(join(skillsDir, "feature-design", "references", "design-lenses.md"), "utf-8"),
    ).toContain("## Reversibility");
  });

  it("makes feature-audit the prerequisite when the current-state problem is still unknown", () => {
    expect(featureDesign).toContain("use `/feature-audit` first");
  });
});

describe("skill structural quality", () => {
  // Known tools that skills can reference in their body
  const KNOWN_TOOLS = ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Agent", "WebSearch", "WebFetch", "AskUserQuestion"];

  for (const skill of skills) {
    describe(`${skill} structure`, () => {
      it("has a Gotchas or Rules section", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const hasGotchas = content.includes("## Gotchas");
        const hasRules = content.includes("## Rules");
        expect(hasGotchas || hasRules).toBe(true);
      });

      it("allowed-tools covers tools referenced in body", () => {
        const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
        const fm = parseFrontmatter(content);
        const declaredTools = (fm["allowed-tools"] || "").split(",").map(t => t.trim());

        // Extract body after frontmatter
        const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        if (!bodyMatch) return;
        const body = bodyMatch[1];

        for (const tool of KNOWN_TOOLS) {
          // Check if the body explicitly instructs using this tool as a Claude Code tool
          // Require case-sensitive match (tool names are capitalized: Agent, Edit, Read, etc.)
          // and proximity to tool-like context to avoid matching natural language ("the agent", "edit the description")
          const patterns = [
            new RegExp(`\\b${tool}\\b tool`, ""),       // "Agent tool", "Edit tool"
            new RegExp(`Use the ${tool}\\b`, ""),        // "Use the Agent..."
            new RegExp(`allowed-tools.*\\b${tool}\\b`),  // in allowed-tools references
            new RegExp(`\\b${tool}\\(`, ""),             // "Agent(" function-call style
          ];
          const bodyMentionsTool = patterns.some(p => p.test(body));
          if (bodyMentionsTool) {
            expect(
              declaredTools.includes(tool),
              `${skill}: body references ${tool} but allowed-tools is [${declaredTools.join(", ")}]`
            ).toBe(true);
          }
        }
      });
    });
  }
});

describe("agent frontmatter compliance", () => {
  for (const agent of agents) {
    describe(agent, () => {
      it("has valid frontmatter", () => {
        const content = readFileSync(join(agentsDir, `${agent}.md`), "utf-8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        expect(fmMatch).not.toBeNull();
      });

      it("has name field", () => {
        const content = readFileSync(join(agentsDir, `${agent}.md`), "utf-8");
        const fm = parseFrontmatter(content);
        expect(fm.name).toBe(agent);
      });

      it("has description field", () => {
        const content = readFileSync(join(agentsDir, `${agent}.md`), "utf-8");
        const fm = parseFrontmatter(content);
        expect(fm.description).toBeDefined();
        expect(fm.description.length).toBeGreaterThan(0);
      });

      it("has model field", () => {
        const content = readFileSync(join(agentsDir, `${agent}.md`), "utf-8");
        const fm = parseFrontmatter(content);
        expect(fm.model).toBeDefined();
      });
    });
  }
});
