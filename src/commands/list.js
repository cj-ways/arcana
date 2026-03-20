import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getAvailableSkills, getAvailableAgents } from "../utils/paths.js";

export async function runList() {
  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();
  const cwd = process.cwd();
  const home = homedir();

  const locations = [
    { label: ".claude/skills (project)", dir: join(cwd, ".claude", "skills") },
    { label: ".agents/skills (project)", dir: join(cwd, ".agents", "skills") },
    { label: "~/.claude/skills (user)", dir: join(home, ".claude", "skills") },
    { label: "~/.agents/skills (user)", dir: join(home, ".agents", "skills") },
  ];

  const agentLocations = [
    { label: ".claude/agents (project)", dir: join(cwd, ".claude", "agents") },
    { label: "~/.claude/agents (user)", dir: join(home, ".claude", "agents") },
  ];

  console.log(chalk.bold("\n✦ Arcana Skills\n"));

  console.log(chalk.dim("  Skills:"));
  for (const name of allSkills) {
    const installed = [];
    for (const loc of locations) {
      if (existsSync(join(loc.dir, name, "SKILL.md"))) {
        installed.push(loc.label);
      }
    }

    if (installed.length > 0) {
      console.log(
        chalk.green(`  ✓ ${name.padEnd(22)} `) +
          chalk.dim(installed.join(", "))
      );
    } else {
      console.log(chalk.gray(`  · ${name.padEnd(22)} not installed`));
    }
  }

  console.log(chalk.dim("\n  Agents:"));
  for (const name of allAgents) {
    const installed = [];
    for (const loc of agentLocations) {
      if (existsSync(join(loc.dir, `${name}.md`))) {
        installed.push(loc.label);
      }
    }

    if (installed.length > 0) {
      console.log(
        chalk.green(`  ✓ ${name.padEnd(22)} `) +
          chalk.dim(installed.join(", "))
      );
    } else {
      console.log(chalk.gray(`  · ${name.padEnd(22)} not installed`));
    }
  }

  console.log();
}
