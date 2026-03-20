#!/usr/bin/env node

process.on('unhandledRejection', (err) => {
  console.error('Fatal:', err?.message || err);
  process.exit(1);
});

import { Command, Option } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

try {
  const program = new Command();

  program
    .name("arcana")
    .description(
      "Curated agent skills for Claude Code and Codex CLI."
    )
    .version(pkg.version);

  program
    .command("init")
    .description("Interactive setup — choose agent, scope, and skills")
    .action(async () => {
      const { runInit } = await import("../src/commands/init.js");
      await runInit();
    });

  program
    .command("add [skills...]")
    .description("Add specific skill(s) to the current setup")
    .option("--all", "Add all available skills")
    .option("--force", "Override conflicts — replace existing skills with Arcana versions")
    .addOption(new Option("--agent <agent>", "Target agent").choices(["claude", "codex", "multi"]).default("claude"))
    .addOption(new Option("--scope <scope>", "Install scope").choices(["project", "user"]).default("project"))
    .action(async (skills, opts) => {
      const { runAdd } = await import("../src/commands/add.js");
      await runAdd(skills, opts);
    });

  program
    .command("remove [skills...]")
    .description("Remove skill(s) from the current setup")
    .action(async (skills) => {
      const { runRemove } = await import("../src/commands/remove.js");
      await runRemove(skills);
    });

  program
    .command("list")
    .description("Show installed and available skills")
    .action(async () => {
      const { runList } = await import("../src/commands/list.js");
      await runList();
    });

  program
    .command("sync")
    .description(
      "Multi-agent: sync canonical .agents/skills/ to agent-specific directories"
    )
    .option("--clean", "Remove stale skills from mirrors that don't exist in canonical")
    .action(async (opts) => {
      const { runSync } = await import("../src/commands/sync.js");
      await runSync(opts);
    });

  program
    .command("update")
    .description("Update installed skills to the latest version")
    .action(async () => {
      const { runUpdate } = await import("../src/commands/update.js");
      await runUpdate();
    });

  program
    .command("use <skill>")
    .description("Print a skill's content to stdout (use without installing)")
    .action(async (skill) => {
      const { runUse } = await import("../src/commands/use.js");
      await runUse(skill);
    });

  program
    .command("doctor")
    .description("Check installation health and sync status")
    .action(async () => {
      const { runDoctor } = await import("../src/commands/doctor.js");
      await runDoctor();
    });

  program
    .command("import [source] [skill-name]")
    .description("Import a skill from GitHub, URL, or local path")
    .option("--force", "Overwrite existing skill")
    .addOption(new Option("--agent <agent>", "Target agent").choices(["claude", "codex", "multi"]).default("claude"))
    .addOption(new Option("--scope <scope>", "Install scope").choices(["project", "user"]).default("project"))
    .action(async (source, skillName, opts) => {
      const { runImport } = await import("../src/commands/import.js");
      await runImport(source, { ...opts, name: skillName });
    });

  program
    .command("info <skill>")
    .description("Show skill metadata (name, description, size)")
    .action(async (skill) => {
      const { runInfo } = await import("../src/commands/info.js");
      await runInfo(skill);
    });

  program.parse();
} catch (err) {
  console.error('Fatal:', err?.message || err);
  process.exit(1);
}
