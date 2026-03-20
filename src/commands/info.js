import chalk from "chalk";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  getPackageSkillsDir,
  getPackageAgentsDir,
  getAvailableSkills,
  getAvailableAgents,
} from "../utils/paths.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

export async function runInfo(skill) {
  // Try as skill first
  const skillPath = join(getPackageSkillsDir(), skill, "SKILL.md");
  // Try as agent
  const agentPath = join(getPackageAgentsDir(), `${skill}.md`);

  let filePath = null;
  let type = null;

  if (existsSync(skillPath)) {
    filePath = skillPath;
    type = "skill";
  } else if (existsSync(agentPath)) {
    filePath = agentPath;
    type = "agent";
  }

  if (!filePath) {
    const allSkills = getAvailableSkills();
    const allAgents = getAvailableAgents();
    console.error(chalk.red(`\n  Unknown skill or agent: ${skill}\n`));
    console.error(chalk.dim("  Available skills:"));
    for (const s of allSkills) {
      console.error(chalk.dim(`    - ${s}`));
    }
    console.error(chalk.dim("\n  Available agents:"));
    for (const a of allAgents) {
      console.error(chalk.dim(`    - ${a}`));
    }
    console.error();
    process.exit(1);
  }

  const content = readFileSync(filePath, "utf-8");
  const stat = statSync(filePath);
  const meta = parseFrontmatter(content);
  const lineCount = content.split("\n").length;
  const sizeKb = (stat.size / 1024).toFixed(1);

  console.log(chalk.bold(`\n✦ ${meta.name || skill}\n`));
  console.log(chalk.dim(`  Type:         `) + type);
  console.log(chalk.dim(`  Name:         `) + (meta.name || skill));
  console.log(chalk.dim(`  Description:  `) + (meta.description || "(none)"));

  if (meta["argument-hint"]) {
    console.log(chalk.dim(`  Argument:     `) + meta["argument-hint"]);
  }

  console.log(chalk.dim(`  Lines:        `) + lineCount);
  console.log(chalk.dim(`  Size:         `) + `${sizeKb} KB`);
  console.log(chalk.dim(`  Source:       `) + filePath);
  console.log();
}
