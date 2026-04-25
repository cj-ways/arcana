import fsExtra from "fs-extra";
const {
  copySync,
  ensureDirSync,
  existsSync,
  readFileSync,
  readdirSync,
  removeSync,
  statSync,
  writeFileSync,
} = fsExtra;
import { join } from "path";
import { validateScenario } from "../../evals/run-eval.js";
import { getFeedbackTriageDir } from "./feedback.js";
import { getFeedbackEvalDraftsDir } from "./feedback-eval-drafts.js";
import { slugifySkillName, validateSkillName } from "./skill-scaffold.js";

const PROMOTION_PLACEHOLDER_PATTERNS = Object.freeze([
  "TODO:",
  "Replace Before Release",
  "Replace this fixture",
]);

const NON_FIXTURE_DRAFT_FILES = new Set([
  "manifest.json",
  "README.md",
  "evidence.md",
  "promotion.json",
]);

function listFilesRecursive(rootDir) {
  const files = [];

  function walk(currentDir, prefix = "") {
    for (const name of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, name);
      const stats = statSync(absolutePath);
      const relativePath = prefix ? join(prefix, name) : name;

      if (stats.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }

      files.push(relativePath);
    }
  }

  walk(rootDir);
  return files.sort();
}

export function hasPromotionPlaceholderText(value) {
  return PROMOTION_PLACEHOLDER_PATTERNS.some((pattern) =>
    String(value || "").includes(pattern),
  );
}

export function getFeedbackEvalPromotedDir({
  scope = "project",
  cwd = process.cwd(),
  home,
} = {}) {
  return join(getFeedbackTriageDir({ scope, cwd, home }), "promoted");
}

export function buildFeedbackEvalPromotionPlan(
  skill,
  signal,
  {
    scope = "project",
    cwd = process.cwd(),
    home,
    scenarioName = null,
  } = {},
) {
  const signalSlug = slugifySkillName(signal);
  const draftsDir = getFeedbackEvalDraftsDir({ scope, cwd, home });
  const draftDir = join(draftsDir, skill, signalSlug);
  const manifestPath = join(draftDir, "manifest.json");

  if (!existsSync(draftDir) || !existsSync(manifestPath)) {
    return {
      found: false,
      skill,
      signal,
      signalSlug,
      draftDir,
      manifestPath,
      issues: [`No feedback-derived draft found for /${skill} and signal '${signalSlug}'.`],
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const nextScenarioName = scenarioName || manifest.name;
  const nextManifest =
    scenarioName && scenarioName !== manifest.name
      ? { ...manifest, name: scenarioName }
      : manifest;
  const draftFiles = listFilesRecursive(draftDir);
  const placeholderFiles = draftFiles.filter((relativePath) =>
    hasPromotionPlaceholderText(
      readFileSync(join(draftDir, relativePath), "utf-8"),
    ),
  );
  const fixtureFiles = draftFiles.filter(
    (relativePath) => !NON_FIXTURE_DRAFT_FILES.has(relativePath),
  );
  const targetDir = join(cwd, "evals", "scenarios", nextScenarioName);
  const issues = [];

  if (!validateSkillName(skill)) {
    issues.push(`Invalid skill name '${skill}'. Use lowercase kebab-case.`);
  }
  if (!nextScenarioName || !validateSkillName(nextScenarioName)) {
    issues.push(
      `Invalid scenario name '${nextScenarioName || ""}'. Use lowercase kebab-case.`,
    );
  }
  if (nextManifest.skill !== skill) {
    issues.push(
      `Draft manifest targets skill '${nextManifest.skill}', but promotion requested '/${skill}'.`,
    );
  }

  issues.push(...validateScenario(nextManifest));

  if (fixtureFiles.length === 0) {
    issues.push(
      "Add at least one real fixture file beyond manifest.json, README.md, and evidence.md before promotion.",
    );
  }

  if (placeholderFiles.length > 0) {
    issues.push(
      `Remove placeholder text from: ${placeholderFiles.join(", ")}`,
    );
  }

  return {
    found: true,
    skill,
    signal,
    signalSlug,
    draftsDir,
    draftDir,
    draftFiles,
    placeholderFiles,
    fixtureFiles,
    manifestPath,
    manifest: nextManifest,
    scenarioName: nextScenarioName,
    targetDir,
    targetExists: existsSync(targetDir),
    issues,
  };
}

export function promoteFeedbackEvalDraft(
  plan,
  {
    scope = "project",
    cwd = process.cwd(),
    home,
    force = false,
  } = {},
) {
  if (!plan?.found) {
    throw new Error("Cannot promote a missing feedback eval draft.");
  }
  if (plan.issues.length > 0) {
    throw new Error(
      `Cannot promote an invalid feedback eval draft: ${plan.issues.join(" | ")}`,
    );
  }
  if (plan.targetExists && !force) {
    throw new Error(
      `Scenario '${plan.scenarioName}' already exists at ${plan.targetDir}.`,
    );
  }

  if (plan.targetExists && force) {
    removeSync(plan.targetDir);
  }

  ensureDirSync(plan.targetDir);
  copySync(plan.draftDir, plan.targetDir, { overwrite: true });
  writeFileSync(
    join(plan.targetDir, "manifest.json"),
    `${JSON.stringify(plan.manifest, null, 2)}\n`,
  );

  const promotedRoot = getFeedbackEvalPromotedDir({ scope, cwd, home });
  const archiveDir = join(
    promotedRoot,
    plan.skill,
    `${plan.signalSlug}-${Date.now()}`,
  );
  ensureDirSync(archiveDir);
  copySync(plan.draftDir, archiveDir, { overwrite: true });
  writeFileSync(
    join(archiveDir, "promotion.json"),
    `${JSON.stringify(
      {
        promotedAt: new Date().toISOString(),
        skill: plan.skill,
        signal: plan.signal,
        signalSlug: plan.signalSlug,
        scenarioName: plan.scenarioName,
        targetDir: plan.targetDir,
      },
      null,
      2,
    )}\n`,
  );

  removeSync(plan.draftDir);

  return {
    skill: plan.skill,
    signal: plan.signal,
    signalSlug: plan.signalSlug,
    scenarioName: plan.scenarioName,
    targetDir: plan.targetDir,
    archiveDir,
    promotedFiles: listFilesRecursive(plan.targetDir),
  };
}
