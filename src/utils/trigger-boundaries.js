import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getPackageRoot } from "./paths.js";

export const TRIGGER_BOUNDARY_SETS = Object.freeze(["train", "validation"]);

function hasPlaceholderText(value) {
  return String(value || "").includes("TODO:")
    || String(value || "").includes("Replace this")
    || String(value || "").includes("Replace Before Release");
}

export function getTriggerBoundariesDir() {
  return join(getPackageRoot(), "evals", "trigger-boundaries");
}

export function getTriggerBoundaryPath(name) {
  return join(getTriggerBoundariesDir(), `${name}.json`);
}

export function listTriggerBoundarySuites() {
  const rootDir = getTriggerBoundariesDir();
  if (!existsSync(rootDir)) return [];

  return readdirSync(rootDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/u, ""))
    .sort();
}

export function readTriggerBoundarySuite(name) {
  return JSON.parse(readFileSync(getTriggerBoundaryPath(name), "utf-8"));
}

export function validateTriggerBoundarySuite(suite) {
  const errors = [];

  if (!suite || typeof suite !== "object" || Array.isArray(suite)) {
    return ["trigger boundary suite must be an object"];
  }

  if (!suite.name || typeof suite.name !== "string" || !suite.name.trim()) {
    errors.push("name must be a non-empty string");
  }

  if (!suite.description || typeof suite.description !== "string" || !suite.description.trim()) {
    errors.push("description must be a non-empty string");
  } else if (hasPlaceholderText(suite.description)) {
    errors.push("description still contains placeholder text");
  }

  if (!Array.isArray(suite.topics) || suite.topics.length === 0) {
    errors.push("topics must be a non-empty array");
    return errors;
  }

  const topicIds = new Set();
  const caseIds = new Set();
  const prompts = new Set();

  suite.topics.forEach((topic, topicIndex) => {
    const topicLabel = `topics[${topicIndex}]`;

    if (!topic || typeof topic !== "object" || Array.isArray(topic)) {
      errors.push(`${topicLabel} must be an object`);
      return;
    }

    if (!topic.id || typeof topic.id !== "string" || !topic.id.trim()) {
      errors.push(`${topicLabel}.id must be a non-empty string`);
    } else if (topicIds.has(topic.id)) {
      errors.push(`${topicLabel}.id must be unique`);
    } else {
      topicIds.add(topic.id);
    }

    if (!TRIGGER_BOUNDARY_SETS.includes(topic.set)) {
      errors.push(`${topicLabel}.set must be one of: ${TRIGGER_BOUNDARY_SETS.join(", ")}`);
    }

    if (!topic.description || typeof topic.description !== "string" || !topic.description.trim()) {
      errors.push(`${topicLabel}.description must be a non-empty string`);
    } else if (hasPlaceholderText(topic.description)) {
      errors.push(`${topicLabel}.description still contains placeholder text`);
    }

    if (!Array.isArray(topic.cases) || topic.cases.length === 0) {
      errors.push(`${topicLabel}.cases must be a non-empty array`);
      return;
    }

    topic.cases.forEach((caseEntry, caseIndex) => {
      const caseLabel = `${topicLabel}.cases[${caseIndex}]`;

      if (!caseEntry || typeof caseEntry !== "object" || Array.isArray(caseEntry)) {
        errors.push(`${caseLabel} must be an object`);
        return;
      }

      const combinedId = `${topic.id || `<missing-topic-${topicIndex}>`}:${caseEntry.id || `<missing-case-${caseIndex}>`}`;

      if (!caseEntry.id || typeof caseEntry.id !== "string" || !caseEntry.id.trim()) {
        errors.push(`${caseLabel}.id must be a non-empty string`);
      } else if (caseIds.has(combinedId)) {
        errors.push(`${caseLabel}.id must be unique within the suite`);
      } else {
        caseIds.add(combinedId);
      }

      if (!caseEntry.prompt || typeof caseEntry.prompt !== "string" || !caseEntry.prompt.trim()) {
        errors.push(`${caseLabel}.prompt must be a non-empty string`);
      } else if (hasPlaceholderText(caseEntry.prompt)) {
        errors.push(`${caseLabel}.prompt still contains placeholder text`);
      } else if (prompts.has(caseEntry.prompt.trim())) {
        errors.push(`${caseLabel}.prompt must be unique within the suite`);
      } else {
        prompts.add(caseEntry.prompt.trim());
      }

      if (!caseEntry.reason || typeof caseEntry.reason !== "string" || !caseEntry.reason.trim()) {
        errors.push(`${caseLabel}.reason must be a non-empty string`);
      } else if (hasPlaceholderText(caseEntry.reason)) {
        errors.push(`${caseLabel}.reason still contains placeholder text`);
      }

      if (!Array.isArray(caseEntry.expectedSkills) || caseEntry.expectedSkills.length === 0) {
        errors.push(`${caseLabel}.expectedSkills must be a non-empty array`);
      } else if (caseEntry.expectedSkills.some((skill) => typeof skill !== "string" || !skill.trim())) {
        errors.push(`${caseLabel}.expectedSkills must contain only non-empty strings`);
      }

      if (caseEntry.forbiddenSkills !== undefined) {
        if (!Array.isArray(caseEntry.forbiddenSkills) || caseEntry.forbiddenSkills.some((skill) => typeof skill !== "string" || !skill.trim())) {
          errors.push(`${caseLabel}.forbiddenSkills must be an array of non-empty strings`);
        }
      }

      if (caseEntry.allowAdditionalSkills !== undefined && typeof caseEntry.allowAdditionalSkills !== "boolean") {
        errors.push(`${caseLabel}.allowAdditionalSkills must be a boolean when provided`);
      }
    });
  });

  return errors;
}
