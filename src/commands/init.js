import inquirer from "inquirer";
import chalk from "chalk";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { isInsideProject, suggestAgent } from "../utils/detect.js";
import {
  getTargetDirs,
  getAvailableSkills,
  getAvailableAgents,
} from "../utils/paths.js";
import { copySkills, copyAgents, mirrorSkills } from "../utils/copy.js";
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
        { name: "Gemini CLI", value: "gemini" },
        { name: "Multi-agent (Claude + Codex + Cursor + Gemini)", value: "multi" },
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

  // Install
  const dirs = getTargetDirs(agent, scope);
  const scopeLabel = scope === "user" ? "user level" : "project level";
  const agentLabel =
    agent === "multi" ? "Multi-agent" : agent === "gemini" ? "Gemini" : agent === "codex" ? "Codex" : "Claude";

  console.log(
    chalk.dim(`\nSetting up for ${agentLabel} at ${scopeLabel}...\n`)
  );

  // Copy skills to primary target
  const skillResults = copySkills(selectedSkills, dirs.skills);
  for (const r of skillResults) {
    if (r.status === "installed") {
      console.log(chalk.green(`  ✓ ${r.name}`));
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
      } else {
        console.log(chalk.red(`  ✗ ${r.name} — ${r.status}`));
      }
    }
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

  // Summary
  const installed = skillResults.filter((r) => r.status === "installed").length;
  const agentCount = dirs.agents
    ? selectedAgents.length
    : 0;

  console.log(
    chalk.bold(
      `\n✦ Done. ${installed} skills + ${agentCount} agent installed.\n`
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
