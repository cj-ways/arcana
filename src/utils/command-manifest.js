export const PUBLIC_COMMANDS = Object.freeze([
  {
    id: "init",
    command: "init",
    docsUsage: "arcana init",
    description: "Interactive setup — choose agent, scope, and skills",
    docsExamples: [
      {
        usage: "arcana init --dry-run",
        description: "Preview setup decisions and planned writes without changing files",
      },
    ],
  },
  {
    id: "add",
    command: "add [skills...]",
    docsUsage: "arcana add <skill...>",
    description: "Add specific skill(s) to the current setup",
    docsExamples: [
      {
        usage: "arcana add --all",
        description: "Add all skills + agents",
      },
      {
        usage: "arcana add <skill...> --dry-run",
        description: "Preview install and mirror actions without writing files",
      },
    ],
  },
  {
    id: "remove",
    command: "remove [skills...]",
    docsUsage: "arcana remove <skill...>",
    description: "Remove skill(s) from the current setup",
  },
  {
    id: "list",
    command: "list",
    docsUsage: "arcana list",
    description: "Show installed and available skills",
    docsExamples: [
      {
        usage: "arcana list --json",
        description: "Output installed inventory and imported skills as JSON",
      },
    ],
  },
  {
    id: "sync",
    command: "sync",
    docsUsage: "arcana sync",
    description: "Multi-agent: sync canonical to mirrors",
    docsExamples: [
      {
        usage: "arcana sync --dry-run --clean",
        description: "Preview sync targets and stale-skill cleanup without writing files",
      },
      {
        usage: "arcana sync --verbose --clean",
        description: "Show target selection and stale-entry cleanup decisions",
      },
    ],
  },
  {
    id: "update",
    command: "update",
    docsUsage: "arcana update",
    description: "Update managed installs that have changed",
    docsExamples: [
      {
        usage: "arcana update --force",
        description: "Restore packaged versions over local edits",
      },
    ],
  },
  {
    id: "use",
    command: "use <skill>",
    docsUsage: "arcana use <skill>",
    description: "Print skill to stdout (no install)",
  },
  {
    id: "import",
    command: "import [source] [skill-name]",
    docsUsage: "arcana import <source>",
    description: "Import skill from GitHub, URL, or local",
    docsExamples: [
      {
        usage: "arcana import <source> <skill-name> --review",
        description: "Preview provenance and overwrite risk before forcing an overwrite",
      },
      {
        usage: "arcana import <source> --verbose",
        description: "Show resolved paths, fetch attempts, and target selection details",
      },
    ],
  },
  {
    id: "doctor",
    command: "doctor",
    docsUsage: "arcana doctor",
    description: "Check installation health",
    docsExamples: [
      {
        usage: "arcana doctor --json",
        description: "Emit a machine-readable health report",
      },
    ],
  },
  {
    id: "info",
    command: "info <skill>",
    docsUsage: "arcana info <skill>",
    description: "Show skill metadata",
    docsExamples: [
      {
        usage: "arcana info <skill> --json",
        description: "Output skill, agent, or imported-skill metadata as JSON",
      },
    ],
  },
  {
    id: "feedback",
    command: "feedback [skill]",
    docsUsage: "arcana feedback <skill>",
    description: "Record structured feedback for a skill",
  },
  {
    id: "feedback-report",
    command: "feedback-report [skill]",
    docsUsage: "arcana feedback-report [skill]",
    description: "Summarize collected feedback",
  },
  {
    id: "feedback-triage",
    command: "feedback-triage [skill]",
    docsUsage: "arcana feedback-triage [skill]",
    description: "Turn repeated feedback into eval candidates",
    docsExamples: [
      {
        usage: "arcana feedback-triage <skill> --write",
        description: "Write a local triage report for the current project",
      },
      {
        usage: "arcana feedback-triage [skill] --json",
        description: "Output candidate eval follow-ups as JSON",
      },
      {
        usage: "arcana feedback-triage <skill> --write-drafts",
        description: "Write local draft eval packs derived from repeated feedback",
      },
    ],
  },
  {
    id: "feedback-hooks",
    command: "feedback-hooks [action]",
    docsUsage: "arcana feedback-hooks install",
    description: "Install or inspect Claude Code auto-feedback hooks",
  },
  {
    id: "feedback-promote",
    command: "feedback-promote <skill> <signal>",
    docsUsage: "arcana feedback-promote <skill> <signal>",
    description: "Promote a reviewed feedback-derived draft into evals/scenarios",
    docsExamples: [
      {
        usage: "arcana feedback-promote <skill> <signal> --dry-run",
        description: "Validate a reviewed draft before copying it into the scenario corpus",
      },
      {
        usage: "arcana feedback-promote <skill> <signal> --scenario-name <name>",
        description: "Promote into a renamed scenario directory after review",
      },
    ],
  },
]);

export const INTERNAL_COMMANDS = Object.freeze([
  {
    id: "feedback-hook",
    command: "feedback-hook",
    description: "Internal Claude Code hook entrypoint",
  },
]);

export function getPublicCommandCatalog() {
  return PUBLIC_COMMANDS.map((command) => ({
    ...command,
    docsExamples: command.docsExamples ? [...command.docsExamples] : [],
  }));
}

export function getPublicCommandById(id) {
  return PUBLIC_COMMANDS.find((command) => command.id === id) || null;
}

export function getInternalCommandCatalog() {
  return INTERNAL_COMMANDS.map((command) => ({ ...command }));
}

export function getInternalCommandById(id) {
  return INTERNAL_COMMANDS.find((command) => command.id === id) || null;
}
