import chalk from "chalk";

export function isVerboseMode(opts = {}) {
  return Boolean(opts.verbose || opts.debug);
}

function formatValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function createVerboseLogger(opts = {}, { prefix = "debug" } = {}) {
  const enabled = isVerboseMode(opts);

  function emit(message, value) {
    if (!enabled) return;
    const suffix = value === undefined ? "" : `: ${formatValue(value)}`;
    console.log(chalk.dim(`  [${prefix}] ${message}${suffix}`));
  }

  return {
    enabled,
    line(message) {
      emit(message);
    },
    field(label, value) {
      emit(label, value);
    },
  };
}
