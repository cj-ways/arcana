import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import {
  getAvailableSkills,
  getAvailableAgents,
  getPackageMigrationsPath,
  getAllInstallLocations,
} from "../utils/paths.js";
import { copySkills, copyAgents } from "../utils/copy.js";
import { loadMigrations, applyMigrations } from "../utils/migrations.js";
import { getImportRefreshCommand, listImportedSkillsInDir } from "../utils/import-metadata.js";
import { printNextSteps } from "../utils/cli-errors.js";
import { runSync } from "./sync.js";

export async function runUpdate(opts = {}) {
  const cwd = process.cwd();
  const scope = opts.scope || "project";
  const force = opts.force || false;
  const { skills: skillLocs, agents: agentLocs } = getAllInstallLocations({ scope });

  // Build locations with paired skills + agents dirs
  const locations = skillLocs.map((sl) => {
    const matchingAgent = agentLocs.find((al) => al.level === sl.level);
    return { label: sl.label, skills: sl.dir, agents: matchingAgent ? matchingAgent.dir : null };
  });

  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();
  let updated = 0;
  let current = 0;
  let modified = 0;
  let legacy = 0;
  let managedFound = 0;
  let importedFound = 0;

  console.log(chalk.bold("\n✦ Arcana Update\n"));

  // Apply migrations before updating
  const migrationsPath = getPackageMigrationsPath();
  const migrations = loadMigrations(migrationsPath);
  if (migrations.length > 0) {
    const migrated = applyMigrations(locations, migrations);
    if (migrated > 0) {
      console.log(chalk.dim(`  ${migrated} migration(s) applied.\n`));
    }
  }

  for (const loc of locations) {
    const installed = existsSync(loc.skills)
      ? allSkills.filter((s) => existsSync(join(loc.skills, s, "SKILL.md")))
      : [];
    const installedAgents = loc.agents && existsSync(loc.agents)
      ? allAgents.filter((a) => existsSync(join(loc.agents, `${a}.md`)))
      : [];

    if (installed.length === 0 && installedAgents.length === 0) continue;

    console.log(chalk.dim(`  ${loc.label}:`));

    const results = installed.length > 0
      ? copySkills(installed, loc.skills, { force, refreshLegacy: true })
      : [];

    for (const r of results) {
      if (r.status === "updated") {
        const suffix = r.reason === "legacy"
          ? " (legacy install refreshed)"
          : r.reason === "metadata"
            ? " (metadata refreshed)"
            : "";
        console.log(chalk.green(`    ✓ ${r.name} updated${suffix}`));
        updated++;
        managedFound++;
      } else if (r.status === "current") {
        console.log(chalk.dim(`    · ${r.name} already current`));
        current++;
        managedFound++;
      } else if (r.status === "modified") {
        console.log(chalk.yellow(`    ⚠ ${r.name} skipped — local edits detected`));
        console.log(chalk.dim("      Run `arcana update --force` to restore the packaged version."));
        modified++;
        managedFound++;
      } else if (r.status === "legacy") {
        console.log(chalk.yellow(`    ⚠ ${r.name} skipped — legacy Arcana install cannot be safely diffed`));
        console.log(chalk.dim("      Run `arcana update --force` to refresh it to the packaged version."));
        legacy++;
        managedFound++;
      } else if (r.status === "conflict") {
        console.log(chalk.yellow(`    ⚠ ${r.name} skipped — custom skill detected (not Arcana-managed)`));
      }
    }

    // Update agents
    if (installedAgents.length > 0 && loc.agents) {
      const agentResults = copyAgents(installedAgents, loc.agents, { force, refreshLegacy: true });
      for (const r of agentResults) {
        if (r.status === "updated") {
          const suffix = r.reason === "legacy"
            ? " (legacy install refreshed)"
            : r.reason === "metadata"
              ? " (metadata refreshed)"
              : "";
          console.log(chalk.green(`    ✓ ${r.name} (agent) updated${suffix}`));
          updated++;
          managedFound++;
        } else if (r.status === "current") {
          console.log(chalk.dim(`    · ${r.name} (agent) already current`));
          current++;
          managedFound++;
        } else if (r.status === "modified") {
          console.log(chalk.yellow(`    ⚠ ${r.name} (agent) skipped — local edits detected`));
          console.log(chalk.dim("      Run `arcana update --force` to restore the packaged version."));
          modified++;
          managedFound++;
        } else if (r.status === "legacy") {
          console.log(chalk.yellow(`    ⚠ ${r.name} (agent) skipped — legacy Arcana install cannot be safely diffed`));
          console.log(chalk.dim("      Run `arcana update --force` to refresh it to the packaged version."));
          legacy++;
          managedFound++;
        } else if (r.status === "conflict") {
          console.log(chalk.yellow(`    ⚠ ${r.name} (agent) skipped — custom agent detected`));
        }
      }
    }
  }

  if (managedFound === 0) {
    console.log(chalk.yellow("  No installed arcana skills found to update."));
    printNextSteps(
      [
        "Run `arcana init` for a full setup, or `arcana add <skill>` for a targeted install.",
        "Use `arcana list --scope all` if you expected an existing install in a different scope.",
      ],
      { stream: "log" },
    );
  } else if (updated === 0 && modified === 0 && legacy === 0) {
    console.log(chalk.green("  All installed Arcana files are already current."));
  } else {
    console.log(chalk.bold(`\n✦ ${updated} item${updated === 1 ? "" : "s"} updated.`));
    if (current > 0) {
      console.log(chalk.dim(`  ${current} already current.`));
    }
    if (modified > 0) {
      console.log(chalk.yellow(`  ${modified} skipped due to local edits.`));
    }
    if (legacy > 0) {
      console.log(chalk.yellow(`  ${legacy} legacy install${legacy === 1 ? "" : "s"} require --force to refresh.`));
    }
    console.log();
  }

  for (const loc of locations) {
    if (!loc.skills || !existsSync(loc.skills)) continue;

    const importedSkills = listImportedSkillsInDir(loc.skills);
    if (importedSkills.length === 0) continue;

    if (importedFound === 0) {
      console.log(chalk.dim("  Imported skills are not updated by package refresh:\n"));
    }

    importedFound += importedSkills.length;
    console.log(chalk.dim(`  ${loc.label}:`));

    for (const imported of importedSkills) {
      const sourceRef = imported.metadata?.source?.ref || imported.attribution || "unknown";
      if (imported.trustState === "current") {
        console.log(chalk.dim(`    · ${imported.name} imported from ${sourceRef}`));
      } else if (imported.trustState === "modified-locally") {
        console.log(chalk.yellow(`    ⚠ ${imported.name} modified since import — ${sourceRef}`));
      } else {
        console.log(chalk.yellow(`    ⚠ ${imported.name} legacy import missing provenance metadata`));
      }

      const refreshCommand = getImportRefreshCommand(imported.metadata, imported.name);
      if (refreshCommand) {
        console.log(chalk.dim(`      Review before overwrite: ${refreshCommand}`));
      }
    }
  }

  if (importedFound > 0) {
    console.log();
  }

  // Trigger sync if multi-agent mode is active
  const canonical = join(cwd, ".agents", "skills");
  if (scope !== "user" && existsSync(canonical) && updated > 0) {
    console.log(chalk.dim("  Syncing multi-agent mirrors...\n"));
    await runSync({ clean: true });
  }
}
