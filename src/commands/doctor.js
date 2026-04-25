import chalk from "chalk";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getAvailableSkills, getAvailableAgents, getPackageSkillsDir, getPackageAgentsDir, getAllInstallLocations } from "../utils/paths.js";
import { getManagedContentHash } from "../utils/copy.js";
import { getImportRefreshCommand, listImportedSkillsInDir } from "../utils/import-metadata.js";
import { inspectImportedSkillAdaptation } from "../utils/import-adaptation.js";

function serializeLocation(location) {
  return {
    label: location.label,
    dir: location.dir,
    level: location.level,
  };
}

export async function runDoctor(opts = {}) {
  const asJson = Boolean(opts.json);
  const log = (...args) => {
    if (!asJson) console.log(...args);
  };
  const cwd = process.cwd();
  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();
  const scope = opts.scope || "all";

  let passes = 0;
  let warns = 0;
  let fails = 0;
  const report = {
    kind: "arcana-doctor",
    generatedAt: new Date().toISOString(),
    scope,
    skillLocations: [],
    importedSkills: [],
    agentLocations: [],
    sync: {
      checked: false,
      mirrors: [],
    },
    agentsMd: {
      checked: false,
      exists: false,
      hasArcanaBlock: false,
      status: null,
    },
    integrity: {
      checked: false,
      verifiedCount: 0,
      modifiedCount: 0,
      modifiedItems: [],
    },
    findings: [],
    summary: null,
  };
  const pushFinding = (finding) => {
    report.findings.push(finding);
  };

  log(chalk.bold("\n✦ Arcana Doctor\n"));

  // Use centralized locations
  const { skills: skillLocations, agents: agentLocations } = getAllInstallLocations({ scope });

  const foundLocations = [];

  // 1. Check each skill location
  log(chalk.dim("  Skill Locations:\n"));

  for (const loc of skillLocations) {
    const locationEntry = {
      ...serializeLocation(loc),
      exists: existsSync(loc.dir),
      installedSkills: [],
      issues: [],
      status: "missing",
    };

    if (!existsSync(loc.dir)) {
      log(chalk.gray(`  · ${loc.label} — not found`));
      report.skillLocations.push(locationEntry);
      continue;
    }

    foundLocations.push(loc);
    log(chalk.blue(`  ▸ ${loc.label}`));

    // List which arcana skills are installed
    const installed = [];
    const issues = [];

    for (const skill of allSkills) {
      const skillDir = join(loc.dir, skill);
      const skillFile = join(skillDir, "SKILL.md");

      if (!existsSync(skillDir)) continue;

      if (!existsSync(skillFile)) {
        issues.push(`${skill}: SKILL.md missing`);
        locationEntry.issues.push(`${skill}: SKILL.md missing`);
        pushFinding({
          level: "fail",
          area: "skills",
          location: serializeLocation(loc),
          subject: skill,
          message: "SKILL.md missing",
        });
        fails++;
        continue;
      }

      const stat = statSync(skillFile);
      if (stat.size === 0) {
        issues.push(`${skill}: SKILL.md is empty`);
        locationEntry.issues.push(`${skill}: SKILL.md is empty`);
        pushFinding({
          level: "fail",
          area: "skills",
          location: serializeLocation(loc),
          subject: skill,
          message: "SKILL.md is empty",
        });
        fails++;
        continue;
      }

      installed.push(skill);
      locationEntry.installedSkills.push(skill);
      passes++;
    }

    if (installed.length > 0) {
      locationEntry.status = issues.length > 0 ? "fail" : "pass";
      log(chalk.green(`    PASS  ${installed.length} skill(s): ${installed.join(", ")}`));
    }

    for (const issue of issues) {
      log(chalk.red(`    FAIL  ${issue}`));
    }

    if (installed.length === 0 && issues.length === 0) {
      locationEntry.status = "warn";
      pushFinding({
        level: "warn",
        area: "skills",
        location: serializeLocation(loc),
        message: "Directory exists but no Arcana skills found",
      });
      log(chalk.yellow(`    WARN  Directory exists but no arcana skills found`));
      warns++;
    } else if (issues.length > 0) {
      locationEntry.status = "fail";
    }

    report.skillLocations.push(locationEntry);
    log();
  }

  // 2. Check agent locations

  log(chalk.dim("  Imported Skills:\n"));

  let importedFound = 0;

  for (const loc of skillLocations) {
    if (!existsSync(loc.dir)) continue;

    const importedSkills = listImportedSkillsInDir(loc.dir);
    if (importedSkills.length === 0) continue;

    importedFound += importedSkills.length;
    log(chalk.blue(`  ▸ ${loc.label}`));

    for (const imported of importedSkills) {
      const sourceRef = imported.metadata?.source?.ref || imported.attribution || "unknown";
      const adaptation = inspectImportedSkillAdaptation(imported.skillDir);
      const importedEntry = {
        name: imported.name,
        location: serializeLocation(loc),
        sourceRef,
        trustState: imported.trustState,
        rawSnapshotPath: imported.hasRawSnapshot ? imported.rawSnapshotPath : null,
        adaptation: adaptation.available
          ? {
              status: adaptation.status,
              rawScorePercent: adaptation.rawScorePercent,
              adaptedScorePercent: adaptation.adaptedScorePercent,
              scoreDeltaPercent: adaptation.scoreDeltaPercent,
              improvedAreas: adaptation.improvedAreas,
              regressedAreas: adaptation.regressedAreas,
            }
          : {
              status: adaptation.status,
              reason: adaptation.reason,
            },
        refreshCommand: getImportRefreshCommand(imported.metadata, imported.name),
        status: imported.trustState === "current" ? "pass" : "warn",
      };
      report.importedSkills.push(importedEntry);
      if (imported.trustState === "current") {
        log(chalk.green(`    PASS  ${imported.name} — ${sourceRef}`));
        if (adaptation.available) {
          log(
            chalk.dim(
              `          Adaptation heuristic: ${adaptation.status} (${adaptation.rawScorePercent} → ${adaptation.adaptedScorePercent}, ${adaptation.scoreDeltaPercent >= 0 ? "+" : ""}${adaptation.scoreDeltaPercent}pp)`,
            ),
          );
        }
        passes++;
      } else if (imported.trustState === "modified-locally") {
        pushFinding({
          level: "warn",
          area: "imports",
          location: serializeLocation(loc),
          subject: imported.name,
          message: `Imported skill modified locally since import (${sourceRef})`,
          remediation: importedEntry.refreshCommand || null,
        });
        log(chalk.yellow(`    WARN  ${imported.name} modified since import — ${sourceRef}`));
        if (importedEntry.refreshCommand) {
          log(chalk.dim(`          Review before overwrite: ${importedEntry.refreshCommand}`));
        }
        if (adaptation.available) {
          log(
            chalk.dim(
              `          Adaptation heuristic: ${adaptation.status} (${adaptation.rawScorePercent} → ${adaptation.adaptedScorePercent}, ${adaptation.scoreDeltaPercent >= 0 ? "+" : ""}${adaptation.scoreDeltaPercent}pp)`,
            ),
          );
        }
        warns++;
      } else {
        pushFinding({
          level: "warn",
          area: "imports",
          location: serializeLocation(loc),
          subject: imported.name,
          message: `Imported skill is missing modern provenance metadata (${sourceRef})`,
        });
        log(chalk.yellow(`    WARN  ${imported.name} imported without modern provenance metadata`));
        log(chalk.dim(`          Source hint: ${sourceRef}`));
        warns++;
      }
    }

    log();
  }

  if (importedFound === 0) {
    log(chalk.gray("  · No imported skills found\n"));
  }

  // 2. Check agent locations

  log(chalk.dim("  Agent Locations:\n"));

  for (const loc of agentLocations) {
    const locationEntry = {
      ...serializeLocation(loc),
      exists: existsSync(loc.dir),
      installedAgents: [],
      issues: [],
      status: "missing",
    };

    if (!existsSync(loc.dir)) {
      log(chalk.gray(`  · ${loc.label} — not found`));
      report.agentLocations.push(locationEntry);
      continue;
    }

    log(chalk.blue(`  ▸ ${loc.label}`));

    const installed = [];
    const issues = [];

    for (const agent of allAgents) {
      const agentFile = join(loc.dir, `${agent}.md`);
      if (!existsSync(agentFile)) continue;

      const stat = statSync(agentFile);
      if (stat.size === 0) {
        issues.push(`${agent}.md is empty`);
        locationEntry.issues.push(`${agent}.md is empty`);
        pushFinding({
          level: "fail",
          area: "agents",
          location: serializeLocation(loc),
          subject: agent,
          message: "agent file is empty",
        });
        fails++;
        continue;
      }

      installed.push(agent);
      locationEntry.installedAgents.push(agent);
      passes++;
    }

    if (installed.length > 0) {
      locationEntry.status = issues.length > 0 ? "fail" : "pass";
      log(chalk.green(`    PASS  ${installed.length} agent(s): ${installed.join(", ")}`));
    }

    for (const issue of issues) {
      log(chalk.red(`    FAIL  ${issue}`));
    }

    if (installed.length === 0 && issues.length === 0) {
      locationEntry.status = "warn";
      pushFinding({
        level: "warn",
        area: "agents",
        location: serializeLocation(loc),
        message: "Directory exists but no Arcana agents found",
      });
      log(chalk.yellow(`    WARN  Directory exists but no arcana agents found`));
      warns++;
    } else if (issues.length > 0) {
      locationEntry.status = "fail";
    }

    report.agentLocations.push(locationEntry);
    log();
  }

  // 3. Multi-agent mirror sync check
  const canonical = join(cwd, ".agents", "skills");
  const mirrors = [
    join(cwd, ".claude", "skills"),
  ];

  if (scope !== "user" && existsSync(canonical)) {
    report.sync.checked = true;
    log(chalk.dim("  Multi-Agent Sync:\n"));

    for (const mirror of mirrors) {
      if (!existsSync(mirror)) continue;

      const mirrorLabel = mirror.replace(cwd + "/", "");
      let inSync = true;
      const syncEntry = {
        label: mirrorLabel,
        dir: mirror,
        exists: true,
        missingSkills: [],
        outOfSyncSkills: [],
        status: "pass",
      };

      for (const skill of allSkills) {
        const canonicalFile = join(canonical, skill, "SKILL.md");
        const mirrorFile = join(mirror, skill, "SKILL.md");

        if (!existsSync(canonicalFile)) continue;

        if (!existsSync(mirrorFile)) {
          syncEntry.status = "fail";
          syncEntry.missingSkills.push(skill);
          pushFinding({
            level: "fail",
            area: "sync",
            location: { label: mirrorLabel, dir: mirror, level: "project" },
            subject: skill,
            message: "Mirror skill missing",
          });
          log(chalk.red(`    FAIL  ${skill} missing in ${mirrorLabel}`));
          fails++;
          inSync = false;
          continue;
        }

        const canonicalContent = readFileSync(canonicalFile, "utf-8");
        const mirrorContent = readFileSync(mirrorFile, "utf-8");

        if (canonicalContent !== mirrorContent) {
          if (syncEntry.status !== "fail") syncEntry.status = "warn";
          syncEntry.outOfSyncSkills.push(skill);
          pushFinding({
            level: "warn",
            area: "sync",
            location: { label: mirrorLabel, dir: mirror, level: "project" },
            subject: skill,
            message: "Mirror skill out of sync",
          });
          log(chalk.yellow(`    WARN  ${skill} out of sync in ${mirrorLabel}`));
          warns++;
          inSync = false;
        }
      }

      if (inSync) {
        log(chalk.green(`    PASS  ${mirrorLabel} is in sync with .agents/skills/`));
        passes++;
      }

      report.sync.mirrors.push(syncEntry);
    }

    log();
  }

  // 4. Check AGENTS.md for skill discovery block
  if (scope !== "user" && existsSync(canonical)) {
    report.agentsMd.checked = true;
    log(chalk.dim("  AGENTS.md:\n"));

    const agentsMdPath = join(cwd, "AGENTS.md");
    if (!existsSync(agentsMdPath)) {
      report.agentsMd.exists = false;
      report.agentsMd.status = "warn";
      pushFinding({
        level: "warn",
        area: "agents-md",
        message: "AGENTS.md not found",
        remediation: "Run `arcana sync` or add the discovery block manually.",
      });
      log(chalk.yellow(`    WARN  AGENTS.md not found (recommended for .agents/skills/)`));
      warns++;
    } else {
      const content = readFileSync(agentsMdPath, "utf-8");
      report.agentsMd.exists = true;
      if (content.includes("Agent Skills (Arcana)")) {
        report.agentsMd.hasArcanaBlock = true;
        report.agentsMd.status = "pass";
        log(chalk.green(`    PASS  AGENTS.md has arcana skill discovery block`));
        passes++;
      } else {
        report.agentsMd.hasArcanaBlock = false;
        report.agentsMd.status = "warn";
        pushFinding({
          level: "warn",
          area: "agents-md",
          message: "AGENTS.md missing Arcana skill discovery block",
          remediation: "Run `arcana sync` or add the block manually.",
        });
        log(chalk.yellow(`    WARN  AGENTS.md missing arcana skill discovery block`));
        log(chalk.dim(`          Run \`arcana sync\` or add the block manually`));
        warns++;
      }
    }

    log();
  }

  // 5. Integrity check — compare installed skills against package source
  if (foundLocations.length > 0) {
    report.integrity.checked = true;
    log(chalk.dim("  Integrity:\n"));

    const sourceSkillsDir = getPackageSkillsDir();
    const sourceAgentsDir = getPackageAgentsDir();
    let modified = 0;
    let verified = 0;

    function hash(content) {
      return getManagedContentHash(content).slice(0, 12);
    }

    // Cache source hashes once to avoid re-reading in nested loops
    const sourceSkillHashes = {};
    for (const skill of allSkills) {
      const src = join(sourceSkillsDir, skill, "SKILL.md");
      if (existsSync(src)) sourceSkillHashes[skill] = hash(readFileSync(src, "utf-8"));
    }
    const sourceAgentHashes = {};
    for (const agent of allAgents) {
      const src = join(sourceAgentsDir, `${agent}.md`);
      if (existsSync(src)) sourceAgentHashes[agent] = hash(readFileSync(src, "utf-8"));
    }

    for (const loc of foundLocations) {
      for (const skill of allSkills) {
        if (!sourceSkillHashes[skill]) continue;
        const installedFile = join(loc.dir, skill, "SKILL.md");
        if (!existsSync(installedFile)) continue;

        const installedHash = hash(readFileSync(installedFile, "utf-8"));

        if (sourceSkillHashes[skill] !== installedHash) {
          report.integrity.modifiedItems.push({
            subjectType: "skill",
            name: skill,
            location: serializeLocation(loc),
          });
          pushFinding({
            level: "warn",
            area: "integrity",
            location: serializeLocation(loc),
            subject: skill,
            message: "Managed skill modified locally",
            remediation: "Run `arcana update` to refresh unchanged installs or `arcana update --force` to restore packaged versions.",
          });
          log(chalk.yellow(`    WARN  ${skill} modified locally in ${loc.label}`));
          warns++;
          modified++;
        } else {
          verified++;
        }
      }
    }

    for (const loc of agentLocations) {
      if (!existsSync(loc.dir)) continue;
      for (const agent of allAgents) {
        if (!sourceAgentHashes[agent]) continue;
        const installedFile = join(loc.dir, `${agent}.md`);
        if (!existsSync(installedFile)) continue;

        const installedHash = hash(readFileSync(installedFile, "utf-8"));

        if (sourceAgentHashes[agent] !== installedHash) {
          report.integrity.modifiedItems.push({
            subjectType: "agent",
            name: agent,
            location: serializeLocation(loc),
          });
          pushFinding({
            level: "warn",
            area: "integrity",
            location: serializeLocation(loc),
            subject: agent,
            message: "Managed agent modified locally",
            remediation: "Run `arcana update` to refresh unchanged installs or `arcana update --force` to restore packaged versions.",
          });
          log(chalk.yellow(`    WARN  ${agent} agent modified locally in ${loc.label}`));
          warns++;
          modified++;
        } else {
          verified++;
        }
      }
    }

    report.integrity.verifiedCount = verified;
    report.integrity.modifiedCount = modified;

    if (modified === 0 && verified > 0) {
      log(chalk.green(`    PASS  ${verified} file(s) match package source`));
      passes++;
    } else if (modified > 0) {
      log(chalk.dim(`\n    ${verified} file(s) match, ${modified} modified locally`));
      log(chalk.dim("    Run `arcana update` to refresh unchanged managed installs."));
      log(chalk.dim("    Run `arcana update --force` to restore packaged versions over local edits."));
    }

    log();
  }

  // 6. Summary
  report.summary = {
    passCount: passes,
    warnCount: warns,
    failCount: fails,
    exitCode: fails > 0 ? 1 : 0,
  };
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    if (fails > 0) {
      process.exit(1);
    }
    return;
  }

  console.log(chalk.bold("  Summary:\n"));
  console.log(chalk.green(`    ${passes} PASS`) + chalk.yellow(`  ${warns} WARN`) + chalk.red(`  ${fails} FAIL`));

  if (fails > 0) {
    console.log(chalk.red(`\n  Some checks failed. Run \`arcana update\` to fix missing/empty files.\n`));
    process.exit(1);
  } else if (warns > 0) {
    console.log(chalk.yellow(`\n  Some warnings found. Run \`arcana sync\` if mirrors are out of sync.\n`));
  } else if (passes === 0) {
    console.log(chalk.dim(`\n  No arcana skills found. Run \`arcana init\` to get started.\n`));
  } else {
    console.log(chalk.green(`\n  All checks passed.\n`));
  }
}
