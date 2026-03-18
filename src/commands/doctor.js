import chalk from "chalk";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getAvailableSkills, getAvailableAgents } from "../utils/paths.js";

export async function runDoctor() {
  const cwd = process.cwd();
  const home = homedir();
  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();

  let passes = 0;
  let warns = 0;
  let fails = 0;

  console.log(chalk.bold("\n✦ Arcana Doctor\n"));

  // Define all locations to check
  const skillLocations = [
    { label: ".claude/skills/ (project)", dir: join(cwd, ".claude", "skills"), level: "project" },
    { label: ".agents/skills/ (project)", dir: join(cwd, ".agents", "skills"), level: "project" },
    { label: ".cursor/skills/ (project)", dir: join(cwd, ".cursor", "skills"), level: "project" },
    { label: ".gemini/skills/ (project)", dir: join(cwd, ".gemini", "skills"), level: "project" },
    { label: "~/.claude/skills/ (user)", dir: join(home, ".claude", "skills"), level: "user" },
    { label: "~/.agents/skills/ (user)", dir: join(home, ".agents", "skills"), level: "user" },
  ];

  const foundLocations = [];

  // 1. Check each skill location
  console.log(chalk.dim("  Skill Locations:\n"));

  for (const loc of skillLocations) {
    if (!existsSync(loc.dir)) {
      console.log(chalk.gray(`  · ${loc.label} — not found`));
      continue;
    }

    foundLocations.push(loc);
    console.log(chalk.blue(`  ▸ ${loc.label}`));

    // List which arcana skills are installed
    const installed = [];
    const issues = [];

    for (const skill of allSkills) {
      const skillDir = join(loc.dir, skill);
      const skillFile = join(skillDir, "SKILL.md");

      if (!existsSync(skillDir)) continue;

      if (!existsSync(skillFile)) {
        issues.push(`${skill}: SKILL.md missing`);
        fails++;
        continue;
      }

      const stat = statSync(skillFile);
      if (stat.size === 0) {
        issues.push(`${skill}: SKILL.md is empty`);
        fails++;
        continue;
      }

      installed.push(skill);
      passes++;
    }

    if (installed.length > 0) {
      console.log(chalk.green(`    PASS  ${installed.length} skill(s): ${installed.join(", ")}`));
    }

    for (const issue of issues) {
      console.log(chalk.red(`    FAIL  ${issue}`));
    }

    if (installed.length === 0 && issues.length === 0) {
      console.log(chalk.yellow(`    WARN  Directory exists but no arcana skills found`));
      warns++;
    }

    console.log();
  }

  // 2. Check agent locations
  const agentLocations = [
    { label: ".claude/agents/ (project)", dir: join(cwd, ".claude", "agents") },
    { label: "~/.claude/agents/ (user)", dir: join(home, ".claude", "agents") },
  ];

  console.log(chalk.dim("  Agent Locations:\n"));

  for (const loc of agentLocations) {
    if (!existsSync(loc.dir)) {
      console.log(chalk.gray(`  · ${loc.label} — not found`));
      continue;
    }

    console.log(chalk.blue(`  ▸ ${loc.label}`));

    const installed = [];
    const issues = [];

    for (const agent of allAgents) {
      const agentFile = join(loc.dir, `${agent}.md`);
      if (!existsSync(agentFile)) continue;

      const stat = statSync(agentFile);
      if (stat.size === 0) {
        issues.push(`${agent}.md is empty`);
        fails++;
        continue;
      }

      installed.push(agent);
      passes++;
    }

    if (installed.length > 0) {
      console.log(chalk.green(`    PASS  ${installed.length} agent(s): ${installed.join(", ")}`));
    }

    for (const issue of issues) {
      console.log(chalk.red(`    FAIL  ${issue}`));
    }

    if (installed.length === 0 && issues.length === 0) {
      console.log(chalk.yellow(`    WARN  Directory exists but no arcana agents found`));
      warns++;
    }

    console.log();
  }

  // 3. Multi-agent mirror sync check
  const canonical = join(cwd, ".agents", "skills");
  const mirrors = [
    join(cwd, ".claude", "skills"),
    join(cwd, ".cursor", "skills"),
    join(cwd, ".gemini", "skills"),
  ];

  if (existsSync(canonical)) {
    console.log(chalk.dim("  Multi-Agent Sync:\n"));

    for (const mirror of mirrors) {
      if (!existsSync(mirror)) continue;

      const mirrorLabel = mirror.replace(cwd + "/", "");
      let inSync = true;

      for (const skill of allSkills) {
        const canonicalFile = join(canonical, skill, "SKILL.md");
        const mirrorFile = join(mirror, skill, "SKILL.md");

        if (!existsSync(canonicalFile)) continue;

        if (!existsSync(mirrorFile)) {
          console.log(chalk.red(`    FAIL  ${skill} missing in ${mirrorLabel}`));
          fails++;
          inSync = false;
          continue;
        }

        const canonicalContent = readFileSync(canonicalFile, "utf-8");
        const mirrorContent = readFileSync(mirrorFile, "utf-8");

        if (canonicalContent !== mirrorContent) {
          console.log(chalk.yellow(`    WARN  ${skill} out of sync in ${mirrorLabel}`));
          warns++;
          inSync = false;
        }
      }

      if (inSync) {
        console.log(chalk.green(`    PASS  ${mirrorLabel} is in sync with .agents/skills/`));
        passes++;
      }
    }

    console.log();
  }

  // 4. Check AGENTS.md for skill discovery block
  if (existsSync(canonical)) {
    console.log(chalk.dim("  AGENTS.md:\n"));

    const agentsMdPath = join(cwd, "AGENTS.md");
    if (!existsSync(agentsMdPath)) {
      console.log(chalk.yellow(`    WARN  AGENTS.md not found (recommended for .agents/skills/)`));
      warns++;
    } else {
      const content = readFileSync(agentsMdPath, "utf-8");
      if (content.includes("Agent Skills (Arcana)")) {
        console.log(chalk.green(`    PASS  AGENTS.md has arcana skill discovery block`));
        passes++;
      } else {
        console.log(chalk.yellow(`    WARN  AGENTS.md missing arcana skill discovery block`));
        console.log(chalk.dim(`          Run \`arcana sync\` or add the block manually`));
        warns++;
      }
    }

    console.log();
  }

  // 5. Summary
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
