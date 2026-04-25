import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { SCORE_DIMENSIONS, validateScenario } from "../evals/run-eval.js";
import { getSkillCatalog } from "../src/utils/catalog.js";
import { getPackageRoot } from "../src/utils/paths.js";

const packageRoot = getPackageRoot();
const scenariosDir = join(packageRoot, "evals", "scenarios");

function listScenarioNames() {
  if (!existsSync(scenariosDir)) return [];
  return readdirSync(scenariosDir).filter((name) =>
    existsSync(join(scenariosDir, name, "manifest.json")),
  );
}

function listScenarioFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    for (const name of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, name);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      files.push(absolutePath);
    }
  }

  walk(rootDir);
  return files;
}

function hasPlaceholderText(value) {
  return value.includes("TODO:")
    || value.includes("Replace this fixture")
    || value.includes("Replace Before Release");
}

describe("eval coverage", () => {
  const scenarioNames = listScenarioNames();
  const manifests = scenarioNames.map((scenarioName) => {
    const scenarioDir = join(scenariosDir, scenarioName);
    const manifestPath = join(scenarioDir, "manifest.json");

    return {
      scenarioName,
      scenarioDir,
      manifestPath,
      manifest: JSON.parse(readFileSync(manifestPath, "utf-8")),
    };
  });

  it("gives every shipped first-party skill at least one scenario", () => {
    const coveredSkills = new Set(manifests.map(({ manifest }) => manifest.skill));

    for (const skill of getSkillCatalog()) {
      expect(
        coveredSkills.has(skill.name),
        `Missing eval scenario for skill '${skill.name}'`,
      ).toBe(true);
    }
  });

  it("keeps every shipped scenario valid and non-placeholder", () => {
    for (const { scenarioName, scenarioDir, manifest } of manifests) {
      expect(validateScenario(manifest), `Scenario '${scenarioName}' is invalid`).toEqual([]);
      expect(
        manifest.scoring?.weights,
        `Scenario '${scenarioName}' must declare scoring.weights`,
      ).toBeDefined();

      const coveredDimensions = new Set([
        ...(manifest.expected || []).map((assertion) => assertion.dimension),
        ...(manifest.falsePositives || []).map((assertion) => assertion.dimension),
      ]);

      expect(
        SCORE_DIMENSIONS.every((dimension) => coveredDimensions.has(dimension)),
        `Scenario '${scenarioName}' must cover route, process, and outcome dimensions`,
      ).toBe(true);

      const scenarioFiles = listScenarioFiles(scenarioDir);
      const fixtureFiles = scenarioFiles.filter((file) =>
        !file.endsWith("manifest.json") && !file.endsWith("README.md"),
      );

      expect(
        fixtureFiles.length,
        `Scenario '${scenarioName}' must include at least one real fixture file`,
      ).toBeGreaterThan(0);

      for (const filePath of scenarioFiles) {
        const content = readFileSync(filePath, "utf-8");
        expect(
          hasPlaceholderText(content),
          `Scenario '${scenarioName}' still contains scaffold placeholder text in ${filePath.replace(`${packageRoot}/`, "")}`,
        ).toBe(false);
      }
    }
  });
});
