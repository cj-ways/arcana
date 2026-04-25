import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "fs";
import { join } from "path";

export function appendAgentsMdBlock(cwd, { dryRun = false } = {}) {
  const agentsPath = join(cwd, "AGENTS.md");
  const skillsDir = join(cwd, ".agents", "skills");

  // Discover installed skill names
  let skillList = "";
  if (existsSync(skillsDir)) {
    const names = readdirSync(skillsDir).filter((name) => {
      return existsSync(join(skillsDir, name, "SKILL.md"));
    });
    skillList = names.map((name) => `- ${name}`).join("\n");
  }

  const block = `
## Agent Skills (Arcana)

Skills are located in \`.agents/skills/\`. Each skill folder contains a \`SKILL.md\` file.

**Skill discovery:** Enumerate all \`.agents/skills/*/SKILL.md\` files. Parse YAML front-matter to get name and description. Load full content only when the skill is invoked.

Available skills:
${skillList}
`;

  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    if (content.includes("Agent Skills (Arcana)")) return { path: agentsPath, status: "current", skillCount: skillList ? skillList.split("\n").length : 0 };
    if (!dryRun) {
      appendFileSync(agentsPath, block);
    }
    return { path: agentsPath, status: "appended", skillCount: skillList ? skillList.split("\n").length : 0 };
  } else {
    if (!dryRun) {
      writeFileSync(agentsPath, `# AGENTS.md\n${block}`);
    }
    return { path: agentsPath, status: "created", skillCount: skillList ? skillList.split("\n").length : 0 };
  }
}
