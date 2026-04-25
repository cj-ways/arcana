#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getAgentCatalog,
  getCatalogStats,
  getHostCapabilityMatrix,
  getPublicCommandCatalog,
  getRuleCatalog,
  getUtilitySkillCatalog,
  getUtilityModuleCatalog,
  getWorkflowSkillCatalog,
} from "../src/utils/catalog.js";
import { getPackageRoot } from "../src/utils/paths.js";

const ROOT = getPackageRoot();
const CHECK_MODE = process.argv.includes("--check");

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

function replaceGeneratedSection(content, name, nextBody) {
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const pattern = new RegExp(`${start}\\n[\\s\\S]*?\\n${end}`);

  if (!pattern.test(content)) {
    throw new Error(`Missing generated section markers for ${name}`);
  }

  return content.replace(pattern, `${start}\n${nextBody.trimEnd()}\n${end}`);
}

function renderTable(headers, rows) {
  const headerRow = `| ${headers.map(escapeCell).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map(
    (row) => `| ${row.map((cell) => escapeCell(cell)).join(" | ")} |`,
  );

  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

function renderWorkflowTable() {
  const rows = getWorkflowSkillCatalog().map((skill) => [
    skill.phaseLabel,
    `\`/${skill.name}\``,
    skill.summary,
  ]);
  return renderTable(["Phase", "Skill", "What it does"], rows);
}

function renderUtilitySkillTable() {
  const rows = getUtilitySkillCatalog().map((skill) => [
    `\`/${skill.name}\``,
    skill.summary,
  ]);
  return renderTable(["Skill", "What it does"], rows);
}

function renderAgentTable() {
  const rows = getAgentCatalog().map((agent) => [
    `\`${agent.name}\``,
    agent.summary,
  ]);
  return renderTable(["Agent", "What it does"], rows);
}

function renderUtilityTable() {
  const rows = getUtilityModuleCatalog().map((module) => [
    `\`${module.name}\``,
    module.purpose,
  ]);
  return renderTable(["Module", "Purpose"], rows);
}

function renderCapabilityTable() {
  const rows = getHostCapabilityMatrix().map((row) => [
    row.capability,
    row.claude,
    row.codex,
    row.notes,
  ]);
  return renderTable(["Capability", "Claude Code", "Codex CLI", "Notes"], rows);
}

function renderCommandBlock() {
  const rows = [];
  for (const command of getPublicCommandCatalog()) {
    rows.push({
      usage: command.docsUsage,
      description: command.description,
    });
    for (const example of command.docsExamples || []) {
      rows.push(example);
    }
  }

  const width = rows.reduce(
    (max, row) => Math.max(max, row.usage.length),
    0,
  );

  return [
    "```bash",
    ...rows.map(
      (row) => `${row.usage.padEnd(width)}  # ${row.description}`,
    ),
    "```",
  ].join("\n");
}

function renderReadmeStats() {
  const stats = getCatalogStats();
  return `${stats.skillCount} skills, ${stats.agentCount} agents, ${stats.ruleCount} quality rules — all hand-authored against [SkillsBench](https://arxiv.org/abs/2602.12670) data (7,308 trajectories, +16.2pp improvement over no-skill baselines). Not scraped, not AI-generated.`;
}

function renderClaudeCurrentVersion() {
  const stats = getCatalogStats();
  return `**Current version:** ${stats.version} (${stats.skillCount} skills + ${stats.agentCount} agents + ${stats.ruleCount} quality rules)`;
}

function renderClaudeCliBlock() {
  const stats = getCatalogStats();
  const commands = getPublicCommandCatalog().map((command) => `\`${command.id}\``).join(", ");
  return [
    `- Entry point: Commander.js, ${stats.publicCommandCount} public commands + ${stats.internalCommandCount} internal hook entrypoint`,
    `- Commands: ${commands}`,
    "- All commands in `src/commands/*.js`, utilities in `src/utils/*.js`",
    "- Dependencies: commander, inquirer, chalk, fs-extra (minimal, intentional)",
  ].join("\n");
}

function renderClaudeContentBlock() {
  const stats = getCatalogStats();
  const agentNames = getAgentCatalog().map((agent) => `\`${agent.name}\``).join(", ");
  const ruleNames = getRuleCatalog().map((rule) => `\`${rule.name}\``).join(", ");
  return [
    `- \`skills/*/SKILL.md\` — ${stats.skillCount} skills (the core value)`,
    `- \`agents/*.md\` — ${stats.agentCount} agents (${agentNames})`,
    `- \`rules/*.md\` — ${stats.ruleCount} quality rules (${ruleNames})`,
    "- `migrations.json` — skill rename/removal migrations across versions",
    "- `SKILL-AUTHORING-REFERENCE.md` — evidence-based authoring guide (22 sources, SkillsBench data)",
  ].join("\n");
}

function renderOverviewArchitecture() {
  const stats = getCatalogStats();
  return `Entry point: \`bin/arcana.js\` (Commander.js). ${stats.publicCommandCount} public commands plus ${stats.internalCommandCount} internal hook entrypoint, ${stats.utilityModuleCount} utility modules, 4 dependencies (commander, inquirer, chalk, fs-extra). 2 dev dependencies (\`vitest\`, \`@vitest/coverage-v8\`).`;
}

function updateFile(relativePath, transforms) {
  const filePath = join(ROOT, relativePath);
  const current = readFileSync(filePath, "utf-8");
  let next = current;

  for (const [sectionName, renderer] of transforms) {
    next = replaceGeneratedSection(next, sectionName, renderer());
  }

  if (CHECK_MODE) {
    return current === next ? null : relativePath;
  }

  if (current !== next) {
    writeFileSync(filePath, next);
    return relativePath;
  }

  return null;
}

const changed = [
  updateFile("README.md", [
    ["README_STATS", renderReadmeStats],
    ["README_WORKFLOW", renderWorkflowTable],
    ["README_UTILITY", renderUtilitySkillTable],
    ["README_AGENTS", renderAgentTable],
    ["README_COMMANDS", renderCommandBlock],
    ["README_CAPABILITIES", renderCapabilityTable],
  ]),
  updateFile("CLAUDE.md", [
    ["CLAUDE_CURRENT_VERSION", renderClaudeCurrentVersion],
    ["CLAUDE_CLI", renderClaudeCliBlock],
    ["CLAUDE_CONTENT", renderClaudeContentBlock],
    ["CLAUDE_WORKFLOW_SKILLS", renderWorkflowTable],
    ["CLAUDE_UTILITY_SKILLS", renderUtilitySkillTable],
  ]),
  updateFile("docs/features/arcana-cli/overview.md", [
    ["OVERVIEW_ARCHITECTURE", renderOverviewArchitecture],
    ["OVERVIEW_WORKFLOW", renderWorkflowTable],
    ["OVERVIEW_UTILITY", renderUtilitySkillTable],
    ["OVERVIEW_UTILITIES", renderUtilityTable],
  ]),
  updateFile("docs/features/arcana-cli/capabilities.md", [
    ["CAPABILITIES_MATRIX", renderCapabilityTable],
  ]),
].filter(Boolean);

if (CHECK_MODE) {
  if (changed.length > 0) {
    console.error("Generated content is out of sync:");
    for (const file of changed) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

if (changed.length > 0) {
  console.log("Updated generated content:");
  for (const file of changed) {
    console.log(`  - ${file}`);
  }
} else {
  console.log("Generated content already up to date.");
}
