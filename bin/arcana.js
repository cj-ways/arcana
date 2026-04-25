#!/usr/bin/env node

process.on("unhandledRejection", (err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});

import { Command, Option } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getInternalCommandById, getPublicCommandById } from "../src/utils/command-manifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);
const command = (id) => getPublicCommandById(id)?.description || "";
const internalCommand = (id) => getInternalCommandById(id)?.description || "";

try {
  const program = new Command();

  program
    .name("arcana")
    .description("Curated agent skills for Claude Code and Codex CLI.")
    .version(pkg.version);

  program
    .command("init")
    .description(command("init"))
    .option("--dry-run", "Preview setup actions without writing files")
    .action(async (opts) => {
      const { runInit } = await import("../src/commands/init.js");
      await runInit(opts);
    });

  program
    .command("add [skills...]")
    .description(command("add"))
    .option("--all", "Add all available skills")
    .option(
      "--force",
      "Override conflicts — replace existing skills with Arcana versions",
    )
    .option("--dry-run", "Preview install actions without writing files")
    .addOption(
      new Option("--agent <agent>", "Target agent")
        .choices(["claude", "codex", "multi"])
        .default("claude"),
    )
    .addOption(
      new Option("--scope <scope>", "Install scope")
        .choices(["project", "user"])
        .default("project"),
    )
    .action(async (skills, opts) => {
      const { runAdd } = await import("../src/commands/add.js");
      await runAdd(skills, opts);
    });

  program
    .command("remove [skills...]")
    .description(command("remove"))
    .addOption(
      new Option("--scope <scope>", "Removal scope").choices([
        "project",
        "user",
        "all",
      ]),
    )
    .action(async (skills, opts) => {
      const { runRemove } = await import("../src/commands/remove.js");
      await runRemove(skills, opts);
    });

  program
    .command("list")
    .description(command("list"))
    .addOption(
      new Option("--scope <scope>", "Listing scope")
        .choices(["project", "user", "all"])
        .default("all"),
    )
    .option("--json", "Output inventory as JSON")
    .action(async (opts) => {
      const { runList } = await import("../src/commands/list.js");
      await runList(opts);
    });

  program
    .command("sync")
    .description(command("sync"))
    .option("--dry-run", "Preview sync and cleanup actions without writing files")
    .option("--verbose", "Show detailed troubleshooting output")
    .option("--debug", "Alias for --verbose")
    .option(
      "--clean",
      "Remove stale skills from mirrors that don't exist in canonical",
    )
    .action(async (opts) => {
      const { runSync } = await import("../src/commands/sync.js");
      await runSync(opts);
    });

  program
    .command("update")
    .description(command("update"))
    .option(
      "--force",
      "Restore packaged versions even when Arcana-managed files were edited locally",
    )
    .addOption(
      new Option("--scope <scope>", "Update scope").choices([
        "project",
        "user",
        "all",
      ]),
    )
    .action(async (opts) => {
      const { runUpdate } = await import("../src/commands/update.js");
      await runUpdate(opts);
    });

  program
    .command("use <skill>")
    .description(command("use"))
    .action(async (skill) => {
      const { runUse } = await import("../src/commands/use.js");
      await runUse(skill);
    });

  program
    .command("doctor")
    .description(command("doctor"))
    .addOption(
      new Option("--scope <scope>", "Inspection scope")
        .choices(["project", "user", "all"])
        .default("all"),
    )
    .option("--json", "Output report as JSON")
    .action(async (opts) => {
      const { runDoctor } = await import("../src/commands/doctor.js");
      await runDoctor(opts);
    });

  program
    .command("import [source] [skill-name]")
    .description(command("import"))
    .option("--force", "Overwrite existing skill")
    .option("--review", "Preview provenance and overwrite risk without writing files")
    .option("--verbose", "Show detailed troubleshooting output")
    .option("--debug", "Alias for --verbose")
    .addOption(
      new Option("--agent <agent>", "Target agent")
        .choices(["claude", "codex", "multi"])
        .default("claude"),
    )
    .addOption(
      new Option("--scope <scope>", "Install scope")
        .choices(["project", "user"])
        .default("project"),
    )
    .action(async (source, skillName, opts) => {
      const { runImport } = await import("../src/commands/import.js");
      await runImport(source, { ...opts, name: skillName });
    });

  program
    .command("info <skill>")
    .description(command("info"))
    .option("--json", "Output metadata as JSON")
    .action(async (skill, opts) => {
      const { runInfo } = await import("../src/commands/info.js");
      await runInfo(skill, opts);
    });

  program
    .command("feedback [skill]")
    .description(command("feedback"))
    .option(
      "--rating <rating>",
      "Feedback rating: helpful | partly-helpful | not-helpful | dismiss",
    )
    .option("--reasons <reasons>", "Comma-separated reason tags")
    .option("--notes <notes>", "Optional free-text feedback")
    .option("--transcript <path>", "Transcript path to analyze with consent")
    .option(
      "--analyze-transcript",
      "Analyze the provided transcript immediately",
    )
    .addOption(
      new Option("--scope <scope>", "Storage scope")
        .choices(["project", "user"])
        .default("project"),
    )
    .option("--json", "Output saved feedback as JSON")
    .action(async (skill, opts) => {
      const { runFeedback } = await import("../src/commands/feedback.js");
      await runFeedback(skill, opts);
    });

  program
    .command("feedback-report [skill]")
    .description(command("feedback-report"))
    .addOption(
      new Option("--scope <scope>", "Report scope")
        .choices(["project", "user", "all"])
        .default("all"),
    )
    .option("--json", "Output the report as JSON")
    .action(async (skill, opts) => {
      const { runFeedbackReport } = await import("../src/commands/feedback.js");
      await runFeedbackReport(skill, opts);
    });

  program
    .command("feedback-triage [skill]")
    .description(command("feedback-triage"))
    .addOption(
      new Option("--scope <scope>", "Feedback source scope")
        .choices(["project", "user", "all"])
        .default("all"),
    )
    .option(
      "--min-occurrences <count>",
      "Minimum repeated occurrences before a signal becomes an eval candidate",
    )
    .option("--write", "Write the triage report into the local .arcana feedback store")
    .option(
      "--write-drafts",
      "Write local draft eval packs for the selected candidate set",
    )
    .option(
      "--draft-limit <count>",
      "Maximum number of draft eval packs to generate per skill",
    )
    .option("--json", "Output the triage report as JSON")
    .action(async (skill, opts) => {
      const { runFeedbackTriage } = await import("../src/commands/feedback.js");
      await runFeedbackTriage(skill, opts);
    });

  program
    .command("feedback-hooks [action]")
    .description(command("feedback-hooks"))
    .option(
      "--sample-rate <rate>",
      "Fraction of explicit-skill sessions to sample without a correction signal (0-1)",
    )
    .option(
      "--cooldown-hours <hours>",
      "Minimum cooldown between automatic prompts for the same skill",
    )
    .option(
      "--no-require-correction-signal",
      "Allow sampled prompts even when the user did not correct the skill",
    )
    .option("--json", "Output status or install result as JSON")
    .action(async (action, opts) => {
      const { runFeedbackHooks } = await import("../src/commands/feedback-hooks.js");
      await runFeedbackHooks(action, opts);
    });

  program
    .command("feedback-promote <skill> <signal>")
    .description(command("feedback-promote"))
    .addOption(
      new Option("--scope <scope>", "Draft scope")
        .choices(["project", "user"])
        .default("project"),
    )
    .option(
      "--scenario-name <name>",
      "Override the promoted eval scenario directory name",
    )
    .option("--dry-run", "Preview promotion validation without copying files")
    .option("--force", "Replace an existing target scenario directory")
    .option("--json", "Output the promotion plan/result as JSON")
    .action(async (skill, signal, opts) => {
      const { runFeedbackPromote } = await import("../src/commands/feedback.js");
      await runFeedbackPromote(skill, signal, opts);
    });

  program
    .command("feedback-hook", { hidden: true })
    .description(internalCommand("feedback-hook"))
    .action(async () => {
      const { runFeedbackHook } = await import("../src/commands/feedback-hooks.js");
      await runFeedbackHook();
    });

  program.parse();
} catch (err) {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
}
