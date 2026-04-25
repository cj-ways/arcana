import chalk from "chalk";
import { readFileSync } from "fs";
import {
  buildStopHookResponse,
  getProjectFeedbackHookStatus,
  handleSessionEnd,
  handleUserPromptSubmit,
  installProjectFeedbackHooks,
  uninstallProjectFeedbackHooks,
} from "../utils/feedback-hooks.js";
import { exitWithMessage } from "../utils/cli-errors.js";

function parseOptionalNumber(optionName, value, { min = null, max = null } = {}) {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  const withinMin = min === null || parsed >= min;
  const withinMax = max === null || parsed <= max;
  if (Number.isFinite(parsed) && withinMin && withinMax) return parsed;

  const steps = [];
  if (min !== null || max !== null) {
    const lower = min === null ? "-∞" : String(min);
    const upper = max === null ? "∞" : String(max);
    steps.push(`Use a value between ${lower} and ${upper}.`);
  }
  exitWithMessage(`Invalid ${optionName}: ${value}`, { steps });
}

function resolveHookCwd(input = {}) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

function readHookInput() {
  const raw = readFileSync(0, "utf-8").trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

function printStatus(status) {
  console.log(chalk.bold("\n✦ Arcana Auto Feedback\n"));
  console.log(
    status.installed
      ? chalk.green("  Installed in Claude Code local project settings")
      : chalk.yellow("  Not installed"),
  );
  console.log(chalk.dim(`  Settings: ${status.settingsPath}`));

  if (status.config) {
    console.log(
      chalk.dim(
        `  Trigger mode: ${
          status.config.requireCorrectionSignal
            ? "explicit Arcana skill + correction signal"
            : "explicit Arcana skill + correction signal or sampling"
        }`,
      ),
    );
    console.log(
      chalk.dim(
        `  Sample rate without correction: ${(status.config.sampleRate * 100).toFixed(0)}%`,
      ),
    );
    console.log(
      chalk.dim(`  Cooldown: ${status.config.cooldownHours} hour(s)`),
    );
  }

  if (status.installed && status.matchesCurrentInstall === false) {
    console.log();
    console.log(
      chalk.yellow(
        "  Hook settings point to a different Arcana install path. Re-run `arcana feedback-hooks install` to refresh them.",
      ),
    );
  }

  if (!status.installed) {
    console.log();
    console.log(
      chalk.dim("  Enable it with: arcana feedback-hooks install"),
    );
  }

  console.log();
}

export async function runFeedbackHooks(actionArg, opts = {}) {
  const action = (actionArg || "status").trim().toLowerCase();

  if (!["install", "status", "uninstall"].includes(action)) {
    exitWithMessage(`Unknown feedback-hooks action: ${action}.`, {
      steps: [
        "Use `install`, `status`, or `uninstall`.",
        "Try `arcana feedback-hooks status` to inspect the current project state.",
      ],
    });
  }

  if (action === "install") {
    const nodePath = process.execPath;
    const cliPath = process.argv[1];
    const sampleRate = parseOptionalNumber("--sample-rate", opts.sampleRate, {
      min: 0,
      max: 1,
    });
    const cooldownHours = parseOptionalNumber(
      "--cooldown-hours",
      opts.cooldownHours,
      { min: 0 },
    );
    const requireCorrectionSignal =
      opts.requireCorrectionSignal !== undefined
        ? opts.requireCorrectionSignal
        : true;

    const result = installProjectFeedbackHooks({
      cwd: process.cwd(),
      nodePath,
      cliPath,
      sampleRate,
      cooldownHours,
      requireCorrectionSignal,
    });
    const status = getProjectFeedbackHookStatus({
      cwd: process.cwd(),
      nodePath,
      cliPath,
    });

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            action,
            installed: status.installed,
            settingsPath: result.settingsPath,
            configPath: result.configPath,
            command: result.command,
            config: status.config,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(chalk.bold("\n✦ Arcana Auto Feedback\n"));
    console.log(
      chalk.green("  Installed automatic Arcana feedback prompts for Claude Code"),
    );
    console.log(chalk.dim(`  Settings: ${result.settingsPath}`));
    console.log(
      chalk.dim(
        "  Scope: local project settings only. Arcana will not auto-prompt across other repos.",
      ),
    );
    console.log(
      chalk.dim(
        `  Trigger mode: ${
          status.config.requireCorrectionSignal
            ? "explicit Arcana skill + correction signal"
            : "explicit Arcana skill + correction signal or sampling"
        }`,
      ),
    );
    console.log(
      chalk.dim(
        `  Sample rate without correction: ${(status.config.sampleRate * 100).toFixed(0)}%`,
      ),
    );
    console.log(
      chalk.dim(`  Cooldown: ${status.config.cooldownHours} hour(s)`),
    );
    console.log(
      chalk.dim(
        "  Transcript analysis still requires the user to explicitly include 'analyze transcript' in the feedback reply.",
      ),
    );
    console.log();
    return;
  }

  if (action === "uninstall") {
    const previousStatus = getProjectFeedbackHookStatus({
      cwd: process.cwd(),
      nodePath: process.execPath,
      cliPath: process.argv[1],
    });
    uninstallProjectFeedbackHooks({ cwd: process.cwd() });

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            action,
            removed: previousStatus.installed,
            settingsPath: previousStatus.settingsPath,
            configPath: previousStatus.configPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(chalk.bold("\n✦ Arcana Auto Feedback\n"));
    console.log(
      previousStatus.installed
        ? chalk.green("  Removed automatic Arcana feedback hooks")
        : chalk.yellow("  No automatic Arcana feedback hooks were installed"),
    );
    console.log(chalk.dim(`  Settings: ${previousStatus.settingsPath}`));
    console.log();
    return;
  }

  const status = getProjectFeedbackHookStatus({
    cwd: process.cwd(),
    nodePath: process.execPath,
    cliPath: process.argv[1],
  });
  if (opts.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  printStatus(status);
}

export async function runFeedbackHook() {
  const input = readHookInput();
  if (!input?.hook_event_name) return;

  const cwd = resolveHookCwd(input);
  let output = null;

  switch (input.hook_event_name) {
    case "UserPromptSubmit":
      output = handleUserPromptSubmit(input, cwd);
      break;
    case "Stop":
      output = buildStopHookResponse(input, cwd);
      break;
    case "SessionEnd":
      output = handleSessionEnd(input, cwd);
      break;
    default:
      return;
  }

  if (output) {
    console.log(JSON.stringify(output));
  }
}
