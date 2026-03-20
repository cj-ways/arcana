import chalk from "chalk";
import { getTargetDirs, getAvailableSkills, getAvailableAgents } from "../utils/paths.js";
import { copySkills, copyAgents, mirrorSkills } from "../utils/copy.js";
import { isInsideProject } from "../utils/detect.js";
import { existsSync } from "fs";
import { join } from "path";

function detectAgent() {
  const cwd = process.cwd();
  if (existsSync(join(cwd, ".agents", "skills"))) return "multi";
  if (existsSync(join(cwd, "AGENTS.md")) && !existsSync(join(cwd, "CLAUDE.md"))) return "codex";
  return "claude";
}

function detectScope() {
  return isInsideProject() ? "project" : "user";
}

export async function runAdd(skills, opts) {
  const agent = opts.agent || detectAgent();
  const scope = opts.scope || detectScope();
  const dirs = getTargetDirs(agent, scope);
  const force = opts.force || false;

  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();

  let toInstall = skills || [];

  if (opts.all) {
    toInstall = allSkills;
  } else if (toInstall.length === 0) {
    console.log(chalk.yellow("Usage: arcana add <skill-name> [skill-name...] or arcana add --all"));
    process.exit(1);
  }

  // Separate skills from agents
  const skillNames = toInstall.filter((s) => allSkills.includes(s));
  const agentNames = toInstall.filter((s) => allAgents.includes(s));

  // If user passed names that are neither skill nor agent, warn
  const unknown = toInstall.filter(
    (s) => !allSkills.includes(s) && !allAgents.includes(s)
  );
  for (const u of unknown) {
    console.log(chalk.yellow(`  ? Unknown skill: ${u}`));
  }

  if (skillNames.length === 0 && agentNames.length === 0) {
    process.exit(1);
  }

  // Install skills
  if (skillNames.length > 0) {
    const results = copySkills(skillNames, dirs.skills, { force });
    for (const r of results) {
      if (r.status === "installed") {
        console.log(chalk.green(`  ✓ ${r.name}`));
      } else if (r.status === "conflict") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (you have a custom skill with this name)`));
        console.log(chalk.dim(`    Use --force to override, or rename your skill first.`));
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }

    // Multi-agent: also mirror
    if (agent === "multi" && dirs.mirrors) {
      mirrorSkills(dirs.skills, dirs.mirrors);
      console.log(chalk.dim("  ↳ Mirrored to agent-specific directories"));
    }
  }

  // Install agents (either explicitly named or all when --all)
  const agentsToInstall = opts.all ? allAgents : agentNames;
  if (agentsToInstall.length > 0 && dirs.agents) {
    const results = copyAgents(agentsToInstall, dirs.agents, { force });
    for (const r of results) {
      if (r.status === "installed") {
        console.log(chalk.green(`  ✓ ${r.name} (agent)`));
      } else if (r.status === "conflict") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (you have a custom agent with this name)`));
        console.log(chalk.dim(`    Use --force to override, or rename your agent first.`));
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }
  }
}
