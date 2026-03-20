import inquirer from "inquirer";
import chalk from "chalk";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { isInsideProject, suggestAgent } from "../utils/detect.js";
import {
  getTargetDirs,
  getAvailableSkills,
  getAvailableAgents,
  getPackageRulesDir,
} from "../utils/paths.js";
import { copySkills, copyAgents, mirrorSkills, renameExistingSkill, renameExistingAgent } from "../utils/copy.js";
import fsExtra from "fs-extra";
const { copySync: fsCopySync, ensureDirSync } = fsExtra;
import { appendAgentsMdBlock } from "./sync.js";

function hasArcanaSkills() {
  const cwd = process.cwd();
  const dirs = [
    join(cwd, ".claude", "skills"),
    join(cwd, ".agents", "skills"),
  ];
  for (const dir of dirs) {
    if (existsSync(dir)) {
      const entries = readdirSync(dir);
      if (entries.some((e) => existsSync(join(dir, e, "SKILL.md")))) {
        return true;
      }
    }
  }
  return false;
}

function copyRules(targetDir) {
  const rulesDir = getPackageRulesDir();
  if (!existsSync(rulesDir)) return [];
  const results = [];
  const files = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
  ensureDirSync(targetDir);
  for (const file of files) {
    const src = join(rulesDir, file);
    const dest = join(targetDir, file);
    fsCopySync(src, dest, { overwrite: true });
    results.push({ name: file, status: "installed" });
  }
  return results;
}

async function resolveConflicts(conflicts, dirs) {
  console.log(chalk.yellow(`\n⚠ ${conflicts.length} name conflict(s) detected:`));
  for (const c of conflicts) {
    console.log(chalk.yellow(`  ${c.name} (${c.type}) — you have a custom ${c.type} with this name`));
  }

  const { resolution } = await inquirer.prompt([
    {
      type: "list",
      name: "resolution",
      message: "How do you want to handle these conflicts?",
      choices: [
        { name: "Override all — replace with Arcana versions", value: "override" },
        { name: "Rename my skills — keep both (you pick new names)", value: "rename" },
        { name: "Skip — keep your versions, don't install Arcana's", value: "skip" },
      ],
    },
  ]);

  let installed = 0;

  if (resolution === "override") {
    const skillConflicts = conflicts.filter((c) => c.type === "skill").map((c) => c.name);
    const agentConflicts = conflicts.filter((c) => c.type === "agent").map((c) => c.name);

    if (skillConflicts.length > 0) {
      const results = copySkills(skillConflicts, dirs.skills, { force: true });
      for (const r of results) {
        if (r.status === "installed") {
          console.log(chalk.green(`  ✓ ${r.name} (overwritten)`));
          installed++;
        }
      }
    }
    if (agentConflicts.length > 0 && dirs.agents) {
      const results = copyAgents(agentConflicts, dirs.agents, { force: true });
      for (const r of results) {
        if (r.status === "installed") {
          console.log(chalk.green(`  ✓ ${r.name} (agent, overwritten)`));
          installed++;
        }
      }
    }
  } else if (resolution === "rename") {
    for (const c of conflicts) {
      const targetDir = c.type === "skill" ? dirs.skills : dirs.agents;

      const { newName } = await inquirer.prompt([
        {
          type: "input",
          name: "newName",
          message: `Rename your "${c.name}" ${c.type} to:`,
          default: `my-${c.name}`,
          validate: (input) => {
            const trimmed = input.trim();
            if (!trimmed) return "Name cannot be empty";
            if (trimmed === c.name) return "Must be different from current name";
            if (/[^a-zA-Z0-9_-]/.test(trimmed)) return "Use only letters, numbers, hyphens, underscores";
            if (c.type === "skill" && existsSync(join(targetDir, trimmed))) {
              return `"${trimmed}" already exists`;
            }
            if (c.type === "agent" && existsSync(join(targetDir, `${trimmed}.md`))) {
              return `"${trimmed}" already exists`;
            }
            return true;
          },
        },
      ]);

      const renamed = c.type === "skill"
        ? renameExistingSkill(targetDir, c.name, newName.trim())
        : renameExistingAgent(targetDir, c.name, newName.trim());

      if (renamed) {
        console.log(chalk.dim(`  ↳ ${c.name} → ${newName.trim()}`));
      } else {
        console.log(chalk.red(`  ✗ Failed to rename ${c.name}`));
      }
    }

    // Now install Arcana versions in the freed-up names
    const skillConflicts = conflicts.filter((c) => c.type === "skill").map((c) => c.name);
    const agentConflicts = conflicts.filter((c) => c.type === "agent").map((c) => c.name);

    if (skillConflicts.length > 0) {
      const results = copySkills(skillConflicts, dirs.skills);
      for (const r of results) {
        if (r.status === "installed") {
          console.log(chalk.green(`  ✓ ${r.name}`));
          installed++;
        }
      }
    }
    if (agentConflicts.length > 0 && dirs.agents) {
      const results = copyAgents(agentConflicts, dirs.agents);
      for (const r of results) {
        if (r.status === "installed") {
          console.log(chalk.green(`  ✓ ${r.name} (agent)`));
          installed++;
        }
      }
    }
  }
  // "skip" = do nothing

  return installed;
}

export async function runInit() {
  console.log(chalk.bold("\n✦ Arcana — Agent Skills Setup\n"));

  // Detect existing installation
  if (hasArcanaSkills()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Arcana skills already detected. Overwrite?",
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.dim("Exiting without changes."));
      return;
    }
  }

  const inProject = isInsideProject();
  const suggested = suggestAgent();

  // Scope
  const { scope } = await inquirer.prompt([
    {
      type: "list",
      name: "scope",
      message: "Where are you installing?",
      choices: [
        {
          name: inProject
            ? "Project level (this repo)"
            : "Project level (no git repo detected — will create .claude/ here)",
          value: "project",
        },
        {
          name: "User level (global, all projects)",
          value: "user",
        },
      ],
      default: "project",
    },
  ]);

  // Agent
  const { agent } = await inquirer.prompt([
    {
      type: "list",
      name: "agent",
      message: "Which agent(s)?",
      choices: [
        { name: "Claude Code", value: "claude" },
        { name: "Codex CLI", value: "codex" },
        { name: "Multi-agent (Claude + Codex)", value: "multi" },
      ],
      default: suggested,
    },
  ]);

  // Skills selection
  const allSkills = getAvailableSkills();
  const allAgents = getAvailableAgents();

  const { selectionMode } = await inquirer.prompt([
    {
      type: "list",
      name: "selectionMode",
      message: "Which skills?",
      choices: [
        {
          name: `All (${allSkills.length} skills + ${allAgents.length} agent)`,
          value: "all",
        },
        { name: "Custom (pick specific skills)", value: "custom" },
      ],
    },
  ]);

  let selectedSkills = allSkills;
  let selectedAgents = allAgents;

  if (selectionMode === "custom") {
    const { skills } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "skills",
        message: "Select skills:",
        choices: allSkills.map((s) => ({ name: s, value: s, checked: true })),
      },
    ]);
    selectedSkills = skills;

    const { agents } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "agents",
        message: "Select agents:",
        choices: allAgents.map((a) => ({ name: a, value: a, checked: true })),
      },
    ]);
    selectedAgents = agents;
  }

  if (selectedSkills.length === 0 && selectedAgents.length === 0) {
    console.log(chalk.yellow("\nNo skills selected. Nothing to install."));
    return;
  }

  // Ask about Arcana quality rules
  const { installRules } = await inquirer.prompt([
    {
      type: "confirm",
      name: "installRules",
      message:
        "Apply Arcana quality rules? (recommended — establishes research-first, evidence-based AI patterns)",
      default: true,
    },
  ]);

  // Install
  const dirs = getTargetDirs(agent, scope);
  const scopeLabel = scope === "user" ? "user level" : "project level";
  const agentLabel =
    agent === "multi" ? "Multi-agent" : agent === "codex" ? "Codex" : "Claude";

  console.log(
    chalk.dim(`\nSetting up for ${agentLabel} at ${scopeLabel}...\n`)
  );

  // Copy skills to primary target
  const skillResults = copySkills(selectedSkills, dirs.skills);
  const conflicts = [];
  for (const r of skillResults) {
    if (r.status === "installed") {
      console.log(chalk.green(`  ✓ ${r.name}`));
    } else if (r.status === "conflict") {
      console.log(chalk.yellow(`  ⚠ ${r.name} — name conflict`));
      conflicts.push({ name: r.name, type: "skill" });
    } else {
      console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
    }
  }

  // Copy agents
  if (dirs.agents && selectedAgents.length > 0) {
    const agentResults = copyAgents(selectedAgents, dirs.agents);
    for (const r of agentResults) {
      if (r.status === "installed") {
        console.log(chalk.green(`  ✓ ${r.name} (agent)`));
      } else if (r.status === "conflict") {
        console.log(chalk.yellow(`  ⚠ ${r.name} — name conflict (agent)`));
        conflicts.push({ name: r.name, type: "agent" });
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }
  }

  // Handle conflicts interactively
  let conflictResolved = 0;
  if (conflicts.length > 0) {
    conflictResolved = await resolveConflicts(conflicts, dirs);
  }

  // Multi-agent: mirror to agent-specific dirs
  if (agent === "multi" && dirs.mirrors) {
    const mirrorResults = mirrorSkills(dirs.skills, dirs.mirrors);
    for (const r of mirrorResults) {
      console.log(chalk.dim(`  ↳ Mirrored to ${r.dir}`));
    }
  }

  // Codex/Multi: append AGENTS.md block
  if ((agent === "codex" || agent === "multi") && scope === "project") {
    appendAgentsMdBlock(process.cwd());
    console.log(chalk.dim("  ↳ Updated AGENTS.md with skill discovery block"));
  }

  // Copy rules if requested
  let rulesCount = 0;
  if (installRules) {
    const base = scope === "user" ? (await import("os")).homedir() : process.cwd();
    const rulesTargetDir = join(base, ".claude", "rules");

    // Check for existing NON-ARCANA rules before copying
    const arcanaRuleNames = existsSync(getPackageRulesDir())
      ? readdirSync(getPackageRulesDir()).filter((f) => f.endsWith(".md"))
      : [];
    const existingRuleFiles = existsSync(rulesTargetDir)
      ? readdirSync(rulesTargetDir).filter((f) => f.endsWith(".md"))
      : [];
    const nonArcanaRules = existingRuleFiles.filter((f) => !arcanaRuleNames.includes(f));

    const rulesResults = copyRules(rulesTargetDir);
    rulesCount = rulesResults.filter((r) => r.status === "installed").length;

    for (const r of rulesResults) {
      if (r.status === "installed") {
        console.log(chalk.green(`  ✓ ${r.name} (rule)`));
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }

    if (nonArcanaRules.length > 0) {
      console.log(
        chalk.yellow(
          `\n  ⚠ You have ${nonArcanaRules.length} non-Arcana rule(s): ${nonArcanaRules.join(", ")}`
        )
      );
      console.log(
        chalk.yellow(
          "    Run /agent-audit rules to check for conflicts with Arcana rules."
        )
      );
    }
  }

  // Summary
  const installed = skillResults.filter((r) => r.status === "installed").length + conflictResolved;
  const agentCount = dirs.agents ? selectedAgents.length : 0;

  const rulesSuffix = rulesCount > 0 ? ` + ${rulesCount} rules` : "";
  console.log(
    chalk.bold(
      `\n✦ Done. ${installed} skills + ${agentCount} agent${rulesSuffix} installed.\n`
    )
  );

  if (agent === "multi") {
    console.log(
      chalk.dim(
        "  Run `arcana sync` after editing canonical skills in .agents/skills/"
      )
    );
  }
}
