#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { getAllInstallLocations } from "../src/utils/paths.js";
import { findImportedSkillAcrossLocations } from "../src/utils/import-metadata.js";
import {
  compareImportedSkillAdaptation,
  inspectImportedSkillAdaptation,
} from "../src/utils/import-adaptation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "import-adaptation", "fixtures");
const RESULTS_DIR = join(__dirname, "import-adaptation", "results");

export function listImportAdaptationFixtures() {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
    .filter((name) =>
      existsSync(join(FIXTURES_DIR, name, "raw.md"))
      && existsSync(join(FIXTURES_DIR, name, "adapted.md")),
    )
    .sort();
}

export function loadImportAdaptationFixture(name) {
  const fixtureDir = join(FIXTURES_DIR, name);
  const rawPath = join(fixtureDir, "raw.md");
  const adaptedPath = join(fixtureDir, "adapted.md");

  if (!existsSync(rawPath) || !existsSync(adaptedPath)) {
    throw new Error(`Missing raw.md or adapted.md for fixture '${name}'`);
  }

  return {
    name,
    fixtureDir,
    rawPath,
    adaptedPath,
    rawContent: readFileSync(rawPath, "utf-8"),
    adaptedContent: readFileSync(adaptedPath, "utf-8"),
  };
}

export function buildFixtureImportAdaptationReport(name) {
  const fixture = loadImportAdaptationFixture(name);
  const comparison = compareImportedSkillAdaptation(
    fixture.rawContent,
    fixture.adaptedContent,
    { expectedName: name },
  );

  return {
    kind: "fixture",
    name,
    fixtureDir: fixture.fixtureDir,
    rawPath: fixture.rawPath,
    adaptedPath: fixture.adaptedPath,
    ...comparison,
  };
}

export function buildInstalledImportAdaptationReport(skill) {
  const locations = getAllInstallLocations({ scope: "all" }).skills;
  const imported = findImportedSkillAcrossLocations(skill, locations);

  if (!imported) {
    throw new Error(`Imported skill '${skill}' not found in project or user locations`);
  }

  const adaptation = inspectImportedSkillAdaptation(imported.skillDir);
  return {
    kind: "installed",
    name: skill,
    installLocation: imported.location.label,
    skillDir: imported.skillDir,
    provenance: imported.metadata?.source?.ref || imported.attribution || null,
    trustState: imported.trustState,
    ...adaptation,
  };
}

export function summarizeImportAdaptationReport(report) {
  const totals = {
    cases: report.cases.length,
    available: report.cases.filter((entry) => entry.available !== false).length,
    improved: report.cases.filter((entry) => entry.status === "improved").length,
    unchanged: report.cases.filter((entry) => entry.status === "unchanged").length,
    regressed: report.cases.filter((entry) => entry.status === "regressed").length,
    unavailable: report.cases.filter((entry) => entry.available === false).length,
  };

  const averageDelta = totals.available === 0
    ? null
    : Number(
        (
          report.cases
            .filter((entry) => typeof entry.scoreDelta === "number")
            .reduce((sum, entry) => sum + entry.scoreDelta, 0)
          / Math.max(
            1,
            report.cases.filter((entry) => typeof entry.scoreDelta === "number").length,
          )
        ).toFixed(4),
      );

  return {
    ...totals,
    averageDelta,
  };
}

export function renderImportAdaptationMarkdown(report) {
  const lines = [
    "# Arcana Import Adaptation Summary",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Cases: ${report.summary.cases} | Improved: ${report.summary.improved} | Unchanged: ${report.summary.unchanged} | Regressed: ${report.summary.regressed} | Unavailable: ${report.summary.unavailable}`,
    "",
  ];

  for (const entry of report.cases) {
    lines.push(`## ${entry.name}`);
    if (entry.available === false) {
      lines.push("");
      lines.push(`- Status: unavailable (${entry.reason})`);
      lines.push("");
      continue;
    }

    const delta = entry.scoreDeltaPercent >= 0
      ? `+${entry.scoreDeltaPercent}`
      : `${entry.scoreDeltaPercent}`;
    lines.push("");
    lines.push(`- Status: ${entry.status}`);
    lines.push(`- Score: ${entry.rawScorePercent} -> ${entry.adaptedScorePercent} (${delta}pp)`);
    if (entry.improvedAreas?.length > 0) {
      lines.push(`- Improved areas: ${entry.improvedAreas.join(", ")}`);
    }
    if (entry.regressedAreas?.length > 0) {
      lines.push(`- Regressed areas: ${entry.regressedAreas.join(", ")}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function writeImportAdaptationArtifacts(report) {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = join(RESULTS_DIR, "latest.json");
  const markdownPath = join(RESULTS_DIR, "latest.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderImportAdaptationMarkdown(report));
  return { jsonPath, markdownPath };
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    fixture: null,
    skill: null,
    json: false,
  };

  while (args.length > 0) {
    const current = args.shift();
    if (!current) continue;

    switch (current) {
      case "--fixture":
        options.fixture = args.shift() || null;
        break;
      case "--skill":
        options.skill = args.shift() || null;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        printUsageAndExit();
        break;
      default:
        printUsageAndExit(`Unknown argument: ${current}`);
    }
  }

  return options;
}

function printUsageAndExit(message) {
  if (message) console.error(message);
  console.error("");
  console.error("Usage:");
  console.error("  node evals/run-import-adaptation.js");
  console.error("  node evals/run-import-adaptation.js --fixture legacy-skill");
  console.error("  node evals/run-import-adaptation.js --skill imported-skill-name");
  console.error("  node evals/run-import-adaptation.js --json");
  process.exit(message ? 1 : 0);
}

function printReport(report, artifactPaths) {
  console.log("✦ Arcana Import Adaptation Eval\n");
  console.log(
    `  Cases: ${report.summary.cases} | Improved: ${report.summary.improved} | Unchanged: ${report.summary.unchanged} | Regressed: ${report.summary.regressed} | Unavailable: ${report.summary.unavailable}`,
  );
  if (typeof report.summary.averageDelta === "number") {
    const delta = report.summary.averageDelta >= 0
      ? `+${Math.round(report.summary.averageDelta * 100)}`
      : `${Math.round(report.summary.averageDelta * 100)}`;
    console.log(`  Average score delta: ${delta}pp`);
  }
  console.log("");

  for (const entry of report.cases) {
    console.log(`  ${entry.name}`);
    if (entry.available === false) {
      console.log(`    unavailable (${entry.reason})`);
      continue;
    }

    const delta = entry.scoreDeltaPercent >= 0
      ? `+${entry.scoreDeltaPercent}`
      : `${entry.scoreDeltaPercent}`;
    console.log(
      `    ${entry.status} | ${entry.rawScorePercent} -> ${entry.adaptedScorePercent} (${delta}pp)`,
    );
    if (entry.improvedAreas?.length > 0) {
      console.log(`    improved: ${entry.improvedAreas.join(", ")}`);
    }
    if (entry.regressedAreas?.length > 0) {
      console.log(`    regressed: ${entry.regressedAreas.join(", ")}`);
    }
  }

  console.log("");
  console.log(`  Results saved: ${relative(process.cwd(), artifactPaths.jsonPath)}`);
  console.log(`  Markdown:      ${relative(process.cwd(), artifactPaths.markdownPath)}`);
  console.log("");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.fixture && options.skill) {
    printUsageAndExit("Use either --fixture or --skill, not both.");
  }

  let cases;
  if (options.skill) {
    cases = [buildInstalledImportAdaptationReport(options.skill)];
  } else if (options.fixture) {
    cases = [buildFixtureImportAdaptationReport(options.fixture)];
  } else {
    cases = listImportAdaptationFixtures().map((name) =>
      buildFixtureImportAdaptationReport(name),
    );
  }

  const report = {
    kind: "arcana-import-adaptation",
    generatedAt: new Date().toISOString(),
    source: options.skill ? "installed-skill" : "fixtures",
    cases,
  };
  report.summary = summarizeImportAdaptationReport(report);
  const artifactPaths = writeImportAdaptationArtifacts(report);

  if (options.json) {
    console.log(JSON.stringify({ report, artifactPaths }, null, 2));
    return;
  }

  printReport(report, artifactPaths);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
