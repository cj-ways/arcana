import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import fsExtra from "fs-extra";
const { copySync, ensureDirSync, removeSync } = fsExtra;

export async function runSync(opts = {}) {
  const cwd = process.cwd();
  const canonical = join(cwd, ".agents", "skills");

  if (!existsSync(canonical)) {
    console.log(
      chalk.yellow(
        "No .agents/skills/ directory found. Run `arcana init` with multi-agent mode first."
      )
    );
    process.exit(1);
  }

  console.log(chalk.bold("\n✦ Arcana Sync\n"));

  // Smart mirror targets: only sync to directories whose parent exists
  const possibleTargets = [
    { dir: join(cwd, ".claude", "skills"), parent: join(cwd, ".claude") },
    { dir: join(cwd, ".cursor", "skills"), parent: join(cwd, ".cursor") },
    { dir: join(cwd, ".gemini", "skills"), parent: join(cwd, ".gemini") },
  ];
  let targets = possibleTargets
    .filter(t => existsSync(t.parent))
    .map(t => t.dir);

  // If no targets exist, always create .claude/skills/ as minimum default
  if (targets.length === 0) {
    targets = [join(cwd, ".claude", "skills")];
  }

  for (const target of targets) {
    ensureDirSync(target);
    copySync(canonical, target, { overwrite: true });
    const rel = relative(cwd, target);
    console.log(chalk.green(`  ✓ ${rel} ← .agents/skills/`));
  }

  // --clean: remove stale skills from mirrors that don't exist in canonical
  if (opts.clean) {
    console.log(chalk.dim("\n  Cleaning stale skills...\n"));
    const canonicalSkills = readdirSync(canonical).filter(name =>
      existsSync(join(canonical, name, "SKILL.md"))
    );
    let cleaned = 0;

    for (const target of targets) {
      if (!existsSync(target)) continue;
      const mirrorEntries = readdirSync(target);
      for (const entry of mirrorEntries) {
        if (!canonicalSkills.includes(entry)) {
          const stale = join(target, entry);
          removeSync(stale);
          const rel = relative(cwd, stale);
          console.log(chalk.yellow(`  ✗ Removed stale: ${rel}`));
          cleaned++;
        }
      }
    }

    if (cleaned === 0) {
      console.log(chalk.dim("  No stale skills found."));
    } else {
      console.log(chalk.dim(`\n  Cleaned ${cleaned} stale skill(s).`));
    }
  }

  console.log(chalk.bold("\n✦ Sync complete.\n"));
}

export function appendAgentsMdBlock(cwd) {
  const agentsPath = join(cwd, "AGENTS.md");
  const skillsDir = join(cwd, ".agents", "skills");

  // Discover installed skill names
  let skillList = "";
  if (existsSync(skillsDir)) {
    const names = readdirSync(skillsDir).filter((name) => {
      return existsSync(join(skillsDir, name, "SKILL.md"));
    });
    skillList = names.map((name) => `- ${name}`).join("\n");
  }

  const block = `
## Agent Skills (Arcana)

Skills are located in \`.agents/skills/\`. Each skill folder contains a \`SKILL.md\` file.

**Skill discovery:** Enumerate all \`.agents/skills/*/SKILL.md\` files. Parse YAML front-matter to get name and description. Load full content only when the skill is invoked.

Available skills:
${skillList}
`;

  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    if (content.includes("Agent Skills (Arcana)")) return; // already present
    appendFileSync(agentsPath, block);
  } else {
    writeFileSync(agentsPath, `# AGENTS.md\n${block}`);
  }
}
