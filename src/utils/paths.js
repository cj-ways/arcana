import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { homedir } from "os";
import { readdirSync, existsSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

export function getPackageSkillsDir() {
  return join(PACKAGE_ROOT, "skills");
}

export function getPackageAgentsDir() {
  return join(PACKAGE_ROOT, "agents");
}

export function getPackageRulesDir() {
  return join(PACKAGE_ROOT, "rules");
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
    case "gemini":
      return {
        skills: join(base, ".gemini", "skills"),
        agents: null,
      };
    case "multi":
      return {
        skills: join(base, ".agents", "skills"), // canonical
        agents: join(base, ".claude", "agents"), // agents still go to claude
        mirrors: [
          join(base, ".claude", "skills"),
          join(base, ".cursor", "skills"),
          join(base, ".gemini", "skills"),
          // Note: .github/copilot/skills/ not mirrored — Copilot reads from
          // .github/ which is version-controlled and shared via its own discovery.
        ],
      };
    default:
      throw new Error(`Unknown agent: ${agent}. Use: claude, codex, gemini, or multi`);
  }
}

export function getAvailableSkills() {
  const skillsDir = join(PACKAGE_ROOT, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((name) => {
    const dir = join(skillsDir, name);
    return (
      statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"))
    );
  });
}

export function getAvailableAgents() {
  const agentsDir = join(PACKAGE_ROOT, "agents");
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir)
    .filter((name) => name.endsWith(".md") && statSync(join(agentsDir, name)).isFile())
    .map((name) => name.replace(/\.md$/, ""));
}
