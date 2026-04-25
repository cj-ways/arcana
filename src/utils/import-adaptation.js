import { existsSync, readFileSync } from "fs";
import { basename, join } from "path";
import { parseFrontmatter } from "./frontmatter.js";
import {
  getImportRawSnapshotPath,
  stripImportAttribution,
} from "./import-metadata.js";

export const IMPORT_ADAPTATION_SUPPORTED_FIELDS = Object.freeze([
  "name",
  "description",
  "argument-hint",
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "effort",
  "phase",
  "feedback-profile",
  "catalog-order",
]);

const CATEGORY_WEIGHTS = Object.freeze({
  frontmatter: 0.35,
  structure: 0.25,
  tone: 0.2,
  safety: 0.2,
});

function normalizeContent(content) {
  return stripImportAttribution(String(content || ""))
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trimEnd();
}

function extractBody(content) {
  const normalized = normalizeContent(content);
  return normalized.replace(/^---\n[\s\S]*?\n---(?:\n|$)/, "");
}

function countMatches(text, regex) {
  const matches = String(text || "").match(regex);
  return matches ? matches.length : 0;
}

function buildCheck(id, category, passed, detail) {
  return { id, category, passed, detail };
}

export function analyzeImportedSkillQuality(
  content,
  { expectedName = null } = {},
) {
  const normalized = normalizeContent(content);
  const frontmatter = parseFrontmatter(normalized);
  const frontmatterKeys = Object.keys(frontmatter);
  const body = extractBody(normalized);
  const lines = normalized ? normalized.split("\n").length : 0;
  const secondLevelSections = countMatches(body, /^##\s+/gm);
  const pronounCount = countMatches(
    body,
    /\b(i|you|we|my|your|our)\b/gi,
  );
  const description = String(frontmatter.description || "");

  const unsupportedFields = frontmatterKeys.filter(
    (key) => !IMPORT_ADAPTATION_SUPPORTED_FIELDS.includes(key),
  );

  const checks = [
    buildCheck(
      "frontmatter-name",
      "frontmatter",
      Boolean(frontmatter.name),
      frontmatter.name
        ? `name: ${frontmatter.name}`
        : "Missing frontmatter name",
    ),
    buildCheck(
      "frontmatter-name-format",
      "frontmatter",
      !frontmatter.name
        ? false
        : /^[a-z0-9]+(-[a-z0-9]+)*$/.test(frontmatter.name),
      frontmatter.name
        ? `name: ${frontmatter.name}`
        : "Missing frontmatter name",
    ),
    buildCheck(
      "frontmatter-name-match",
      "frontmatter",
      !expectedName || frontmatter.name === expectedName,
      expectedName
        ? `expected ${expectedName}, got ${frontmatter.name || "(missing)"}`
        : "No expected name provided",
    ),
    buildCheck(
      "frontmatter-description",
      "frontmatter",
      description.length > 0 && description.length <= 1024,
      description
        ? `description length ${description.length}`
        : "Missing description",
    ),
    buildCheck(
      "frontmatter-allowed-tools",
      "frontmatter",
      Boolean(frontmatter["allowed-tools"]),
      frontmatter["allowed-tools"]
        ? `allowed-tools: ${frontmatter["allowed-tools"]}`
        : "Missing allowed-tools",
    ),
    buildCheck(
      "frontmatter-supported-fields",
      "frontmatter",
      unsupportedFields.length === 0,
      unsupportedFields.length === 0
        ? "No unsupported frontmatter fields"
        : `Unsupported fields: ${unsupportedFields.join(", ")}`,
    ),
    buildCheck(
      "structure-sections",
      "structure",
      secondLevelSections >= 2,
      `${secondLevelSections} second-level section(s)`,
    ),
    buildCheck(
      "structure-gotchas-or-rules",
      "structure",
      /(^|\n)##\s+(Gotchas|Rules)\b/im.test(body),
      "Checks for a Gotchas or Rules section",
    ),
    buildCheck(
      "structure-validation",
      "structure",
      /(^|\n)##\s+Validation\b/im.test(body)
        || /\bvalidate\b/i.test(body),
      "Checks for validation guidance",
    ),
    buildCheck(
      "structure-line-count",
      "structure",
      lines <= 500,
      `${lines} line(s)`,
    ),
    buildCheck(
      "tone-description-voice",
      "tone",
      !/^\s*(i|you|we)\b/i.test(description),
      description || "Missing description",
    ),
    buildCheck(
      "tone-body-pronouns",
      "tone",
      pronounCount <= 3,
      `${pronounCount} first/second-person token(s)`,
    ),
    buildCheck(
      "safety-hardcoded-paths",
      "safety",
      !/(\/Users\/|\/home\/|[A-Za-z]:\\)/.test(normalized),
      "Checks for absolute user paths",
    ),
    buildCheck(
      "safety-description-markup",
      "safety",
      !/<\/?[A-Za-z][^>]*>/.test(description),
      description || "Missing description",
    ),
  ];

  const categories = Object.fromEntries(
    Object.keys(CATEGORY_WEIGHTS).map((category) => {
      const categoryChecks = checks.filter((check) => check.category === category);
      const passed = categoryChecks.filter((check) => check.passed).length;
      const total = categoryChecks.length;
      const score = total === 0 ? 1 : passed / total;
      return [
        category,
        {
          passed,
          total,
          score: Number(score.toFixed(4)),
        },
      ];
    }),
  );

  const score = Object.entries(CATEGORY_WEIGHTS).reduce(
    (sum, [category, weight]) => sum + categories[category].score * weight,
    0,
  );

  return {
    score: Number(score.toFixed(4)),
    scorePercent: Math.round(score * 100),
    lineCount: lines,
    frontmatter,
    frontmatterKeys,
    unsupportedFields,
    secondLevelSections,
    pronounCount,
    categories,
    checks,
  };
}

export function compareImportedSkillAdaptation(
  rawContent,
  adaptedContent,
  { expectedName = null } = {},
) {
  const before = analyzeImportedSkillQuality(rawContent, { expectedName });
  const after = analyzeImportedSkillQuality(adaptedContent, { expectedName });
  const delta = Number((after.score - before.score).toFixed(4));
  const beforeById = new Map(before.checks.map((check) => [check.id, check]));
  const afterById = new Map(after.checks.map((check) => [check.id, check]));
  const improvedChecks = [];
  const regressedChecks = [];

  for (const [id, beforeCheck] of beforeById.entries()) {
    const afterCheck = afterById.get(id);
    if (!afterCheck) continue;
    if (!beforeCheck.passed && afterCheck.passed) {
      improvedChecks.push({
        id,
        category: afterCheck.category,
        detail: afterCheck.detail,
      });
    } else if (beforeCheck.passed && !afterCheck.passed) {
      regressedChecks.push({
        id,
        category: afterCheck.category,
        detail: afterCheck.detail,
      });
    }
  }

  const improvedAreas = [...new Set(improvedChecks.map((check) => check.category))];
  const regressedAreas = [...new Set(regressedChecks.map((check) => check.category))];
  const status = delta > 0
    ? "improved"
    : delta < 0
      ? "regressed"
      : "unchanged";

  return {
    available: true,
    status,
    rawScore: before.score,
    rawScorePercent: before.scorePercent,
    adaptedScore: after.score,
    adaptedScorePercent: after.scorePercent,
    scoreDelta: delta,
    scoreDeltaPercent: Math.round(delta * 100),
    improvedChecks,
    regressedChecks,
    improvedAreas,
    regressedAreas,
    before,
    after,
  };
}

export function inspectImportedSkillAdaptation(skillDir) {
  const skillPath = join(skillDir, "SKILL.md");
  const rawSnapshotPath = getImportRawSnapshotPath(skillDir);

  if (!existsSync(skillPath) || !existsSync(rawSnapshotPath)) {
    return {
      available: false,
      status: "unavailable",
      skillPath,
      rawSnapshotPath,
      reason: existsSync(skillPath)
        ? "raw-import-snapshot-missing"
        : "skill-file-missing",
    };
  }

  const expectedName = basename(skillDir);
  const rawContent = readFileSync(rawSnapshotPath, "utf-8");
  const adaptedContent = readFileSync(skillPath, "utf-8");
  return {
    skillPath,
    rawSnapshotPath,
    expectedName,
    ...compareImportedSkillAdaptation(rawContent, adaptedContent, {
      expectedName,
    }),
  };
}
