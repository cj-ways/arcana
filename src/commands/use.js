import { readFileSync, existsSync } from "fs";
import { join, resolve, sep } from "path";
import { getPackageSkillsDir, getPackageAgentsDir, getAvailableSkills, getAvailableAgents } from "../utils/paths.js";
import { printNextSteps } from "../utils/cli-errors.js";

export async function runUse(skill) {
  const skillsDir = getPackageSkillsDir();
  const agentsDir = getPackageAgentsDir();

  // Try as skill first
  const skillPath = resolve(join(skillsDir, skill, "SKILL.md"));
  if (skillPath.startsWith(skillsDir + sep) && existsSync(skillPath)) {
    process.stdout.write(readFileSync(skillPath, "utf-8") + '\n');
    return;
  }

  // Try as agent
  const agentPath = resolve(join(agentsDir, `${skill}.md`));
  if (agentPath.startsWith(agentsDir + sep) && existsSync(agentPath)) {
    process.stdout.write(readFileSync(agentPath, "utf-8") + '\n');
    return;
  }

  const available = getAvailableSkills().concat(getAvailableAgents()).join(', ');
  console.error(`Unknown skill or agent: ${skill}`);
  console.error(`Available: ${available}`);
  printNextSteps(
    [
      "Run `arcana list` to inspect installed and shipped names.",
      "Use `arcana info <name>` if you want metadata before printing the full file.",
    ],
    { stream: "error" },
  );
  process.exit(1);
}
