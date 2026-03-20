#!/usr/bin/env node

/**
 * Release script — bumps version across all required files.
 * Usage: node scripts/release.js <version>
 * Example: node scripts/release.js 1.6.0
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/release.js <version>");
  console.error("Example: node scripts/release.js 1.6.0");
  process.exit(1);
}

const files = [
  {
    path: join(ROOT, "package.json"),
    update: (content) => content.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`),
  },
  {
    path: join(ROOT, ".claude-plugin", "plugin.json"),
    update: (content) => content.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`),
  },
  {
    path: join(ROOT, ".claude-plugin", "marketplace.json"),
    update: (content) => content.replaceAll(/"version":\s*"[^"]*"/g, `"version": "${version}"`),
  },
];

let updated = 0;

for (const file of files) {
  const content = readFileSync(file.path, "utf-8");
  const newContent = file.update(content);

  if (content !== newContent) {
    writeFileSync(file.path, newContent);
    console.log(`  ✓ ${file.path.replace(ROOT + "/", "")}`);
    updated++;
  } else {
    console.log(`  · ${file.path.replace(ROOT + "/", "")} (already ${version})`);
  }
}

console.log(`\n✦ Version bumped to ${version} across ${updated} file(s).`);
console.log(`\nNext steps:`);
console.log(`  1. Update CHANGELOG.md`);
console.log(`  2. git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md`);
console.log(`  3. git commit -m "chore: bump version to ${version}"`);
console.log(`  4. git push origin main`);
console.log(`  5. npm publish --access public --provenance`);
