import fsExtra from "fs-extra";
const { copySync, ensureDirSync, existsSync, readFileSync, moveSync } = fsExtra;
import { createHash } from "crypto";
import { dirname, join } from "path";
import { getPackageSkillsDir, getPackageAgentsDir, getPackageRoot } from "./paths.js";

const ARCANA_MARKER_PREFIX = "<!-- arcana-managed";
const ARCANA_MARKER_REGEX = /<!-- arcana-managed(?:\s+version:(?<version>[^\s>]+))?(?:\s+hash:(?<hash>[a-f0-9]{64}))?\s*-->/i;
const ARCANA_MARKER_LINE_REGEX = /<!-- arcana-managed(?:\s+version:[^\s>]+)?(?:\s+hash:[a-f0-9]{64})?\s*-->\n?/gi;
let _packageVersion = null;

function getPackageVersion() {
  if (_packageVersion) return _packageVersion;

  try {
    const pkg = JSON.parse(
      readFileSync(join(getPackageRoot(), "package.json"), "utf-8")
    );
    _packageVersion = pkg.version || null;
  } catch {
    _packageVersion = null;
  }

  return _packageVersion;
}

export function parseArcanaMarker(content) {
  const match = content.replace(/\r\n/g, "\n").match(ARCANA_MARKER_REGEX);
  if (!match) return null;

  return {
    version: match.groups?.version || null,
    hash: match.groups?.hash || null,
  };
}

export function stripArcanaMarker(content) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(ARCANA_MARKER_LINE_REGEX, "");
}

/**
 * Normalize managed file content so marker and line-ending differences do not
 * affect ownership checks.
 */
function normalizeManagedContent(content) {
  return stripArcanaMarker(content).trimEnd();
}

export function getManagedContentHash(content) {
  return createHash("sha256")
    .update(normalizeManagedContent(content))
    .digest("hex");
}

function buildArcanaMarker({ version = getPackageVersion(), hash } = {}) {
  const parts = [ARCANA_MARKER_PREFIX];
  if (version) parts.push(`version:${version}`);
  if (hash) parts.push(`hash:${hash}`);
  return `${parts.join(" ")} -->`;
}

function getArcanaSourceFiles() {
  const skillSources = [];
  const skillsDir = getPackageSkillsDir();
  if (existsSync(skillsDir)) {
    for (const name of fsExtra.readdirSync(skillsDir)) {
      const skillPath = join(skillsDir, name, "SKILL.md");
      if (existsSync(skillPath)) skillSources.push(skillPath);
    }
  }

  const agentSources = [];
  const agentsDir = getPackageAgentsDir();
  if (existsSync(agentsDir)) {
    for (const name of fsExtra.readdirSync(agentsDir)) {
      const agentPath = join(agentsDir, name);
      if (existsSync(agentPath)) agentSources.push(agentPath);
    }
  }

  return [...skillSources, ...agentSources];
}

/**
 * Check if a file was installed by Arcana.
 *
 * Legacy installs without a marker are only trusted when the content matches
 * an Arcana source file exactly. This biases toward preserving user custom
 * files over guessing ownership from a matching frontmatter name.
 */
export function isArcanaManaged(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");

    if (parseArcanaMarker(content)) return true;

    const installedContent = normalizeManagedContent(content);
    for (const sourcePath of getArcanaSourceFiles()) {
      const sourceContent = normalizeManagedContent(readFileSync(sourcePath, "utf-8"));
      if (installedContent === sourceContent) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Add or refresh Arcana marker metadata in managed content.
 */
export function markArcanaManaged(content, metadata = {}) {
  const normalizedContent = stripArcanaMarker(content);
  const marker = buildArcanaMarker({
    version: metadata.version ?? getPackageVersion(),
    hash: metadata.hash ?? getManagedContentHash(normalizedContent),
  });

  // Insert marker after the closing --- of frontmatter
  // Use regex to match only the frontmatter block (first two --- delimiters)
  const fmMatch = normalizedContent.match(/^(---\n[\s\S]*?\n---)\n?/);
  if (fmMatch) {
    const afterFm = normalizedContent.slice(fmMatch[0].length);
    return `${fmMatch[1]}\n${marker}\n${afterFm}`;
  }
  return `${marker}\n${normalizedContent}`;
}

function classifyManagedFile(sourceContent, installedContent) {
  const sourceHash = getManagedContentHash(sourceContent);
  const installedHash = getManagedContentHash(installedContent);
  const marker = parseArcanaMarker(installedContent);
  const packageVersion = getPackageVersion();

  if (installedHash === sourceHash) {
    if (marker?.hash === sourceHash && marker?.version === packageVersion) {
      return { status: "current", sourceHash };
    }
    return { status: "updated", sourceHash, reason: "metadata" };
  }

  if (!marker?.hash) {
    return { status: "legacy", sourceHash };
  }

  if (marker.hash === installedHash) {
    return { status: "updated", sourceHash, reason: "stale" };
  }

  return { status: "modified", sourceHash };
}

function writeManagedSkill(src, dest, sourceHash) {
  copySync(src, dest, { overwrite: true });

  const installedPath = join(dest, "SKILL.md");
  if (existsSync(installedPath)) {
    const sourceContent = readFileSync(join(src, "SKILL.md"), "utf-8");
    fsExtra.writeFileSync(installedPath, markArcanaManaged(sourceContent, { hash: sourceHash }));
  }
}

function writeManagedAgent(src, dest, sourceHash) {
  ensureDirSync(dirname(dest));
  copySync(src, dest, { overwrite: true });

  const content = readFileSync(src, "utf-8");
  fsExtra.writeFileSync(dest, markArcanaManaged(content, { hash: sourceHash }));
}

export function copySkills(skillNames, targetSkillsDir, { force = false, refreshLegacy = false, dryRun = false } = {}) {
  const sourceDir = getPackageSkillsDir();
  const results = [];

  for (const name of skillNames) {
    const src = join(sourceDir, name);
    const dest = join(targetSkillsDir, name);
    const destSkillMd = join(dest, "SKILL.md");

    if (!existsSync(src)) {
      results.push({ name, status: "not found" });
      continue;
    }

    const sourceContent = readFileSync(join(src, "SKILL.md"), "utf-8");
    const sourceHash = getManagedContentHash(sourceContent);

    if (!existsSync(destSkillMd)) {
      if (!dryRun) {
        ensureDirSync(dest);
        writeManagedSkill(src, dest, sourceHash);
      }
      results.push({ name, status: "installed" });
      continue;
    }

    const installedContent = readFileSync(destSkillMd, "utf-8");
    if (!isArcanaManaged(destSkillMd)) {
      if (!force) {
        results.push({ name, status: "conflict" });
        continue;
      }

      if (!dryRun) {
        ensureDirSync(dest);
        writeManagedSkill(src, dest, sourceHash);
      }
      results.push({ name, status: "updated", reason: "forced" });
      continue;
    }

    const state = classifyManagedFile(sourceContent, installedContent);
    if (state.status === "current") {
      results.push({ name, status: "current" });
      continue;
    }

    if (!force && state.status === "modified") {
      results.push({ name, status: state.status });
      continue;
    }

    if (!force && state.status === "legacy" && !refreshLegacy) {
      results.push({ name, status: state.status });
      continue;
    }

    if (!dryRun) {
      ensureDirSync(dest);
      writeManagedSkill(src, dest, state.sourceHash);
    }
    results.push({
      name,
      status: "updated",
      reason: state.status === "legacy" ? "legacy" : state.reason,
    });
  }

  return results;
}

export function copyAgents(agentNames, targetAgentsDir, { force = false, refreshLegacy = false, dryRun = false } = {}) {
  if (!targetAgentsDir) return [];

  const sourceDir = getPackageAgentsDir();
  const results = [];

  for (const name of agentNames) {
    const src = join(sourceDir, `${name}.md`);
    const dest = join(targetAgentsDir, `${name}.md`);

    if (!existsSync(src)) {
      results.push({ name, status: "not found" });
      continue;
    }

    const sourceContent = readFileSync(src, "utf-8");
    const sourceHash = getManagedContentHash(sourceContent);

    if (!existsSync(dest)) {
      if (!dryRun) {
        ensureDirSync(targetAgentsDir);
        writeManagedAgent(src, dest, sourceHash);
      }
      results.push({ name, status: "installed" });
      continue;
    }

    const installedContent = readFileSync(dest, "utf-8");
    if (!isArcanaManaged(dest)) {
      if (!force) {
        results.push({ name, status: "conflict" });
        continue;
      }

      if (!dryRun) {
        ensureDirSync(targetAgentsDir);
        writeManagedAgent(src, dest, sourceHash);
      }
      results.push({ name, status: "updated", reason: "forced" });
      continue;
    }

    const state = classifyManagedFile(sourceContent, installedContent);
    if (state.status === "current") {
      results.push({ name, status: "current" });
      continue;
    }

    if (!force && state.status === "modified") {
      results.push({ name, status: state.status });
      continue;
    }

    if (!force && state.status === "legacy" && !refreshLegacy) {
      results.push({ name, status: state.status });
      continue;
    }

    if (!dryRun) {
      ensureDirSync(targetAgentsDir);
      writeManagedAgent(src, dest, state.sourceHash);
    }
    results.push({
      name,
      status: "updated",
      reason: state.status === "legacy" ? "legacy" : state.reason,
    });
  }

  return results;
}

/**
 * Update the `name` field in YAML frontmatter using line-by-line rewrite.
 * Avoids fragile regex replacement on raw text.
 */
function rewriteFrontmatterName(content, newName) {
  const fmMatch = content.match(/^(---\n)([\s\S]*?\n)(---)/);
  if (!fmMatch) return content;

  const lines = fmMatch[2].split("\n");
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(":");
    if (colonIdx !== -1 && lines[i].slice(0, colonIdx).trim() === "name") {
      lines[i] = `name: ${newName}`;
      found = true;
      break;
    }
  }
  if (!found) return content;
  return fmMatch[1] + lines.join("\n") + fmMatch[3] + content.slice(fmMatch[0].length);
}

export function renameExistingSkill(skillsDir, oldName, newName) {
  const oldPath = join(skillsDir, oldName);
  const newPath = join(skillsDir, newName);

  if (!existsSync(oldPath)) return false;
  if (existsSync(newPath)) return false;

  moveSync(oldPath, newPath);

  // Update name in SKILL.md frontmatter
  const skillMd = join(newPath, "SKILL.md");
  if (existsSync(skillMd)) {
    const content = readFileSync(skillMd, "utf-8");
    const updated = rewriteFrontmatterName(content, newName);
    if (updated !== content) fsExtra.writeFileSync(skillMd, updated);
  }

  return true;
}

export function renameExistingAgent(agentsDir, oldName, newName) {
  const oldPath = join(agentsDir, `${oldName}.md`);
  const newPath = join(agentsDir, `${newName}.md`);

  if (!existsSync(oldPath)) return false;
  if (existsSync(newPath)) return false;

  moveSync(oldPath, newPath);

  const content = readFileSync(newPath, "utf-8");
  const updated = rewriteFrontmatterName(content, newName);
  if (updated !== content) fsExtra.writeFileSync(newPath, updated);

  return true;
}

export function mirrorSkills(canonicalDir, mirrorDirs, { dryRun = false } = {}) {
  const results = [];

  for (const mirrorDir of mirrorDirs) {
    if (!dryRun) {
      ensureDirSync(mirrorDir);
      copySync(canonicalDir, mirrorDir, { overwrite: true });
    }
    results.push({ dir: mirrorDir, status: "synced" });
  }

  return results;
}
