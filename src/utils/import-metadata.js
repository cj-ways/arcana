import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { getPackageRoot } from "./paths.js";

export const IMPORT_METADATA_FILE = ".arcana-import.json";
export const IMPORT_RAW_SNAPSHOT_FILE = ".arcana-import.raw.md";
export const IMPORT_METADATA_SCHEMA_VERSION = 1;
const IMPORT_ATTRIBUTION_REGEX = /^<!-- Imported by Arcana from: (?<label>.+?) -->\n?/i;

let cachedPackageVersion = null;

function getPackageVersion() {
  if (cachedPackageVersion) return cachedPackageVersion;

  try {
    const pkg = JSON.parse(readFileSync(join(getPackageRoot(), "package.json"), "utf-8"));
    cachedPackageVersion = pkg.version || null;
  } catch {
    cachedPackageVersion = null;
  }

  return cachedPackageVersion;
}

function sanitizeAttributionLabel(label) {
  return String(label || "")
    .replace(/\r?\n+/g, " ")
    .replace(/-{2,}/g, "- -")
    .trim();
}

export function parseImportAttribution(content) {
  const match = String(content || "").replace(/\r\n/g, "\n").match(IMPORT_ATTRIBUTION_REGEX);
  return match?.groups?.label || null;
}

export function stripImportAttribution(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(IMPORT_ATTRIBUTION_REGEX, "");
}

export function buildImportAttribution(label) {
  const safeLabel = sanitizeAttributionLabel(label);
  return `<!-- Imported by Arcana from: ${safeLabel} -->`;
}

export function prependImportAttribution(content, label) {
  return `${buildImportAttribution(label)}\n${stripImportAttribution(content)}`;
}

function normalizeImportedContent(content) {
  return stripImportAttribution(content).trimEnd();
}

export function getImportedContentChecksum(content) {
  return createHash("sha256")
    .update(normalizeImportedContent(content))
    .digest("hex");
}

export function getImportMetadataPath(skillDir) {
  return join(skillDir, IMPORT_METADATA_FILE);
}

export function getImportRawSnapshotPath(skillDir) {
  return join(skillDir, IMPORT_RAW_SNAPSHOT_FILE);
}

export function readImportMetadata(skillDir) {
  const filePath = getImportMetadataPath(skillDir);
  if (!existsSync(filePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeImportMetadata(skillDir, metadata) {
  writeFileSync(
    getImportMetadataPath(skillDir),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

export function readImportRawSnapshot(skillDir) {
  const filePath = getImportRawSnapshotPath(skillDir);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

export function writeImportRawSnapshot(skillDir, content) {
  writeFileSync(
    getImportRawSnapshotPath(skillDir),
    `${stripImportAttribution(content).trimEnd()}\n`,
  );
}

export function buildImportMetadata({
  name,
  source,
  checksum,
  importedAt = new Date().toISOString(),
  arcanaVersion = getPackageVersion(),
}) {
  return {
    schemaVersion: IMPORT_METADATA_SCHEMA_VERSION,
    kind: "imported-skill",
    name,
    source,
    checksum,
    importedAt,
    arcanaVersion,
  };
}

export function buildImportSource({
  input,
  label,
  type,
  owner = null,
  repo = null,
  branch = null,
  path = null,
  url = null,
  localPath = null,
}) {
  let ref = label || input;

  if (type === "github-repo" || type === "github-skill") {
    const safePath = path || ".";
    ref = `github:${owner}/${repo}@${branch || "main"}:${safePath}`;
  } else if (type === "local") {
    ref = `file:${localPath || label || input}`;
  } else if (type === "url") {
    ref = url || label || input;
  }

  return {
    type,
    input,
    label,
    ref,
    owner,
    repo,
    branch,
    path,
    url,
    localPath,
  };
}

export function inspectImportedSkill(skillDir) {
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  const content = readFileSync(skillPath, "utf-8");
  const metadata = readImportMetadata(skillDir);
  const attribution = parseImportAttribution(content);

  if (!metadata && !attribution) return null;

  const currentChecksum = getImportedContentChecksum(content);
  let trustState = "current";

  if (!metadata) {
    trustState = "legacy-metadata-missing";
  } else if (metadata.checksum !== currentChecksum) {
    trustState = "modified-locally";
  }

  return {
    skillDir,
    skillPath,
    metadata,
    attribution,
    currentChecksum,
    trustState,
    hasMetadata: Boolean(metadata),
    hasAttribution: Boolean(attribution),
    rawSnapshotPath: getImportRawSnapshotPath(skillDir),
    hasRawSnapshot: existsSync(getImportRawSnapshotPath(skillDir)),
  };
}

export function listImportedSkillsInDir(skillsDir) {
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir)
    .map((name) => {
      const skillDir = join(skillsDir, name);
      if (!statSync(skillDir).isDirectory()) return null;
      const inspection = inspectImportedSkill(skillDir);
      return inspection
        ? { name, ...inspection }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findImportedSkillAcrossLocations(skill, locations) {
  for (const loc of locations) {
    const skillDir = join(loc.dir, skill);
    const inspection = inspectImportedSkill(skillDir);
    if (inspection) {
      return {
        location: loc,
        name: skill,
        ...inspection,
      };
    }
  }

  return null;
}

export function summarizeImportOverwriteRisk({
  targetExists = false,
  existingInspection = null,
  incomingName,
  incomingChecksum,
  incomingSource,
  incomingLines,
}) {
  if (targetExists && !existingInspection) {
    return {
      riskLevel: "high",
      status: "unknown-existing",
      summary: "Existing skill has unknown provenance; overwrite would replace a custom or unmanaged install.",
      details: [
        `Incoming checksum ${incomingChecksum.slice(0, 12)}`,
        `Incoming source ${incomingSource.ref}`,
        `Target skill ${incomingName}`,
      ],
    };
  }

  if (!existingInspection) {
    return {
      riskLevel: "low",
      status: "new-import",
      summary: "New import — no existing skill at target path.",
      details: [
        `Incoming checksum ${incomingChecksum.slice(0, 12)}`,
        `Incoming source ${incomingSource.ref}`,
        `Incoming lines ${incomingLines}`,
      ],
    };
  }

  const existingSourceRef = existingInspection.metadata?.source?.ref || existingInspection.attribution || "unknown";
  const existingChecksum = existingInspection.metadata?.checksum || existingInspection.currentChecksum;
  const sameSource = existingInspection.metadata?.source?.ref
    ? existingInspection.metadata.source.ref === incomingSource.ref
    : false;
  const sameChecksum = existingChecksum === incomingChecksum;
  const localEdits = existingInspection.trustState === "modified-locally";

  const details = [
    `Existing source ${existingSourceRef}`,
    `Incoming source ${incomingSource.ref}`,
    `Existing checksum ${existingChecksum.slice(0, 12)}`,
    `Incoming checksum ${incomingChecksum.slice(0, 12)}`,
    `Target skill ${incomingName}`,
  ];

  if (existingInspection.metadata?.importedAt) {
    details.push(`Imported at ${existingInspection.metadata.importedAt}`);
  }

  if (existingInspection.trustState === "legacy-metadata-missing") {
    return {
      riskLevel: "high",
      status: "legacy-import",
      summary: "Existing imported skill uses legacy attribution without provenance metadata.",
      details,
    };
  }

  if (!existingInspection.metadata) {
    return {
      riskLevel: "high",
      status: "unknown-existing",
      summary: "Existing skill has unknown provenance; overwrite would replace a custom or unmanaged install.",
      details,
    };
  }

  if (localEdits) {
    return {
      riskLevel: "high",
      status: "local-edits",
      summary: "Existing imported skill was modified locally; overwrite would discard local changes.",
      details,
    };
  }

  if (!sameSource) {
    return {
      riskLevel: "medium",
      status: "source-changed",
      summary: "Incoming import points at a different source reference than the installed imported skill.",
      details,
    };
  }

  if (!sameChecksum) {
    return {
      riskLevel: "medium",
      status: "content-changed",
      summary: "Incoming import comes from the same source but the skill content has changed.",
      details,
    };
  }

  return {
    riskLevel: "low",
    status: "already-current",
    summary: "Incoming import matches the installed imported skill.",
    details,
  };
}

export function getImportRefreshCommand(metadata, skillName) {
  const source = metadata?.source;
  if (!source) return null;

  const quoteShellArg = (value) => {
    const normalized = String(value || "");
    return `'${normalized.replace(/'/g, "'\\''")}'`;
  };

  if (source.type === "github-repo" || source.type === "github-skill") {
    const repoRef = `${source.owner}/${source.repo}`;
    const path = source.path;
    if (path && path !== ".") {
      return `arcana import ${quoteShellArg(repoRef)} ${quoteShellArg(path)} --review --force`;
    }
    return `arcana import ${quoteShellArg(repoRef)} --review --force`;
  }

  if (source.type === "url") {
    return `arcana import ${quoteShellArg(source.url)} --review --force`;
  }

  if (source.type === "local" && source.localPath) {
    return `arcana import ${quoteShellArg(source.localPath)} --review --force`;
  }

  return null;
}

export function resolveLocalImportPath(inputPath) {
  return resolve(inputPath);
}
