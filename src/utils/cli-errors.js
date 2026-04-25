import chalk from "chalk";

function toList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export function printNextSteps(steps = [], { stream = "error" } = {}) {
  const items = toList(steps);
  if (items.length === 0) return;

  const write = stream === "log" ? console.log : console.error;
  write(chalk.dim("  Next:"));
  for (const step of items) {
    write(chalk.dim(`    - ${step}`));
  }
}

export function exitWithMessage(
  message,
  { color = "red", steps = [], code = 1, stream = "error" } = {},
) {
  const write = stream === "log" ? console.log : console.error;
  const painter = typeof chalk[color] === "function" ? chalk[color] : chalk.red;
  write(painter(message));
  printNextSteps(steps, { stream });
  process.exit(code);
}
