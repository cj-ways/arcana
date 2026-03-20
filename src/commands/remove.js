import chalk from "chalk";
import fsExtra from "fs-extra";
const { removeSync, existsSync } = fsExtra;
import { join } from "path";
import { homedir } from "os";
import { getAvailableSkills, getAvailableAgents } from "../utils/paths.js";

export async function runRemove(skills) {
  if (!skills || skills.length === 0) {
    console.log(chalk.yellow("Usage: arcana remove <skill-name> [skill-name...]"));
    return;
  }

  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();
  const cwd = process.cwd();

  // Search in all possible locations (project + user level)
  const searchDirs = [
    join(cwd, ".claude", "skills"),
    join(cwd, ".agents", "skills"),
    join(homedir(), ".claude", "skills"),
    join(homedir(), ".agents", "skills"),
  ];
  const agentDirs = [
    join(cwd, ".claude", "agents"),
    join(homedir(), ".claude", "agents"),
  ];

  let anyRemoved = false;

  for (const name of skills) {
    let removed = false;

    // Try as skill
    if (allSkills.includes(name)) {
      for (const dir of searchDirs) {
        const target = join(dir, name);
        if (existsSync(target)) {
          removeSync(target);
          console.log(chalk.green(`  ✓ Removed ${name} from ${dir}`));
          removed = true;
        }
      }
    }

    // Try as agent
    if (allAgents.includes(name)) {
      for (const dir of agentDirs) {
        const target = join(dir, `${name}.md`);
        if (existsSync(target)) {
          removeSync(target);
          console.log(chalk.green(`  ✓ Removed ${name} agent from ${dir}`));
          removed = true;
        }
      }
    }

    if (!removed) {
      console.log(chalk.yellow(`  - ${name} not found in any location`));
    }

    if (removed) anyRemoved = true;
  }

  if (!anyRemoved) {
    process.exit(1);
  }
}
