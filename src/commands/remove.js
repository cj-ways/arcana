import chalk from "chalk";
import fsExtra from "fs-extra";
const { removeSync, existsSync } = fsExtra;
import { join } from "path";
import { getAvailableAgents, getAllInstallLocations } from "../utils/paths.js";
import { exitWithMessage, printNextSteps } from "../utils/cli-errors.js";

export async function runRemove(skills, opts = {}) {
  if (!skills || skills.length === 0) {
    exitWithMessage("Usage: arcana remove <skill-name> [skill-name...]", {
      color: "yellow",
      steps: [
        "Run `arcana list --scope all` to see what is installed.",
        "Try `arcana remove deep-fix --scope project` for a project install.",
      ],
    });
  }

  const allAgents = getAvailableAgents();
  const scope = opts.scope || "project";
  const { skills: skillLocs, agents: agentLocs } = getAllInstallLocations({ scope });
  const searchDirs = skillLocs.map((l) => l.dir);
  const agentDirs = agentLocs.map((l) => l.dir);

  let anyRemoved = false;

  for (const name of skills) {
    let removed = false;

    // Try as skill (built-in or imported)
    for (const dir of searchDirs) {
      const target = join(dir, name);
      const skillMd = join(target, "SKILL.md");
      if (existsSync(skillMd)) {
        removeSync(target);
        console.log(chalk.green(`  ✓ Removed ${name} from ${dir}`));
        removed = true;
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
      console.error(chalk.yellow(`  - ${name} not found in any location`));
    }

    if (removed) anyRemoved = true;
  }

  if (!anyRemoved) {
    printNextSteps(
      [
        "Run `arcana list --scope all` to confirm the installed name and scope.",
        "If the skill was imported or installed elsewhere, retry with `--scope all`.",
      ],
      { stream: "error" },
    );
    process.exit(1);
  }
}
