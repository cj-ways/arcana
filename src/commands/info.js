import chalk from "chalk";
import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve, sep } from "path";
import {
  getPackageSkillsDir,
  getPackageAgentsDir,
  getAvailableSkills,
  getAvailableAgents,
  getAllInstallLocations,
} from "../utils/paths.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { findImportedSkillAcrossLocations } from "../utils/import-metadata.js";
import { inspectImportedSkillAdaptation } from "../utils/import-adaptation.js";
import { printNextSteps } from "../utils/cli-errors.js";

function serializeLocation(location) {
  if (!location) return null;
  return {
    label: location.label,
    dir: location.dir,
    level: location.level,
  };
}

export async function runInfo(skill, opts = {}) {
  const skillsDir = getPackageSkillsDir();
  const agentsDir = getPackageAgentsDir();
  const installLocations = getAllInstallLocations({ scope: "all" }).skills;

  // Try as skill first (with path traversal guard)
  const skillPath = resolve(join(skillsDir, skill, "SKILL.md"));
  // Try as agent
  const agentPath = resolve(join(agentsDir, `${skill}.md`));

  let filePath = null;
  let type = null;

  if (skillPath.startsWith(skillsDir + sep) && existsSync(skillPath)) {
    filePath = skillPath;
    type = "skill";
  } else if (agentPath.startsWith(agentsDir + sep) && existsSync(agentPath)) {
    filePath = agentPath;
    type = "agent";
  }

  const importedSkill = !filePath
    ? findImportedSkillAcrossLocations(skill, installLocations)
    : null;

  if (!filePath && importedSkill) {
    filePath = importedSkill.skillPath;
    type = "imported skill";
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
    printNextSteps(
      [
        "Run `arcana list` to see installed and available items together.",
        "Use `arcana import <source>` first if this is an external skill that is not installed yet.",
      ],
      { stream: "error" },
    );
    console.error();
    process.exit(1);
  }

  const content = readFileSync(filePath, "utf-8");
  const stat = statSync(filePath);
  const meta = parseFrontmatter(content);
  const lineCount = content.split("\n").length;
  const sizeKb = (stat.size / 1024).toFixed(1);
  const report = {
    kind: "arcana-info",
    generatedAt: new Date().toISOString(),
    query: skill,
    type,
    name: meta.name || skill,
    description: meta.description || null,
    argumentHint: meta["argument-hint"] || null,
    lines: lineCount,
    sizeKb: Number(sizeKb),
    source: filePath,
  };

  if (importedSkill) {
    const adaptation = inspectImportedSkillAdaptation(importedSkill.skillDir);
    report.installLocation = serializeLocation(importedSkill.location);
    report.provenance = importedSkill.metadata?.source?.ref || importedSkill.attribution || null;
    report.importedAt = importedSkill.metadata?.importedAt || null;
    report.arcanaVersion = importedSkill.metadata?.arcanaVersion || null;
    report.trustState = importedSkill.trustState;
    report.checksum = importedSkill.currentChecksum;
    report.rawSnapshotPath = importedSkill.hasRawSnapshot
      ? importedSkill.rawSnapshotPath
      : null;
    report.adaptation = adaptation.available
      ? {
          status: adaptation.status,
          rawScore: adaptation.rawScore,
          rawScorePercent: adaptation.rawScorePercent,
          adaptedScore: adaptation.adaptedScore,
          adaptedScorePercent: adaptation.adaptedScorePercent,
          scoreDelta: adaptation.scoreDelta,
          scoreDeltaPercent: adaptation.scoreDeltaPercent,
          improvedAreas: adaptation.improvedAreas,
          regressedAreas: adaptation.regressedAreas,
        }
      : {
          status: adaptation.status,
          reason: adaptation.reason,
        };
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

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

  if (importedSkill) {
    const adaptation = report.adaptation;
    console.log(chalk.dim(`  Install:      `) + importedSkill.location.label);
    console.log(chalk.dim(`  Provenance:   `) + (importedSkill.metadata?.source?.ref || importedSkill.attribution || "(legacy import)"));
    console.log(chalk.dim(`  Imported At:  `) + (importedSkill.metadata?.importedAt || "(unknown)"));
    console.log(chalk.dim(`  Arcana Ver:   `) + (importedSkill.metadata?.arcanaVersion || "(unknown)"));
    console.log(chalk.dim(`  Trust State:  `) + importedSkill.trustState);
    console.log(chalk.dim(`  Checksum:     `) + importedSkill.currentChecksum.slice(0, 12));
    console.log(
      chalk.dim(`  Raw Snapshot: `)
        + (importedSkill.hasRawSnapshot ? importedSkill.rawSnapshotPath : "(not preserved)"),
    );

    if (adaptation?.status === "improved" || adaptation?.status === "unchanged" || adaptation?.status === "regressed") {
      console.log(
        chalk.dim(`  Adaptation:   `)
          + `${adaptation.status} (${adaptation.rawScorePercent} → ${adaptation.adaptedScorePercent}, ${adaptation.scoreDeltaPercent >= 0 ? "+" : ""}${adaptation.scoreDeltaPercent}pp heuristic)`,
      );
      if (adaptation.improvedAreas?.length > 0) {
        console.log(
          chalk.dim(`  Improved:     `)
            + adaptation.improvedAreas.join(", "),
        );
      }
      if (adaptation.regressedAreas?.length > 0) {
        console.log(
          chalk.dim(`  Regressed:    `)
            + adaptation.regressedAreas.join(", "),
        );
      }
    }
  }

  console.log();
}
