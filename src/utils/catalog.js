import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, join } from "path";
import {
  getAvailableAgents,
  getAvailableSkills,
  getPackageAgentsDir,
  getPackageRoot,
  getPackageRulesDir,
  getPackageSkillsDir,
} from "./paths.js";
import { parseFrontmatter } from "./frontmatter.js";
import { getInternalCommandCatalog, getPublicCommandCatalog } from "./command-manifest.js";
export { getInternalCommandCatalog, getPublicCommandCatalog } from "./command-manifest.js";

export const SKILL_PHASE_ORDER = Object.freeze([
  "plan",
  "analyze",
  "design",
  "implement",
  "test",
  "fix",
  "refactor",
  "review",
  "release",
  "utility",
]);

export const SKILL_PHASE_LABELS = Object.freeze({
  plan: "Plan",
  analyze: "Analyze",
  design: "Design",
  implement: "Implement",
  test: "Test",
  fix: "Fix",
  refactor: "Refactor",
  review: "Review",
  release: "Release",
  utility: "Utility",
});

export const SKILL_PHASE_ALIASES = Object.freeze({
  ideate: "plan",
  validate: "analyze",
  debug: "fix",
  ship: "release",
  toolkit: "utility",
});

export const FEEDBACK_PROFILES = Object.freeze([
  "diagnostic",
  "execution",
  "advisory",
  "general",
]);

export const HOST_CAPABILITY_MATRIX = Object.freeze([
  {
    capability: "Install, list, inspect, import, update, and sync skills",
    claude: "Yes",
    codex: "Yes",
    notes:
      "Arcana CLI manages both hosts. Multi-agent mode keeps `.agents/skills/` canonical and mirrors skills to Claude Code.",
  },
  {
    capability: "Use shipped first-party and imported skills",
    claude: "Yes",
    codex: "Yes",
    notes:
      "Both hosts read installed skills from their own skills directory after `arcana init`, `add`, `import`, or `sync`.",
  },
  {
    capability: "Install shipped Arcana agent wrapper files",
    claude: "Yes",
    codex: "No",
    notes:
      "Arcana agents install to `.claude/agents/` only. Codex CLI does not have a separate agent directory.",
  },
  {
    capability: "Manual feedback capture, reports, and triage",
    claude: "Yes",
    codex: "Yes",
    notes:
      "`arcana feedback`, `feedback-report`, and `feedback-triage` are CLI features, not host-native UI integrations.",
  },
  {
    capability: "Manual transcript analysis with explicit consent",
    claude: "Yes",
    codex: "Yes",
    notes:
      "Requires an explicit transcript path. Arcana will not read conversation history automatically.",
  },
  {
    capability: "Automatic in-session feedback prompts",
    claude: "Yes",
    codex: "No",
    notes:
      "Implemented through Claude Code hooks via `arcana feedback-hooks install`.",
  },
  {
    capability: "Host-native hook/session integration",
    claude: "Yes",
    codex: "No",
    notes:
      "Current automation depends on Claude Code hook events and `transcript_path` support.",
  },
  {
    capability: "Live eval and trigger runners",
    claude: "Yes",
    codex: "No",
    notes:
      "Current eval harness shells out to Claude CLI. Codex parity would require a second runner.",
  },
]);

export const UTILITY_MODULES = Object.freeze([
  {
    name: "agents-md.js",
    path: "src/utils/agents-md.js",
    purpose: "AGENTS.md discovery block generation",
  },
  {
    name: "catalog.js",
    path: "src/utils/catalog.js",
    purpose: "Catalog-backed inventory, summaries, and generated-doc inputs",
  },
  {
    name: "cli-errors.js",
    path: "src/utils/cli-errors.js",
    purpose: "Shared actionable error messaging and next-step hints",
  },
  {
    name: "command-manifest.js",
    path: "src/utils/command-manifest.js",
    purpose: "Single command inventory for CLI wiring and generated docs",
  },
  {
    name: "copy.js",
    path: "src/utils/copy.js",
    purpose: "File copying, ownership checks, conflict detection, and markers",
  },
  {
    name: "detect.js",
    path: "src/utils/detect.js",
    purpose: "Agent auto-detection (Claude, Codex)",
  },
  {
    name: "feedback-hooks.js",
    path: "src/utils/feedback-hooks.js",
    purpose: "Claude Code auto-feedback hooks, cooldowns, and session state",
  },
  {
    name: "feedback-eval-drafts.js",
    path: "src/utils/feedback-eval-drafts.js",
    purpose: "Feedback-derived local eval draft generation and promotion scaffolds",
  },
  {
    name: "feedback-eval-promotion.js",
    path: "src/utils/feedback-eval-promotion.js",
    purpose: "Review-first promotion of feedback-derived drafts into committed eval scenarios",
  },
  {
    name: "feedback.js",
    path: "src/utils/feedback.js",
    purpose: "Skill feedback capture, transcript analysis, and reports",
  },
  {
    name: "frontmatter.js",
    path: "src/utils/frontmatter.js",
    purpose: "Shared frontmatter parser for built-in and imported skills",
  },
  {
    name: "import-metadata.js",
    path: "src/utils/import-metadata.js",
    purpose: "Imported-skill provenance metadata, trust-state inspection, and overwrite review helpers",
  },
  {
    name: "import-adaptation.js",
    path: "src/utils/import-adaptation.js",
    purpose: "Static import-adaptation heuristics, raw-vs-adapted comparison, and installed imported-skill inspection",
  },
  {
    name: "migrations.js",
    path: "src/utils/migrations.js",
    purpose: "Skill rename and removal migrations",
  },
  {
    name: "paths.js",
    path: "src/utils/paths.js",
    purpose: "Path resolution and scoped install location discovery",
  },
  {
    name: "skill-scaffold.js",
    path: "src/utils/skill-scaffold.js",
    purpose: "Shared first-party skill scaffolding and catalog-order planning",
  },
  {
    name: "release-quality.js",
    path: "src/utils/release-quality.js",
    purpose: "Release-facing quality summary over scorecards, trigger runs, and feedback-derived local cases",
  },
  {
    name: "trigger-evals.js",
    path: "src/utils/trigger-evals.js",
    purpose: "Layer 1 trigger-pack discovery and validation helpers",
  },
  {
    name: "trigger-boundaries.js",
    path: "src/utils/trigger-boundaries.js",
    purpose: "Layer 1 same-topic boundary-suite discovery and validation helpers",
  },
  {
    name: "verbosity.js",
    path: "src/utils/verbosity.js",
    purpose: "Shared verbose/debug logging for CLI troubleshooting surfaces",
  },
]);

let _skillCatalog = null;
let _agentCatalog = null;
let _catalogStats = null;
let _ruleCatalog = null;

function getPackageVersion() {
  const pkgPath = join(getPackageRoot(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

function countMarkdownFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => name.endsWith(".md")).length;
}

function countJsFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => name.endsWith(".js")).length;
}

function parseCatalogOrder(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function summarizeDescription(description = "") {
  return String(description)
    .replace(/\r\n/g, "\n")
    .split("\n")[0]
    .replace(/\s*Use (?:when|for)\b[\s\S]*$/i, "")
    .replace(/\s*Run after\b[\s\S]*$/i, "")
    .replace(/\s*Auto-invokes\b[\s\S]*$/i, "")
    .replace(/\s*Manual via\s+\/[^\n]+$/i, "")
    .replace(/\s*Works on any project\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSkillPhase(phase) {
  const normalized = String(phase || "").trim().toLowerCase();
  if (!normalized) return null;
  return SKILL_PHASE_ALIASES[normalized] || normalized;
}

function readSkillMetadata(name) {
  const path = join(getPackageSkillsDir(), name, "SKILL.md");
  const content = readFileSync(path, "utf-8");
  const frontmatter = parseFrontmatter(content);
  const phase = normalizeSkillPhase(frontmatter.phase);
  return {
    name,
    path,
    description: frontmatter.description || "",
    summary: summarizeDescription(frontmatter.description || ""),
    phase,
    phaseLabel: phase ? SKILL_PHASE_LABELS[phase] || phase : null,
    feedbackProfile: frontmatter["feedback-profile"] || "general",
    catalogOrder: parseCatalogOrder(frontmatter["catalog-order"]),
    argumentHint: frontmatter["argument-hint"] || "",
    allowedTools: String(frontmatter["allowed-tools"] || "")
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean),
    effort: frontmatter.effort || null,
  };
}

function readAgentMetadata(name) {
  const path = join(getPackageAgentsDir(), `${name}.md`);
  const content = readFileSync(path, "utf-8");
  const frontmatter = parseFrontmatter(content);
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  const bodySummary = body.split("\n").find((line) => line.trim())?.trim() || "";
  return {
    name,
    path,
    description: frontmatter.description || "",
    summary: bodySummary || summarizeDescription(frontmatter.description || ""),
    model: frontmatter.model || null,
    skills: String(frontmatter.skills || "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  };
}

export function getSkillCatalog() {
  if (_skillCatalog) return _skillCatalog;

  _skillCatalog = getAvailableSkills()
    .map((name) => readSkillMetadata(name))
    .sort((a, b) => a.catalogOrder - b.catalogOrder || a.name.localeCompare(b.name));

  return _skillCatalog;
}

export function getAgentCatalog() {
  if (_agentCatalog) return _agentCatalog;

  _agentCatalog = getAvailableAgents()
    .map((name) => readAgentMetadata(name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return _agentCatalog;
}

export function getRuleCatalog() {
  if (_ruleCatalog) return _ruleCatalog;

  _ruleCatalog = readdirSync(getPackageRulesDir())
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({
      name: basename(name, ".md"),
      path: join(getPackageRulesDir(), name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return _ruleCatalog;
}

export function getUtilityModuleCatalog() {
  return UTILITY_MODULES.map((module) => ({ ...module }));
}

export function getHostCapabilityMatrix() {
  return HOST_CAPABILITY_MATRIX.map((row) => ({ ...row }));
}

export function getSkillMetadata(name) {
  return getSkillCatalog().find((skill) => skill.name === name) || null;
}

export function getWorkflowSkillCatalog() {
  return getSkillCatalog().filter((skill) => skill.phase && skill.phase !== "utility");
}

export function getUtilitySkillCatalog() {
  return getSkillCatalog().filter((skill) => skill.phase === "utility");
}

export function getCatalogStats() {
  if (_catalogStats) return _catalogStats;

  _catalogStats = {
    version: getPackageVersion(),
    skillCount: getSkillCatalog().length,
    agentCount: getAgentCatalog().length,
    ruleCount: getRuleCatalog().length || countMarkdownFiles(getPackageRulesDir()),
    publicCommandCount: getPublicCommandCatalog().length,
    internalCommandCount: getInternalCommandCatalog().length,
    commandModuleCount: countJsFiles(join(getPackageRoot(), "src", "commands")),
    utilityModuleCount: countJsFiles(join(getPackageRoot(), "src", "utils")),
  };

  return _catalogStats;
}
