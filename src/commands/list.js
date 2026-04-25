import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import { getAvailableSkills, getAvailableAgents, getAllInstallLocations } from "../utils/paths.js";
import { listImportedSkillsInDir } from "../utils/import-metadata.js";

function serializeLocation(location) {
  return {
    label: location.label,
    dir: location.dir,
    level: location.level,
  };
}

export async function runList(opts = {}) {
  const asJson = Boolean(opts.json);
  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();
  const { skills: locations, agents: agentLocations } = getAllInstallLocations({ scope: opts.scope || "all" });
  const importedSkills = [];

  for (const loc of locations) {
    for (const imported of listImportedSkillsInDir(loc.dir)) {
      importedSkills.push({
        name: imported.name,
        location: serializeLocation(loc),
        sourceRef: imported.metadata?.source?.ref || imported.attribution || null,
        trustState: imported.trustState,
        importedAt: imported.metadata?.importedAt || null,
        arcanaVersion: imported.metadata?.arcanaVersion || null,
        checksum: imported.currentChecksum,
      });
    }
  }

  const report = {
    kind: "arcana-list",
    generatedAt: new Date().toISOString(),
    scope: opts.scope || "all",
    skills: allSkills.map((name) => {
      const installedLocations = locations
        .filter((loc) => existsSync(join(loc.dir, name, "SKILL.md")))
        .map(serializeLocation);
      return {
        name,
        installed: installedLocations.length > 0,
        locations: installedLocations,
      };
    }),
    agents: allAgents.map((name) => {
      const installedLocations = agentLocations
        .filter((loc) => existsSync(join(loc.dir, `${name}.md`)))
        .map(serializeLocation);
      return {
        name,
        installed: installedLocations.length > 0,
        locations: installedLocations,
      };
    }),
    importedSkills,
    counts: {
      skillCount: allSkills.length,
      installedSkillCount: allSkills.filter((name) => locations.some((loc) => existsSync(join(loc.dir, name, "SKILL.md")))).length,
      agentCount: allAgents.length,
      installedAgentCount: allAgents.filter((name) => agentLocations.some((loc) => existsSync(join(loc.dir, `${name}.md`)))).length,
      importedSkillCount: importedSkills.length,
    },
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.bold("\n✦ Arcana Skills\n"));

  console.log(chalk.dim("  Skills:"));
  for (const skill of report.skills) {
    if (skill.installed) {
      console.log(
        chalk.green(`  ✓ ${skill.name.padEnd(22)} `) +
          chalk.dim(skill.locations.map((loc) => loc.label).join(", "))
      );
    } else {
      console.log(chalk.gray(`  · ${skill.name.padEnd(22)} not installed`));
    }
  }

  console.log(chalk.dim("\n  Agents:"));
  for (const agent of report.agents) {
    if (agent.installed) {
      console.log(
        chalk.green(`  ✓ ${agent.name.padEnd(22)} `) +
          chalk.dim(agent.locations.map((loc) => loc.label).join(", "))
      );
    } else {
      console.log(chalk.gray(`  · ${agent.name.padEnd(22)} not installed`));
    }
  }

  if (report.importedSkills.length > 0) {
    console.log(chalk.dim("\n  Imported Skills:"));
    for (const imported of report.importedSkills) {
      const status = imported.trustState === "current"
        ? chalk.green("current")
        : chalk.yellow(imported.trustState);
      console.log(
        chalk.green(`  ✓ ${imported.name.padEnd(22)} `) +
        chalk.dim(`${imported.location.label} · `) +
        status +
        chalk.dim(` · ${imported.sourceRef || "unknown"}`),
      );
    }
  }

  console.log();
}
