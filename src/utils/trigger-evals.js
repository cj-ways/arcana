import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getPackageRoot } from "./paths.js";

export const TRIGGER_EVAL_SETS = Object.freeze(["train", "validation"]);
export const TRIGGER_EVAL_COLLECTIONS = Object.freeze(["shouldTrigger", "shouldNotTrigger"]);
export const TRIGGER_EVAL_TOTALS = Object.freeze({
  shouldTrigger: 10,
  shouldNotTrigger: 10,
});
export const TRIGGER_EVAL_SET_TOTALS = Object.freeze({
  train: 6,
  validation: 4,
});

function hasPlaceholderText(value) {
  return String(value || "").includes("TODO:")
    || String(value || "").includes("Replace this")
    || String(value || "").includes("Replace Before Release");
}

export function getTriggerEvalsDir() {
  return join(getPackageRoot(), "evals", "triggers");
}

export function getTriggerEvalPath(skillName) {
  return join(getTriggerEvalsDir(), `${skillName}.json`);
}

export function listTriggerEvalSkills() {
  const rootDir = getTriggerEvalsDir();
  if (!existsSync(rootDir)) return [];

  return readdirSync(rootDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/u, ""))
    .sort();
}

export function readTriggerEvalPack(skillName) {
  return JSON.parse(readFileSync(getTriggerEvalPath(skillName), "utf-8"));
}

function validateEntries(entries, collectionName, errors) {
  if (!Array.isArray(entries)) {
    errors.push(`${collectionName} must be an array`);
    return;
  }

  if (entries.length !== TRIGGER_EVAL_TOTALS[collectionName]) {
    errors.push(
      `${collectionName} must contain exactly ${TRIGGER_EVAL_TOTALS[collectionName]} entries`,
    );
  }

  const ids = new Set();
  const prompts = new Set();
  const setCounts = {
    train: 0,
    validation: 0,
  };

  entries.forEach((entry, index) => {
    const label = `${collectionName}[${index}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label} must be an object`);
      return;
    }

    if (!entry.id || typeof entry.id !== "string") {
      errors.push(`${label}.id must be a non-empty string`);
    } else if (ids.has(entry.id)) {
      errors.push(`${label}.id must be unique within ${collectionName}`);
    } else {
      ids.add(entry.id);
    }

    if (!TRIGGER_EVAL_SETS.includes(entry.set)) {
      errors.push(`${label}.set must be one of: ${TRIGGER_EVAL_SETS.join(", ")}`);
    } else {
      setCounts[entry.set] += 1;
    }

    if (!entry.prompt || typeof entry.prompt !== "string" || !entry.prompt.trim()) {
      errors.push(`${label}.prompt must be a non-empty string`);
    } else if (hasPlaceholderText(entry.prompt)) {
      errors.push(`${label}.prompt still contains placeholder text`);
    } else if (prompts.has(entry.prompt.trim())) {
      errors.push(`${label}.prompt must be unique within ${collectionName}`);
    } else {
      prompts.add(entry.prompt.trim());
    }

    if (!entry.reason || typeof entry.reason !== "string" || !entry.reason.trim()) {
      errors.push(`${label}.reason must be a non-empty string`);
    } else if (hasPlaceholderText(entry.reason)) {
      errors.push(`${label}.reason still contains placeholder text`);
    }

    if (entry.expectedSkills !== undefined) {
      if (!Array.isArray(entry.expectedSkills) || entry.expectedSkills.some((skill) => typeof skill !== "string" || !skill.trim())) {
        errors.push(`${label}.expectedSkills must be an array of non-empty strings`);
      }
    }

    if (entry.forbiddenSkills !== undefined) {
      if (!Array.isArray(entry.forbiddenSkills) || entry.forbiddenSkills.some((skill) => typeof skill !== "string" || !skill.trim())) {
        errors.push(`${label}.forbiddenSkills must be an array of non-empty strings`);
      }
    }

    if (entry.allowAdditionalSkills !== undefined && typeof entry.allowAdditionalSkills !== "boolean") {
      errors.push(`${label}.allowAdditionalSkills must be a boolean when provided`);
    }
  });

  TRIGGER_EVAL_SETS.forEach((setName) => {
    if (setCounts[setName] !== TRIGGER_EVAL_SET_TOTALS[setName]) {
      errors.push(
        `${collectionName} must contain exactly ${TRIGGER_EVAL_SET_TOTALS[setName]} ${setName} entries`,
      );
    }
  });
}

export function validateTriggerEvalPack(pack) {
  const errors = [];

  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    return ["trigger eval pack must be an object"];
  }

  if (!pack.skill || typeof pack.skill !== "string") {
    errors.push("skill must be a non-empty string");
  }

  if (!pack.description || typeof pack.description !== "string" || !pack.description.trim()) {
    errors.push("description must be a non-empty string");
  } else if (hasPlaceholderText(pack.description)) {
    errors.push("description still contains placeholder text");
  }

  TRIGGER_EVAL_COLLECTIONS.forEach((collectionName) => {
    validateEntries(pack[collectionName], collectionName, errors);
  });

  return errors;
}
