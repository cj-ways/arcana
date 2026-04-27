#!/usr/bin/env node

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  getSkillCatalog,
} from "../src/utils/catalog.js";
import { getPackageRoot, getPackageSkillsDir } from "../src/utils/paths.js";
import {
  buildSkillScaffoldPlan,
  getDefaultEvalScenarioName,
  getDefaultFeedbackProfile,
  getDefaultTriggerEvalPath,
  getSuggestedCatalogOrder,
  parseAllowedTools,
  slugifySkillName,
  validateFeedbackProfile,
  validatePhase,
} from "../src/utils/skill-scaffold.js";
import { normalizeSkillPhase } from "../src/utils/catalog.js";

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function printUsage() {
  console.log("Usage: node scripts/new-skill.js <name> --phase <phase> [options]");
  console.log("");
  console.log("Creates skills/<name>/SKILL.md, evals/scenarios/<name>-primary/, and evals/triggers/<name>.json.");
  console.log("");
  console.log("Options:");
  console.log("  --feedback-profile <profile>  diagnostic | execution | advisory");
  console.log("  --summary <text>              Initial one-sentence summary");
  console.log("  --argument-hint <text>        Input hint shown in frontmatter");
  console.log("  --tools <csv>                 Allowed tools (default: Read, Grep, Glob, Edit, Write)");
  console.log("  --effort <level>              low | medium | high");
  console.log("  --catalog-order <number>      Override suggested catalog order");
  console.log("");
  console.log("Example:");
  console.log("  npm run new:skill -- dependency-prune --phase refactor --summary \"Safely removes unused dependencies from a project.\"");
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {};
  let name = null;

  while (args.length > 0) {
    const current = args.shift();
    if (!current) continue;

    if (!name && !current.startsWith("--")) {
      name = current;
      continue;
    }

    if (!current.startsWith("--")) {
      fail(`Unexpected argument: ${current}`);
    }

    const key = current.slice(2);
    if (key === "help") {
      options.help = true;
      continue;
    }
    const value = args.shift();
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }
    options[key] = value;
  }

  return { name, options };
}

const { name: rawName, options } = parseArgs(process.argv.slice(2));

if (!rawName || options.help) {
  printUsage();
  process.exit(options.help ? 0 : 1);
}

const name = slugifySkillName(rawName);
if (!name) fail("Skill name must contain letters or numbers.");

const phase = options.phase;
if (!validatePhase(phase)) {
  fail("Phase must be one of: plan, analyze, design, implement, test, fix, refactor, review, release, utility.");
}
const normalizedPhase = normalizeSkillPhase(phase);

const feedbackProfile = options["feedback-profile"] || getDefaultFeedbackProfile(normalizedPhase);
if (!validateFeedbackProfile(feedbackProfile) || feedbackProfile === "general") {
  fail("Feedback profile must be one of: diagnostic, execution, advisory.");
}

const effort = options.effort || "medium";
if (!["low", "medium", "high"].includes(effort)) {
  fail("Effort must be one of: low, medium, high.");
}

const catalogOrder = options["catalog-order"]
  ? Number.parseInt(options["catalog-order"], 10)
  : getSuggestedCatalogOrder(getSkillCatalog(), normalizedPhase);

if (!Number.isFinite(catalogOrder)) {
  fail("Catalog order must be a number.");
}

const skillDir = join(getPackageSkillsDir(), name);
if (existsSync(skillDir)) {
  fail(`Skill already exists: ${name}`);
}
const scenarioName = getDefaultEvalScenarioName(name);
const scenarioDir = join(getPackageRoot(), "evals", "scenarios", scenarioName);
if (existsSync(scenarioDir)) {
  fail(`Eval scenario already exists: ${scenarioName}`);
}
const triggerEvalPath = join(getPackageRoot(), getDefaultTriggerEvalPath(name));
if (existsSync(triggerEvalPath)) {
  fail(`Trigger eval pack already exists: ${getDefaultTriggerEvalPath(name)}`);
}

const scaffold = buildSkillScaffoldPlan({
  skills: getSkillCatalog(),
  name,
  summary: options.summary || "",
  argumentHint: options["argument-hint"] || "<task target or problem description>",
  allowedTools: parseAllowedTools(options.tools),
  effort,
  phase: normalizedPhase,
  feedbackProfile,
  catalogOrder,
});

for (const file of scaffold.files) {
  const absolutePath = join(getPackageRoot(), file.path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, file.content);
}

execFileSync(process.execPath, [join(getPackageRoot(), "scripts", "sync-generated-content.js")], {
  cwd: getPackageRoot(),
  stdio: "inherit",
});

console.log("");
for (const file of scaffold.files) {
  console.log(`Created ${file.path}`);
}
console.log("Next steps:");
console.log("  1. Replace every TODO placeholder in the skill, scenario scaffold, and trigger pack.");
console.log(`  2. Replace evals/scenarios/${scenarioName}/src/example.js with a minimal real fixture.`);
console.log(`  3. Fill evals/triggers/${name}.json with 10 should-trigger and 10 should-not-trigger queries.`);
console.log(`  4. Run node evals/run-eval.js --scenario ${scenarioName} --run --runs 3.`);
console.log("  5. Run npm test before committing.");
