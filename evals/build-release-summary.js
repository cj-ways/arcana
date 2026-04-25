#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import {
  buildReleaseQualitySummary,
  renderReleaseQualityMarkdown,
} from "../src/utils/release-quality.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "release-quality");

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    staleDays: 14,
    json: false,
    check: false,
  };

  while (args.length > 0) {
    const current = args.shift();
    if (!current) continue;

    switch (current) {
      case "--stale-days": {
        const parsed = Number.parseInt(String(args.shift() || ""), 10);
        options.staleDays = parsed;
        break;
      }
      case "--json":
        options.json = true;
        break;
      case "--check":
        options.check = true;
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
  console.error("  node evals/build-release-summary.js");
  console.error("  node evals/build-release-summary.js --stale-days 7");
  console.error("  node evals/build-release-summary.js --check");
  console.error("  node evals/build-release-summary.js --json");
  process.exit(message ? 1 : 0);
}

function writeArtifacts(summary) {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = join(OUTPUT_DIR, "latest.json");
  const markdownPath = join(OUTPUT_DIR, "latest.md");
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(markdownPath, renderReleaseQualityMarkdown(summary));
  return { jsonPath, markdownPath };
}

function printSummary(summary, artifactPaths) {
  console.log("✦ Arcana Release Quality Summary\n");
  console.log(`  Release ready: ${summary.releaseReady ? "yes" : "no"}`);
  console.log(
    `  Scorecards: ${summary.scorecards.coveredSkills}/${summary.skillCount} covered | missing ${summary.scorecards.missingSkills.length} | stale ${summary.scorecards.staleSkills.length}`,
  );
  console.log(
    `  Triggers:   ${summary.triggers.coveredSkills}/${summary.skillCount} covered | missing ${summary.triggers.missingSkills.length} | stale ${summary.triggers.staleSkills.length}`,
  );
  console.log(
    `  Feedback:   ${summary.feedback.candidateCount} open candidate(s) | ${summary.feedback.highPriorityCount} high priority | ${summary.feedback.draftCount} draft pack(s)`,
  );
  console.log("");

  if (summary.blockingItems.length > 0) {
    console.log("  Blocking:");
    for (const item of summary.blockingItems) {
      console.log(`    - ${item}`);
    }
    console.log("");
  }

  if (summary.attentionItems.length > 0) {
    console.log("  Attention:");
    for (const item of summary.attentionItems) {
      console.log(`    - ${item}`);
    }
    console.log("");
  }

  console.log(`  JSON:     ${relative(process.cwd(), artifactPaths.jsonPath)}`);
  console.log(`  Markdown: ${relative(process.cwd(), artifactPaths.markdownPath)}`);
  console.log("");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(options.staleDays) || options.staleDays < 0) {
    printUsageAndExit("Invalid --stale-days value. Use a non-negative integer.");
  }

  const summary = buildReleaseQualitySummary({
    cwd: process.cwd(),
    staleDays: options.staleDays,
  });
  const artifactPaths = writeArtifacts(summary);

  if (options.json) {
    console.log(JSON.stringify({ summary, artifactPaths }, null, 2));
  } else {
    printSummary(summary, artifactPaths);
  }

  if (options.check && !summary.releaseReady) {
    process.exit(1);
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
