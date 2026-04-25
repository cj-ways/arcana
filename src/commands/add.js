import chalk from "chalk";
import { getTargetDirs, getAvailableSkills, getAvailableAgents } from "../utils/paths.js";
import { copySkills, copyAgents, mirrorSkills } from "../utils/copy.js";
import { isInsideProject, suggestAgent } from "../utils/detect.js";
import { exitWithMessage, printNextSteps } from "../utils/cli-errors.js";

export async function runAdd(skills, opts) {
  const agent = opts.agent || suggestAgent();
  const scope = opts.scope || (isInsideProject() ? "project" : "user");
  const dirs = getTargetDirs(agent, scope);
  const force = opts.force || false;
  const dryRun = opts.dryRun || false;

  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();

  let toInstall = skills || [];

  if (opts.all) {
    toInstall = allSkills;
  } else if (toInstall.length === 0) {
    exitWithMessage("Usage: arcana add <skill-name> [skill-name...] or arcana add --all", {
      color: "yellow",
      steps: [
        "Run `arcana list` to see available skills and agents.",
        "Try `arcana add deep-fix --scope project` for a single install.",
      ],
    });
  }

  // Separate skills from agents
  const skillNames = toInstall.filter((s) => allSkills.includes(s));
  const agentNames = toInstall.filter((s) => allAgents.includes(s));

  // If user passed names that are neither skill nor agent, warn
  const unknown = toInstall.filter(
    (s) => !allSkills.includes(s) && !allAgents.includes(s)
  );
  for (const u of unknown) {
    console.error(chalk.yellow(`  ? Unknown skill: ${u}`));
  }

  if (skillNames.length === 0 && agentNames.length === 0) {
    printNextSteps(
      [
        "Run `arcana list` to see the shipped names.",
        "Use `arcana import <source>` if the skill is external and not part of Arcana.",
      ],
      { stream: "error" },
    );
    process.exit(1);
  }

  // Install skills
  let installedSkills = 0;
  if (skillNames.length > 0) {
    const results = copySkills(skillNames, dirs.skills, { force, dryRun });
    for (const r of results) {
      if (r.status === "installed") {
        console.log(chalk.green(`  ${dryRun ? "↳ Would install" : "✓"} ${r.name}`));
        installedSkills++;
      } else if (r.status === "updated") {
        console.log(chalk.green(`  ${dryRun ? "↳ Would update" : "✓"} ${r.name}${dryRun ? "" : " updated"}`));
        installedSkills++;
      } else if (r.status === "current") {
        console.log(chalk.dim(`  · ${r.name} already current`));
      } else if (r.status === "conflict") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (you have a custom skill with this name)`));
        console.log(chalk.dim(`    Use --force to override, or rename your skill first.`));
      } else if (r.status === "modified") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (Arcana-managed skill has local edits)`));
        console.log(chalk.dim(`    Use --force to restore the packaged version.`));
      } else if (r.status === "legacy") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (legacy Arcana install cannot be safely diffed)`));
        console.log(chalk.dim(`    Use --force to refresh it to the packaged version.`));
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }

    // Multi-agent: also mirror
    if (agent === "multi" && dirs.mirrors) {
      mirrorSkills(dirs.skills, dirs.mirrors, { dryRun });
      console.log(chalk.dim(`  ↳ ${dryRun ? "Would mirror" : "Mirrored"} to agent-specific directories`));
    }
  }

  // Install agents (either explicitly named or all when --all)
  let installedAgents = 0;
  const agentsToInstall = opts.all ? allAgents : agentNames;
  if (agentsToInstall.length > 0 && dirs.agents) {
    const results = copyAgents(agentsToInstall, dirs.agents, { force, dryRun });
    for (const r of results) {
      if (r.status === "installed") {
        console.log(chalk.green(`  ${dryRun ? "↳ Would install" : "✓"} ${r.name} (agent)`));
        installedAgents++;
      } else if (r.status === "updated") {
        console.log(chalk.green(`  ${dryRun ? "↳ Would update" : "✓"} ${r.name} (agent)${dryRun ? "" : " updated"}`));
        installedAgents++;
      } else if (r.status === "current") {
        console.log(chalk.dim(`  · ${r.name} (agent) already current`));
      } else if (r.status === "conflict") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (you have a custom agent with this name)`));
        console.log(chalk.dim(`    Use --force to override, or rename your agent first.`));
      } else if (r.status === "modified") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (Arcana-managed agent has local edits)`));
        console.log(chalk.dim(`    Use --force to restore the packaged version.`));
      } else if (r.status === "legacy") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — skipped (legacy Arcana agent cannot be safely diffed)`));
        console.log(chalk.dim(`    Use --force to refresh it to the packaged version.`));
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }
  }

  if (dryRun) {
    console.log(chalk.bold(`\n✦ Dry run complete. ${installedSkills} skill(s) and ${installedAgents} agent(s) would change.\n`));
  }
}
