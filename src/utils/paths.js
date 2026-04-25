import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { homedir } from "os";
import { readdirSync, existsSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

// Cached results — these never change during a single CLI invocation
let _cachedSkills = null;
let _cachedAgents = null;

export function getPackageRoot() {
  return PACKAGE_ROOT;
}

export function getPackageSkillsDir() {
  return join(PACKAGE_ROOT, "skills");
}

export function getPackageAgentsDir() {
  return join(PACKAGE_ROOT, "agents");
}

export function getPackageRulesDir() {
  return join(PACKAGE_ROOT, "rules");
}

export function getPackageMigrationsPath() {
  return join(PACKAGE_ROOT, "migrations.json");
}

export function getTargetDirs(agent, scope) {
  const base = scope === "user" ? homedir() : process.cwd();

  switch (agent) {
    case "claude":
      return {
        skills: join(base, ".claude", "skills"),
        agents: join(base, ".claude", "agents"),
      };
    case "codex":
      return {
        skills: join(base, ".agents", "skills"),
        agents: null, // Codex doesn't have a separate agents dir
      };
    case "multi":
      return {
        skills: join(base, ".agents", "skills"), // canonical
        agents: join(base, ".claude", "agents"), // agents still go to claude
        mirrors: [
          join(base, ".claude", "skills"),
        ],
      };
    default:
      throw new Error(`Unknown agent: ${agent}. Use: claude, codex, or multi`);
  }
}

function filterLocations(locations, scope) {
  if (scope === "all") return locations;
  return locations.filter((loc) => loc.level === scope);
}

/**
 * Get install locations for skills and agents.
 * Used by list, remove, doctor, update to avoid duplicating path arrays.
 */
export function getAllInstallLocations({ scope = "all", cwd = process.cwd(), home = homedir() } = {}) {
  const allLocations = {
    skills: [
      { label: ".claude/skills (project)", dir: join(cwd, ".claude", "skills"), level: "project" },
      { label: ".agents/skills (project)", dir: join(cwd, ".agents", "skills"), level: "project" },
      { label: "~/.claude/skills (user)", dir: join(home, ".claude", "skills"), level: "user" },
      { label: "~/.agents/skills (user)", dir: join(home, ".agents", "skills"), level: "user" },
    ],
    agents: [
      { label: ".claude/agents (project)", dir: join(cwd, ".claude", "agents"), level: "project" },
      { label: "~/.claude/agents (user)", dir: join(home, ".claude", "agents"), level: "user" },
    ],
  };

  return {
    skills: filterLocations(allLocations.skills, scope),
    agents: filterLocations(allLocations.agents, scope),
  };
}

export function getAvailableSkills() {
  if (_cachedSkills) return _cachedSkills;
  const skillsDir = getPackageSkillsDir();
  if (!existsSync(skillsDir)) return [];
  _cachedSkills = readdirSync(skillsDir).filter((name) => {
    const dir = join(skillsDir, name);
    return (
      statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"))
    );
  });
  return _cachedSkills;
}

export function getAvailableAgents() {
  if (_cachedAgents) return _cachedAgents;
  const agentsDir = getPackageAgentsDir();
  if (!existsSync(agentsDir)) return [];
  _cachedAgents = readdirSync(agentsDir)
    .filter((name) => name.endsWith(".md") && statSync(join(agentsDir, name)).isFile())
    .map((name) => name.replace(/\.md$/, ""));
  return _cachedAgents;
}
