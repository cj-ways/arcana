import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { getTargetDirs, getAvailableSkills } from "../utils/paths.js";
import { isInsideProject } from "../utils/detect.js";

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
function resolveSource(source, skillName) {
  // Local path
  if (source.startsWith("./") || source.startsWith("/") || source.startsWith("../")) {
    return { type: "local", path: source };
  }

  // Raw .md URL
  if (source.startsWith("http") && source.endsWith(".md")) {
    return { type: "url", url: source };
  }

  // GitHub tree URL (e.g., https://github.com/owner/repo/tree/main/skills/name)
  const treeMatch = source.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (treeMatch) {
    const [, owner, repo, branch, path] = treeMatch;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/SKILL.md`;
    const name = basename(path);
    return { type: "github-skill", url: rawUrl, owner, repo, branch, name };
  }

  // GitHub repo URL (e.g., https://github.com/owner/repo)
  const repoUrlMatch = source.match(/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (repoUrlMatch) {
    const [, owner, repo] = repoUrlMatch;
    return { type: "github-repo", owner, repo: repo.replace(/\.git$/, ""), skillName };
  }

  // Short form: owner/repo [skill-name]
  const shortMatch = source.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    const [, owner, repo] = shortMatch;
    return { type: "github-repo", owner, repo, skillName };
  }

  return null;
}

/**
 * Fetch content from a URL using native fetch().
 */
async function fetchUrl(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "arcana-cli" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * List skills in a GitHub repo by checking common locations.
 */
async function listGitHubSkills(owner, repo) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/skills`;
  try {
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": "arcana-cli" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const entries = await response.json();
    return entries
      .filter((e) => e.type === "dir")
      .map((e) => e.name);
  } catch {
    return null;
  }
}

/**
 * Try to fetch a SKILL.md from a GitHub repo, trying main then master.
 */
async function fetchGitHubSkill(owner, repo, skillName) {
  for (const branch of ["main", "master"]) {
    // Try skills/<name>/SKILL.md (most common)
    const url1 = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${skillName}/SKILL.md`;
    const content = await fetchUrl(url1);
    if (content) return { content, url: url1, branch };

    // Try <name>/SKILL.md (flat structure)
    const url2 = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillName}/SKILL.md`;
    const content2 = await fetchUrl(url2);
    if (content2) return { content: content2, url: url2, branch };

    // Try root SKILL.md (single-skill repo)
    if (!skillName || skillName === repo) {
      const url3 = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;
      const content3 = await fetchUrl(url3);
      if (content3) return { content: content3, url: url3, branch };
    }
  }
  return null;
}

/**
 * Parse frontmatter from SKILL.md content.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\S+):\s*(.+)$/);
    if (kv) {
      let value = kv[2].trim();
      // Strip surrounding quotes
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      fm[kv[1]] = value;
    }
  }
  return fm;
}

/**
 * Validate basic frontmatter requirements.
 */
function validateFrontmatter(fm) {
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
    console.log(chalk.dim("  arcana import anthropics/skills frontend-design"));
    console.log(chalk.dim("  arcana import https://github.com/owner/repo/tree/main/skills/my-skill"));
    console.log(chalk.dim("  arcana import ./my-local-skill"));
    console.log(chalk.dim("  arcana import https://example.com/SKILL.md"));
    return;
  }

  const skillName = opts.name || null;
  const resolved = resolveSource(source, skillName);

  if (!resolved) {
    console.log(chalk.red(`\n  Could not parse source: ${source}`));
    console.log(chalk.dim("  Use: owner/repo, GitHub URL, raw .md URL, or local path"));
    process.exit(1);
  }

  console.log(chalk.bold("\n✦ Arcana Import\n"));

  let content = null;
  let sourceLabel = source;

  // --- Fetch based on source type ---

  if (resolved.type === "local") {
    const localPath = resolved.path;
    // Try as directory with SKILL.md
    const skillMdPath = existsSync(join(localPath, "SKILL.md")) ? join(localPath, "SKILL.md") : localPath;
    if (!existsSync(skillMdPath)) {
      console.log(chalk.red(`  File not found: ${skillMdPath}`));
      process.exit(1);
    }
    content = readFileSync(skillMdPath, "utf-8");
    sourceLabel = skillMdPath;
  }

  else if (resolved.type === "url") {
    console.log(chalk.dim(`  Fetching ${resolved.url}...`));
    content = await fetchUrl(resolved.url);
    if (!content) {
      console.log(chalk.red(`  Failed to fetch: ${resolved.url}`));
      process.exit(1);
    }
    sourceLabel = resolved.url;
  }

  else if (resolved.type === "github-skill") {
    console.log(chalk.dim(`  Fetching ${resolved.owner}/${resolved.repo} → ${resolved.name}...`));
    content = await fetchUrl(resolved.url);
    if (!content) {
      console.log(chalk.red(`  Failed to fetch: ${resolved.url}`));
      process.exit(1);
    }
    sourceLabel = `${resolved.owner}/${resolved.repo}/${resolved.name}`;
  }

  else if (resolved.type === "github-repo") {
    const { owner, repo } = resolved;

    if (resolved.skillName) {
      // Fetch specific skill
      console.log(chalk.dim(`  Fetching ${owner}/${repo} → ${resolved.skillName}...`));
      const result = await fetchGitHubSkill(owner, repo, resolved.skillName);
      if (!result) {
        console.log(chalk.red(`  Skill '${resolved.skillName}' not found in ${owner}/${repo}`));
        console.log(chalk.dim("  Tried: skills/<name>/SKILL.md, <name>/SKILL.md, SKILL.md"));
        // Try listing available skills
        const available = await listGitHubSkills(owner, repo);
        if (available && available.length > 0) {
          console.log(chalk.dim(`\n  Available skills in ${owner}/${repo}:`));
          for (const s of available) console.log(chalk.dim(`    - ${s}`));
        }
        process.exit(1);
      }
      content = result.content;
      sourceLabel = `${owner}/${repo}/${resolved.skillName}`;
    } else {
      // List available skills
      console.log(chalk.dim(`  Listing skills in ${owner}/${repo}...`));
      const available = await listGitHubSkills(owner, repo);
      if (!available || available.length === 0) {
        console.log(chalk.yellow(`  No skills/ directory found in ${owner}/${repo}`));
        // Try fetching root SKILL.md (single-skill repo)
        const result = await fetchGitHubSkill(owner, repo, repo);
        if (result) {
          content = result.content;
          sourceLabel = `${owner}/${repo}`;
        } else {
          console.log(chalk.red("  No SKILL.md found. Specify a skill name: arcana import owner/repo skill-name"));
          process.exit(1);
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
    console.log(chalk.red("  No content fetched."));
    process.exit(1);
  }

  // --- Validate ---

  const fm = parseFrontmatter(content);
  const lines = content.split("\n").length;
  const issues = validateFrontmatter(fm);

  const name = fm.name || skillName || basename(source).replace(/\.md$/, "");
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

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

  if (existsSync(targetDir) && !opts.force) {
    console.log(chalk.yellow(`\n  ⚠ ${normalizedName} already exists at ${targetDir}`));
    console.log(chalk.dim("    Use --force to overwrite"));
    process.exit(1);
  }

  // --- Write the raw skill ---

  mkdirSync(targetDir, { recursive: true });
  const targetPath = join(targetDir, "SKILL.md");

  // Add attribution comment
  const attribution = `<!-- Imported by Arcana from: ${sourceLabel} -->\n`;
  const finalContent = attribution + content;

  writeFileSync(targetPath, finalContent);

  console.log(chalk.green(`\n  ✓ Imported to ${targetDir}`));

  if (quality.length > 0 || issues.length > 0) {
    console.log(chalk.dim(`\n  Run /import-skill ${normalizedName} to adapt to Arcana quality standards.`));
  } else {
    console.log(chalk.green("  Skill passes basic quality checks."));
  }

  console.log();
}
