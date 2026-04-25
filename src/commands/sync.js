import chalk from "chalk";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import fsExtra from "fs-extra";
const { copySync, ensureDirSync, removeSync } = fsExtra;
import { parseArcanaMarker } from "../utils/copy.js";
import { createVerboseLogger } from "../utils/verbosity.js";

export { appendAgentsMdBlock } from "../utils/agents-md.js";

export async function runSync(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const logger = createVerboseLogger(opts);
  const cwd = process.cwd();
  const canonical = join(cwd, ".agents", "skills");

  if (!existsSync(canonical)) {
    console.error(
      chalk.yellow(
        "No .agents/skills/ directory found. Run `arcana init` with multi-agent mode first."
      )
    );
    process.exit(1);
  }

  console.log(chalk.bold("\n✦ Arcana Sync\n"));
  logger.field("canonical dir", canonical);
  logger.field("dry run", dryRun);
  logger.field("clean mode", Boolean(opts.clean));
  if (dryRun) {
    console.log(chalk.dim("Dry run mode: previewing sync only. No files will be written.\n"));
  }

  // Smart mirror targets: only sync to directories whose parent exists
  const possibleTargets = [
    { dir: join(cwd, ".claude", "skills"), parent: join(cwd, ".claude") },
  ];
  logger.field("candidate targets", possibleTargets);
  let targets = possibleTargets
    .filter(t => existsSync(t.parent))
    .map(t => t.dir);

  // If no targets exist, always create .claude/skills/ as minimum default
  if (targets.length === 0) {
    targets = [join(cwd, ".claude", "skills")];
    logger.line("No existing mirror parents found; defaulting to .claude/skills");
  }
  logger.field("selected targets", targets);

  for (const target of targets) {
    logger.field("sync target", target);
    if (!dryRun) {
      ensureDirSync(target);
      copySync(canonical, target, { overwrite: true });
    }
    const rel = relative(cwd, target);
    console.log(chalk.green(`  ${dryRun ? "↳ Would sync" : "✓"} ${rel} ← .agents/skills/`));
  }

  // --clean: remove stale Arcana-managed skills from mirrors that don't exist in canonical
  if (opts.clean) {
    console.log(chalk.dim("\n  Cleaning stale skills...\n"));
    const canonicalSkills = readdirSync(canonical).filter(name =>
      existsSync(join(canonical, name, "SKILL.md"))
    );
    logger.field("canonical skill names", canonicalSkills);
    let cleaned = 0;

    for (const target of targets) {
      if (!existsSync(target)) {
        logger.field("skipping clean target", `${target} (mirror directory does not exist yet)`);
        continue;
      }
      const mirrorEntries = readdirSync(target);
      logger.field("mirror entries", { target, entries: mirrorEntries });
      for (const entry of mirrorEntries) {
        if (!canonicalSkills.includes(entry)) {
          const stale = join(target, entry);
          // Only remove Arcana-managed skill entries — preserve everything else
          const skillMd = join(stale, "SKILL.md");
          if (!existsSync(skillMd)) {
            logger.field("preserving entry", `${stale} (not a skill directory)`);
            continue; // not a skill dir — preserve
          }
          const content = readFileSync(skillMd, "utf-8");
          if (!parseArcanaMarker(content)) {
            logger.field("preserving entry", `${stale} (not Arcana-managed)`);
            continue;
          }
          if (!dryRun) {
            removeSync(stale);
          }
          const rel = relative(cwd, stale);
          console.log(chalk.yellow(`  ${dryRun ? "↳ Would remove stale" : "✗ Removed stale:"} ${rel}`));
          cleaned++;
        }
      }
    }

    if (cleaned === 0) {
      console.log(chalk.dim("  No stale skills found."));
    } else {
      console.log(chalk.dim(`\n  ${dryRun ? "Would clean" : "Cleaned"} ${cleaned} stale skill(s).`));
    }
  }

  console.log(chalk.bold(`\n✦ ${dryRun ? "Dry run complete" : "Sync complete"}.\n`));
}
