import { existsSync } from "fs";
import { join } from "path";

export function isInsideProject() {
  return existsSync(join(process.cwd(), ".git"));
}

export function detectExistingAgents() {
  const cwd = process.cwd();
  return {
    claude: existsSync(join(cwd, "CLAUDE.md")) || existsSync(join(cwd, ".claude")),
    codex: existsSync(join(cwd, "AGENTS.md")) || existsSync(join(cwd, ".codex")),
  };
}

export function suggestAgent() {
  const agents = detectExistingAgents();
  if (agents.claude && agents.codex) return "multi";
  if (agents.codex) return "codex";
  return "claude";
}

