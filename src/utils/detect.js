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
    cursor: existsSync(join(cwd, ".cursor")),
    gemini: existsSync(join(cwd, ".gemini")),
    copilot: existsSync(join(cwd, ".github", "copilot")),
  };
}

export function suggestAgent() {
  const agents = detectExistingAgents();
  const count = [agents.claude, agents.codex, agents.cursor, agents.gemini].filter(Boolean).length;

  if (count >= 2) return "multi";
  if (agents.codex) return "codex";
  return "claude";
}

