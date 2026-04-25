import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join, basename, resolve, sep } from "path";
import { getTargetDirs, getAvailableSkills } from "../utils/paths.js";
import { isInsideProject } from "../utils/detect.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import {
  buildImportMetadata,
  buildImportSource,
  getImportedContentChecksum,
  inspectImportedSkill,
  prependImportAttribution,
  resolveLocalImportPath,
  summarizeImportOverwriteRisk,
  writeImportMetadata,
  writeImportRawSnapshot,
} from "../utils/import-metadata.js";
import { createVerboseLogger } from "../utils/verbosity.js";
import { exitWithMessage, printNextSteps } from "../utils/cli-errors.js";

const GITHUB_SLUG = /^[a-zA-Z0-9._-]{1,100}$/;

/**
 * Resolve a source argument to a fetchable URL or local path.
 *
 * Supported formats:
 *   owner/repo                    → GitHub repo, list skills
 *   owner/repo skill-name         → GitHub repo, specific skill
 *   https://github.com/owner/repo → GitHub repo URL
 *   https://github.com/owner/repo/tree/main/skills/name → specific skill in repo
 *   https://.../*.md              → raw URL to a SKILL.md
 *   ./local-path                  → local directory or file
 */
export function resolveSource(source, skillName) {
  // Local path
  if (source.startsWith("./") || source.startsWith("/") || source.startsWith("../")) {
    return { type: "local", path: source };
  }

  // Raw .md URL — enforce HTTPS only
  if (source.startsWith("https://") && source.endsWith(".md")) {
    return { type: "url", url: source };
  }

  // GitHub tree URL (e.g., https://github.com/owner/repo/tree/main/skills/name)
  // Strip query strings and fragments before matching
  const cleanSource = source.replace(/[?#].*$/, "");
  const treeMatch = cleanSource.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (treeMatch) {
    const [, owner, repo, branch, path] = treeMatch;
    if (!GITHUB_SLUG.test(owner) || !GITHUB_SLUG.test(repo)) return null;
    if (!/^[\w./-]+$/.test(branch)) return null;
    if (path.includes("..")) return null;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/SKILL.md`;
    const name = basename(path);
    return { type: "github-skill", url: rawUrl, owner, repo, branch, name, path };
  }

  // GitHub repo URL (e.g., https://github.com/owner/repo)
  const repoUrlMatch = cleanSource.match(/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (repoUrlMatch) {
    const [, owner, repo] = repoUrlMatch;
    if (!GITHUB_SLUG.test(owner) || !GITHUB_SLUG.test(repo.replace(/\.git$/, ""))) return null;
    return { type: "github-repo", owner, repo: repo.replace(/\.git$/, ""), skillName };
  }

  // Short form: owner/repo [skill-name]
  const shortMatch = source.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    const [, owner, repo] = shortMatch;
    if (!GITHUB_SLUG.test(owner) || !GITHUB_SLUG.test(repo)) return null;
    return { type: "github-repo", owner, repo, skillName };
  }

  return null;
}

/**
 * Fetch content from a URL using native fetch().
 */
export const MAX_FETCH_SIZE = 512 * 1024; // 512KB

export async function fetchUrl(url, logger) {
  logger?.field("GET", url);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "arcana-cli" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    logger?.field("HTTP status", `${response.status} ${response.statusText}`);
    if (!response.ok) return null;

    // Size limit: reject responses over 512KB
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      logger?.field("content-length", contentLength);
    }
    if (contentLength && parseInt(contentLength) > MAX_FETCH_SIZE) {
      logger?.field("rejected response", `content-length exceeds ${MAX_FETCH_SIZE}`);
      return null;
    }

    const text = await response.text();
    logger?.field("downloaded chars", text.length);
    if (text.length > MAX_FETCH_SIZE) {
      logger?.field("rejected response", `body exceeds ${MAX_FETCH_SIZE} chars`);
      return null;
    }
    return text;
  } catch (err) {
    const code = err.cause?.code || err.name;
    logger?.field("fetch error", code ? `${code}${err?.message ? ` — ${err.message}` : ""}` : (err?.message || "unknown error"));
    if (code) console.error(chalk.dim(`  (${code})`));
    return null;
  }
}

export async function fetchGitHubTree(owner, repo, branch, logger) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  try {
    logger?.field("github tree branch", `${owner}/${repo}@${branch}`);
    const text = await fetchUrl(apiUrl, logger);
    if (!text) return null;
    const data = JSON.parse(text);
    if (data.truncated) {
      logger?.line("GitHub tree response was truncated");
      return null;
    }
    logger?.field("github tree entries", Array.isArray(data.tree) ? data.tree.length : 0);
    return data;
  } catch {
    logger?.line("Failed to parse GitHub tree response");
    return null;
  }
}

export function extractSkillPaths(entries) {
  return [...new Set(
    entries
      .filter((entry) => entry?.type === "blob" && typeof entry.path === "string")
      .map((entry) => {
        if (entry.path === "SKILL.md") return ".";
        if (entry.path.startsWith("skills/") && entry.path.endsWith("/SKILL.md")) {
          return entry.path.slice("skills/".length, -"/SKILL.md".length);
        }
        return null;
      })
      .filter(Boolean)
  )].sort();
}

export function resolveSkillPath(requestedName, skillPaths) {
  const cleaned = requestedName
    .replace(/^skills\//, "")
    .replace(/\/SKILL\.md$/, "")
    .replace(/^\/+|\/+$/g, "");

  if (!cleaned) return ".";
  if (skillPaths.includes(cleaned)) return cleaned;

  const basenameMatches = skillPaths.filter((path) => path.split("/").pop() === cleaned);
  if (basenameMatches.length === 1) return basenameMatches[0];

  const curatedMatches = basenameMatches.filter((path) => path.startsWith(".curated/"));
  if (curatedMatches.length === 1) return curatedMatches[0];

  return null;
}

/**
 * List skills in a GitHub repo by scanning the repo tree.
 */
export async function listGitHubSkills(owner, repo, logger) {
  for (const branch of ["main", "master"]) {
    logger?.field("listing branch", branch);
    const tree = await fetchGitHubTree(owner, repo, branch, logger);
    if (!tree?.tree) continue;

    const skillPaths = extractSkillPaths(tree.tree).filter((path) => path !== ".");
    logger?.field("discovered skill paths", skillPaths);
    if (skillPaths.length > 0) return skillPaths;
  }

  return null;
}

/**
 * Try to fetch a SKILL.md from a GitHub repo, trying common layouts first,
 * then falling back to recursive tree discovery.
 */
export async function fetchGitHubSkill(owner, repo, skillName, logger) {
  const requestedName = skillName
    ? skillName.replace(/^skills\//, "").replace(/\/SKILL\.md$/, "").replace(/^\/+|\/+$/g, "")
    : "";
  logger?.field("requested skill path", requestedName || ".");

  for (const branch of ["main", "master"]) {
    const directPaths = requestedName
      ? [`skills/${requestedName}/SKILL.md`, `${requestedName}/SKILL.md`]
      : ["SKILL.md"];

    for (const path of [...new Set(directPaths)]) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      logger?.field("trying direct path", `${branch}:${path}`);
      const content = await fetchUrl(url, logger);
      if (content) {
        return {
          content,
          url,
          branch,
          path: path === "SKILL.md" ? "." : path.replace(/^skills\//, "").replace(/\/SKILL\.md$/, ""),
        };
      }
    }

    if (!requestedName) continue;

    const tree = await fetchGitHubTree(owner, repo, branch, logger);
    if (!tree?.tree) continue;

    const resolvedPath = resolveSkillPath(requestedName, extractSkillPaths(tree.tree));
    logger?.field("resolved recursive path", resolvedPath);
    if (!resolvedPath) continue;

    const rawPath = resolvedPath === "." ? "SKILL.md" : `skills/${resolvedPath}/SKILL.md`;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rawPath}`;
    logger?.field("trying recursive path", `${branch}:${rawPath}`);
    const content = await fetchUrl(url, logger);
    if (content) {
      return { content, url, branch, path: resolvedPath };
    }
  }

  // Try root SKILL.md as a single-skill repo when the requested name matches
  // the repo name and no skills/ tree was found.
  if (!requestedName || requestedName === repo) {
    for (const branch of ["main", "master"]) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;
      logger?.field("trying single-skill fallback", `${branch}:SKILL.md`);
      const content = await fetchUrl(url, logger);
      if (content) {
        return { content, url, branch, path: "." };
      }
    }
  }

  return null;
}

/**
 * Validate basic frontmatter requirements.
 */
export function validateFrontmatter(fm) {
  const issues = [];

  if (!fm.name) issues.push("Missing 'name' field");
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name)) issues.push(`Name '${fm.name}' is not lowercase-kebab-case`);
  else if (fm.name.length > 64) issues.push(`Name '${fm.name}' exceeds 64 characters`);

  if (!fm.description) issues.push("Missing 'description' field");
  else if (fm.description.length > 1024) issues.push(`Description exceeds 1024 characters (${fm.description.length})`);

  return issues;
}

export async function runImport(source, opts) {
  if (!source) {
    console.log(chalk.yellow("\nUsage: arcana import <source> [skill-name]"));
    console.log(chalk.dim("\nExamples:"));
    console.log(chalk.dim("  arcana import openai/skills .curated/gh-address-comments"));
    console.log(chalk.dim("  arcana import https://github.com/owner/repo/tree/main/skills/my-skill"));
    console.log(chalk.dim("  arcana import ./my-local-skill"));
    console.log(chalk.dim("  arcana import https://example.com/SKILL.md"));
    return;
  }

  const skillName = opts.name || null;
  const resolved = resolveSource(source, skillName);
  const logger = createVerboseLogger(opts);

  if (!resolved) {
    exitWithMessage(`\n  Could not parse source: ${source}`, {
      steps: [
        "Use `owner/repo`, a GitHub URL, a raw `.md` URL, or a local path.",
        "Try `arcana import openai/skills .curated/gh-address-comments` for a nested GitHub example.",
      ],
      stream: "log",
    });
  }

  console.log(chalk.bold("\n✦ Arcana Import\n"));
  logger.field("resolved source", resolved);

  let content = null;
  let sourceLabel = source;
  let sourceMetadata = null;

  // --- Fetch based on source type ---

  if (resolved.type === "local") {
    const localPath = resolveLocalImportPath(resolved.path);
    logger.field("resolved local path", localPath);
    // Try as directory with SKILL.md
    const skillMdPath = existsSync(join(localPath, "SKILL.md")) ? join(localPath, "SKILL.md") : localPath;
    logger.field("local skill file", skillMdPath);
    if (!existsSync(skillMdPath) || statSync(skillMdPath).isDirectory()) {
      exitWithMessage(`  No SKILL.md found at: ${localPath}`, {
        steps: [
          "Point Arcana at a directory that contains `SKILL.md`, or pass the `SKILL.md` file directly.",
          "Try `arcana import ./path/to/skill-dir`.",
        ],
        stream: "log",
      });
    }
    content = readFileSync(skillMdPath, "utf-8");
    sourceLabel = skillMdPath;
    sourceMetadata = buildImportSource({
      input: source,
      label: sourceLabel,
      type: "local",
      localPath: skillMdPath,
    });
  }

  else if (resolved.type === "url") {
    console.log(chalk.dim(`  Fetching ${resolved.url}...`));
    content = await fetchUrl(resolved.url, logger);
    if (!content) {
      exitWithMessage(`  Failed to fetch: ${resolved.url}`, {
        steps: [
          "Retry with `--verbose` to inspect the HTTP status or network error.",
          "Confirm the URL points directly to a raw `SKILL.md` file over HTTPS.",
        ],
        stream: "log",
      });
    }
    sourceLabel = resolved.url;
    sourceMetadata = buildImportSource({
      input: source,
      label: sourceLabel,
      type: "url",
      url: resolved.url,
    });
  }

  else if (resolved.type === "github-skill") {
    console.log(chalk.dim(`  Fetching ${resolved.owner}/${resolved.repo} → ${resolved.name}...`));
    content = await fetchUrl(resolved.url, logger);
    if (!content) {
      exitWithMessage(`  Failed to fetch: ${resolved.url}`, {
        steps: [
          "Retry with `--verbose` to inspect the HTTP status or network error.",
          `Try \`arcana import ${resolved.owner}/${resolved.repo}\` first to inspect the available catalog paths.`,
        ],
        stream: "log",
      });
    }
    sourceLabel = `${resolved.owner}/${resolved.repo}/${resolved.path}`;
    sourceMetadata = buildImportSource({
      input: source,
      label: sourceLabel,
      type: "github-skill",
      owner: resolved.owner,
      repo: resolved.repo,
      branch: resolved.branch,
      path: resolved.path,
      url: resolved.url,
    });
  }

  else if (resolved.type === "github-repo") {
    const { owner, repo } = resolved;

    if (resolved.skillName) {
      // Fetch specific skill
      console.log(chalk.dim(`  Fetching ${owner}/${repo} → ${resolved.skillName}...`));
      const result = await fetchGitHubSkill(owner, repo, resolved.skillName, logger);
      if (!result) {
        console.log(chalk.red(`  Skill '${resolved.skillName}' not found in ${owner}/${repo}`));
        console.log(chalk.dim("  Tried direct layouts and recursive catalog search"));
        // Try listing available skills
        const available = await listGitHubSkills(owner, repo, logger);
        if (available && available.length > 0) {
          console.log(chalk.dim(`\n  Available skills in ${owner}/${repo}:`));
          for (const s of available) console.log(chalk.dim(`    - ${s}`));
        }
        printNextSteps(
          [
            `Retry with one of the listed paths: \`arcana import ${owner}/${repo} <skill-path>\`.`,
            "If the repo is a single-skill repo, retry without a skill name to probe the root SKILL.md.",
          ],
          { stream: "log" },
        );
        process.exit(1);
      }
      content = result.content;
      sourceLabel = `${owner}/${repo}/${result.path === "." ? "SKILL.md" : result.path}`;
      sourceMetadata = buildImportSource({
        input: source,
        label: sourceLabel,
        type: "github-repo",
        owner,
        repo,
        branch: result.branch,
        path: result.path,
        url: result.url,
      });
    } else {
      // List available skills
      console.log(chalk.dim(`  Listing skills in ${owner}/${repo}...`));
      const available = await listGitHubSkills(owner, repo, logger);
      if (!available || available.length === 0) {
        console.log(chalk.yellow(`  No skills/ directory found in ${owner}/${repo}`));
        // Try fetching root SKILL.md (single-skill repo)
        const result = await fetchGitHubSkill(owner, repo, repo, logger);
        if (result) {
          content = result.content;
          sourceLabel = `${owner}/${repo}`;
          sourceMetadata = buildImportSource({
            input: source,
            label: sourceLabel,
            type: "github-repo",
            owner,
            repo,
            branch: result.branch,
            path: result.path,
            url: result.url,
          });
        } else {
          exitWithMessage("  No SKILL.md found. Specify a skill name.", {
            steps: [
              `List the repo catalog with \`arcana import ${owner}/${repo}\` first.`,
              `Then retry with \`arcana import ${owner}/${repo} <skill-path>\`.`,
            ],
            stream: "log",
          });
        }
      } else {
        console.log(chalk.dim(`\n  Found ${available.length} skills in ${owner}/${repo}:\n`));
        for (const s of available) console.log(`    - ${s}`);
        console.log(chalk.dim(`\n  Run: arcana import ${owner}/${repo} <skill-name>\n`));
        return;
      }
    }
  }

  if (!content) {
    exitWithMessage("  No content fetched.", {
      steps: [
        "Retry with `--verbose` to inspect the resolved path and fetch attempts.",
        "If this is a GitHub repo, run `arcana import owner/repo` first to inspect the available skill paths.",
      ],
      stream: "log",
    });
  }

  // --- Validate ---

  const fm = parseFrontmatter(content);
  const lines = content.split("\n").length;
  const issues = validateFrontmatter(fm);

  const name = fm.name || skillName || basename(source).replace(/\.md$/, "");
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (!normalizedName || normalizedName.length < 2) {
    exitWithMessage("  Invalid skill name after normalization.", {
      steps: [
        "Provide an explicit lowercase-kebab-case name: `arcana import <source> <name>`.",
      ],
      stream: "log",
    });
  }

  console.log(chalk.dim(`  Source: ${sourceLabel}`));
  console.log(chalk.dim(`  Name: ${normalizedName}`));
  console.log(chalk.dim(`  Lines: ${lines}`));
  console.log(chalk.dim(`  Description: ${fm.description ? fm.description.slice(0, 80) + "..." : "(none)"}`));

  // Check for conflicts with existing Arcana skills
  const existingSkills = getAvailableSkills();
  if (existingSkills.includes(normalizedName)) {
    console.log(chalk.yellow(`\n  ⚠ '${normalizedName}' conflicts with a built-in Arcana skill.`));
    console.log(chalk.dim(`    The imported skill will be saved with a different name if you proceed.`));
  }

  // Show validation results
  if (issues.length > 0) {
    console.log(chalk.yellow(`\n  Validation issues (${issues.length}):`));
    for (const issue of issues) console.log(chalk.yellow(`    - ${issue}`));
  }

  // Quality assessment
  const quality = [];
  if (!fm["allowed-tools"]) quality.push("Missing allowed-tools");
  if (lines > 500) quality.push(`Over 500 lines (${lines})`);
  if (!content.includes("## Gotchas") && !content.includes("## Rules")) quality.push("No Gotchas or Rules section");
  if (fm.description && /^I |^You |^We /.test(fm.description)) quality.push("Description uses first/second person");

  if (quality.length > 0) {
    console.log(chalk.yellow(`\n  Quality gaps (fixable with /import-skill):`));
    for (const q of quality) console.log(chalk.yellow(`    - ${q}`));
  }

  // --- Determine target directory ---

  const agent = opts.agent || "claude";
  const scope = opts.scope || (isInsideProject() ? "project" : "user");
  const dirs = getTargetDirs(agent, scope);
  const targetDir = join(dirs.skills, normalizedName);
  logger.field("target agent", agent);
  logger.field("target scope", scope);
  logger.field("target skills dir", dirs.skills);
  logger.field("target skill dir", targetDir);
  logger.field("review mode", Boolean(opts.review));
  logger.field("force mode", Boolean(opts.force));
  const incomingChecksum = getImportedContentChecksum(content);
  const importRecord = buildImportMetadata({
    name: normalizedName,
    source: sourceMetadata || buildImportSource({
      input: source,
      label: sourceLabel,
      type: resolved.type,
    }),
    checksum: incomingChecksum,
  });

  // Verify target is a direct child of skills dir
  if (!targetDir.startsWith(dirs.skills + sep)) {
    exitWithMessage("  Resolved target directory escapes skills root. Aborting.", {
      steps: [
        "Use a simple skill name, or let Arcana derive the name from the skill frontmatter.",
      ],
      stream: "log",
    });
  }

  const existingInspection = existsSync(targetDir)
    ? inspectImportedSkill(targetDir)
    : null;
  const overwriteRisk = summarizeImportOverwriteRisk({
    targetExists: existsSync(targetDir),
    existingInspection,
    incomingName: normalizedName,
    incomingChecksum,
    incomingSource: importRecord.source,
    incomingLines: lines,
  });
  logger.field("import source ref", importRecord.source.ref);
  logger.field("incoming checksum", incomingChecksum);
  logger.field("overwrite risk", overwriteRisk);

  console.log(chalk.bold(`\n  ${existsSync(targetDir) ? "Overwrite Review" : "Import Review"}`));
  console.log(chalk.dim(`    Target: ${targetDir}`));
  console.log(chalk.dim(`    Risk: ${overwriteRisk.riskLevel.toUpperCase()} — ${overwriteRisk.summary}`));
  for (const detail of overwriteRisk.details) {
    console.log(chalk.dim(`      - ${detail}`));
  }

  if (opts.review) {
    console.log(chalk.green("\n  Review complete. No files were written."));
    if (existsSync(targetDir)) {
      console.log(chalk.dim("  Re-run with --force to apply the overwrite."));
    }
    console.log();
    return;
  }

  if (existsSync(targetDir) && !opts.force) {
    console.log(chalk.yellow(`\n  ⚠ ${normalizedName} already exists at ${targetDir}`));
    console.log(chalk.dim("    Use --review to inspect overwrite risk or --force to overwrite."));
    process.exit(1);
  }

  // --- Write the raw skill ---

  mkdirSync(targetDir, { recursive: true });
  const targetPath = join(targetDir, "SKILL.md");

  const finalContent = prependImportAttribution(content, importRecord.source.ref);

  writeFileSync(targetPath, finalContent);
  writeImportMetadata(targetDir, importRecord);
  writeImportRawSnapshot(targetDir, content);

  console.log(chalk.green(`\n  ✓ Imported to ${targetDir}`));
  console.log(chalk.dim(`  Provenance: ${importRecord.source.ref}`));
  console.log(chalk.dim(`  Checksum:   ${importRecord.checksum.slice(0, 12)}`));
  console.log(chalk.dim("  Raw copy:   preserved for future adaptation verification"));

  if (quality.length > 0 || issues.length > 0) {
    console.log(chalk.dim(`\n  Run /import-skill ${normalizedName} to adapt to Arcana quality standards.`));
  } else {
    console.log(chalk.green("  Skill passes basic quality checks."));
  }

  console.log();
}
