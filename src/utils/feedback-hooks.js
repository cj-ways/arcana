import fsExtra from "fs-extra";
const {
  ensureDirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  removeSync,
} = fsExtra;
import { createHash } from "crypto";
import { dirname, join } from "path";
import {
  analyzeTranscriptFile,
  buildFeedbackEntry,
  getFeedbackProfile,
  saveFeedbackEntry,
} from "./feedback.js";
import { getAvailableSkills } from "./paths.js";

const AUTO_FEEDBACK_SCHEMA_VERSION = 1;
const DEFAULT_AUTO_FEEDBACK_CONFIG = {
  enabled: true,
  sampleRate: 0,
  cooldownHours: 24,
  requireCorrectionSignal: true,
};

const HOOK_STATE_FILENAME = "hook-state.json";
const AUTO_CONFIG_FILENAME = "auto-config.json";

const FEEDBACK_REPLY_PATTERNS = [
  { rating: "helpful", pattern: /^\s*(helpful|yes|useful|worked(?:\s+well)?|good)\b/i },
  { rating: "partly-helpful", pattern: /^\s*(partly helpful|partly|somewhat helpful|mixed|kind of helpful)\b/i },
  { rating: "not-helpful", pattern: /^\s*(not helpful|unhelpful|did(?:\s+not|n't)\s+help|bad)\b/i },
  { rating: "dismiss", pattern: /^\s*(dismiss|skip|no thanks|ignore)\b/i },
];

const CORRECTION_PATTERNS = [
  /\b(too generic|too vague|not helpful|didn't help|did not help|wrong assumption|wrong assumptions|you assumed|not what i asked|not what i meant|missed the point|missed my goal|too many questions)\b/i,
  /^\s*(no[, ]|that's not|that is not|stop\b|wrong\b)/i,
];

const TRANSCRIPT_CONSENT_PATTERN = /\b(analyze transcript|analyze the transcript|analyze this conversation|analyze the conversation|read the chat|read the conversation|you can analyze|yes analyze)\b/i;

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function normalizeReasonLabel(reason) {
  return reason.replace(/-/g, " ");
}

function parseJsonFile(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function mergeHookList(existing = [], command) {
  const hooks = Array.isArray(existing) ? [...existing] : [];
  const alreadyPresent = hooks.some((entry) =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some((hook) => hook?.type === "command" && hook.command === command)
  );

  if (!alreadyPresent) {
    hooks.push({
      hooks: [
        {
          type: "command",
          command,
        },
      ],
    });
  }

  return hooks;
}

function removeHookCommand(existing = [], command) {
  return (Array.isArray(existing) ? existing : [])
    .map((entry) => {
      const hooks = (entry.hooks || []).filter(
        (hook) => !(hook?.type === "command" && hook.command === command)
      );
      return hooks.length > 0 ? { ...entry, hooks } : null;
    })
    .filter(Boolean);
}

function settingsContainHookCommand(settings, command) {
  return ["UserPromptSubmit", "Stop", "SessionEnd"].every((eventName) =>
    Array.isArray(settings?.hooks?.[eventName]) &&
    settings.hooks[eventName].some((entry) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((hook) => hook?.type === "command" && hook.command === command)
    )
  );
}

function isArcanaFeedbackHookCommand(command) {
  return typeof command === "string" &&
    (command.includes("feedback-hook") || command.includes("arcana-feedback.sh"));
}

function getConfiguredFeedbackHookCommands(settings) {
  return ["UserPromptSubmit", "Stop", "SessionEnd"]
    .flatMap((eventName) => settings?.hooks?.[eventName] || [])
    .flatMap((entry) => entry?.hooks || [])
    .filter((hook) => hook?.type === "command" && isArcanaFeedbackHookCommand(hook.command))
    .map((hook) => hook.command);
}

function settingsContainAnyFeedbackHook(settings) {
  return ["UserPromptSubmit", "Stop", "SessionEnd"].every((eventName) =>
    Array.isArray(settings?.hooks?.[eventName]) &&
    settings.hooks[eventName].some((entry) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some(
        (hook) => hook?.type === "command" && isArcanaFeedbackHookCommand(hook.command)
      )
    )
  );
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_AUTO_FEEDBACK_CONFIG,
    ...config,
    sampleRate: Number.isFinite(Number(config.sampleRate))
      ? Math.max(0, Math.min(1, Number(config.sampleRate)))
      : DEFAULT_AUTO_FEEDBACK_CONFIG.sampleRate,
    cooldownHours: Number.isFinite(Number(config.cooldownHours))
      ? Math.max(0, Number(config.cooldownHours))
      : DEFAULT_AUTO_FEEDBACK_CONFIG.cooldownHours,
  };
}

function getSettingsPath(cwd = process.cwd(), shared = false) {
  return shared
    ? join(cwd, ".claude", "settings.json")
    : join(cwd, ".claude", "settings.local.json");
}

function getLegacyScriptPath(cwd = process.cwd()) {
  return join(cwd, ".claude", "hooks", "arcana-feedback.sh");
}

export function getFeedbackHookCommand({ nodePath, cliPath }) {
  return `${shellEscape(nodePath)} ${shellEscape(cliPath)} feedback-hook`;
}

export function getAutoFeedbackDir(cwd = process.cwd()) {
  return join(cwd, ".arcana", "feedback");
}

export function getAutoFeedbackConfigPath(cwd = process.cwd()) {
  return join(getAutoFeedbackDir(cwd), AUTO_CONFIG_FILENAME);
}

export function getHookStatePath(cwd = process.cwd()) {
  return join(getAutoFeedbackDir(cwd), HOOK_STATE_FILENAME);
}

export function loadAutoFeedbackConfig(cwd = process.cwd()) {
  const path = getAutoFeedbackConfigPath(cwd);
  if (!existsSync(path)) return { ...DEFAULT_AUTO_FEEDBACK_CONFIG };
  return normalizeConfig(parseJsonFile(path, DEFAULT_AUTO_FEEDBACK_CONFIG));
}

export function saveAutoFeedbackConfig(config, cwd = process.cwd()) {
  ensureDirSync(getAutoFeedbackDir(cwd));
  const path = getAutoFeedbackConfigPath(cwd);
  const normalized = normalizeConfig(config);
  writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`);
  return path;
}

export function loadHookState(cwd = process.cwd()) {
  const path = getHookStatePath(cwd);
  const fallback = {
    schemaVersion: AUTO_FEEDBACK_SCHEMA_VERSION,
    sessions: {},
    cooldowns: {},
  };
  if (!existsSync(path)) return fallback;
  const parsed = parseJsonFile(path, fallback);
  return {
    schemaVersion: AUTO_FEEDBACK_SCHEMA_VERSION,
    sessions: parsed.sessions || {},
    cooldowns: parsed.cooldowns || {},
  };
}

export function saveHookState(state, cwd = process.cwd()) {
  ensureDirSync(getAutoFeedbackDir(cwd));
  const path = getHookStatePath(cwd);
  writeFileSync(
    path,
    `${JSON.stringify({
      schemaVersion: AUTO_FEEDBACK_SCHEMA_VERSION,
      sessions: state.sessions || {},
      cooldowns: state.cooldowns || {},
    }, null, 2)}\n`
  );
  return path;
}

function getKnownArcanaSkills() {
  return getAvailableSkills();
}

export function extractArcanaSkill(prompt) {
  const skills = getKnownArcanaSkills();
  for (const skill of skills) {
    const pattern = new RegExp(`(^|\\s)\\/${skill}\\b`, "i");
    if (pattern.test(prompt)) return skill;
  }
  return null;
}

export function hasCorrectionSignal(prompt) {
  return CORRECTION_PATTERNS.some((pattern) => pattern.test(prompt));
}

function deterministicSample(key, sampleRate) {
  if (sampleRate <= 0) return false;
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 8);
  const value = parseInt(digest, 16) / 0xffffffff;
  return value < sampleRate;
}

function stripLeadingFeedbackToken(prompt, pattern) {
  const match = prompt.match(pattern);
  if (!match) return prompt.trim();
  return prompt.slice(match[0].length).replace(/^[\s:,\-.]+/, "").trim();
}

export function parseAutoFeedbackResponse(prompt, skill) {
  const profile = getFeedbackProfile(skill);
  const trimmed = prompt.trim();

  for (const option of FEEDBACK_REPLY_PATTERNS) {
    if (!option.pattern.test(trimmed)) continue;

    const remainder = stripLeadingFeedbackToken(trimmed, option.pattern);
    const lowerRemainder = remainder.toLowerCase();
    const reasons = profile.reasons.filter((reason) => {
      const label = normalizeReasonLabel(reason);
      return lowerRemainder.includes(reason) || lowerRemainder.includes(label);
    });

    const transcriptConsent = TRANSCRIPT_CONSENT_PATTERN.test(trimmed);
    return {
      matched: true,
      rating: option.rating,
      reasons,
      notes: remainder,
      transcriptConsent,
    };
  }

  return { matched: false };
}

function ensureSession(state, sessionId) {
  if (!state.sessions[sessionId]) {
    state.sessions[sessionId] = {
      activeSkill: null,
      correctionSignals: 0,
      userTurnsSinceSkill: 0,
      pendingFeedback: null,
      lastPromptAt: null,
    };
  }
  return state.sessions[sessionId];
}

function updateCooldown(state, skill, timestamp) {
  state.cooldowns[skill] = timestamp;
}

function cooldownActive(state, skill, now, cooldownHours) {
  const lastAskedAt = state.cooldowns[skill];
  if (!lastAskedAt) return false;
  const elapsedMs = now - Date.parse(lastAskedAt);
  return elapsedMs < cooldownHours * 60 * 60 * 1000;
}

function shouldPromptForFeedback(state, session, sessionId, config, now) {
  if (!session.activeSkill) return false;
  if (session.pendingFeedback) return false;
  if (cooldownActive(state, session.activeSkill, now, config.cooldownHours)) return false;

  if (session.correctionSignals > 0) return true;
  if (config.requireCorrectionSignal) return false;

  return deterministicSample(`${sessionId}:${session.activeSkill}`, config.sampleRate);
}

export function buildStopHookResponse(input, cwd = process.cwd()) {
  const config = loadAutoFeedbackConfig(cwd);
  if (!config.enabled || input.stop_hook_active) return null;

  const state = loadHookState(cwd);
  const session = ensureSession(state, input.session_id);
  const now = Date.now();

  if (!shouldPromptForFeedback(state, session, input.session_id, config, now)) {
    saveHookState(state, cwd);
    return null;
  }

  session.pendingFeedback = {
    skill: session.activeSkill,
    askedAt: new Date(now).toISOString(),
    transcriptPath: input.transcript_path || null,
  };
  saveHookState(state, cwd);

  return {
    decision: "block",
    reason: `Before stopping, ask one short Arcana feedback question for /${session.activeSkill}: "How was /${session.activeSkill} for this task? Helpful / Partly helpful / Not helpful / Dismiss. If partly helpful or not helpful, you can add a short reason in the same message. If you want Arcana to analyze this conversation locally, include 'analyze transcript'." After asking, wait for the user's reply.`,
  };
}

export function handleUserPromptSubmit(input, cwd = process.cwd()) {
  const config = loadAutoFeedbackConfig(cwd);
  if (!config.enabled) return null;

  const state = loadHookState(cwd);
  const session = ensureSession(state, input.session_id);
  const prompt = (input.prompt || "").trim();

  if (session.pendingFeedback) {
    const pendingSkill = session.pendingFeedback.skill;
    const parsed = parseAutoFeedbackResponse(prompt, pendingSkill);

    if (parsed.matched) {
      if (parsed.rating !== "dismiss") {
        const transcriptConsent = parsed.transcriptConsent;
        const transcriptPath = transcriptConsent ? input.transcript_path : null;
        const transcriptAnalysis = transcriptConsent && input.transcript_path
          ? analyzeTranscriptFile(input.transcript_path, pendingSkill)
          : null;

        const entry = buildFeedbackEntry({
          skill: pendingSkill,
          rating: parsed.rating,
          reasons: parsed.reasons,
          notes: parsed.notes,
          transcriptAnalysis,
          transcriptPath,
          transcriptConsent,
          source: "hook-auto",
        });
        saveFeedbackEntry(entry, { scope: "project", cwd });
      }

      updateCooldown(state, pendingSkill, new Date().toISOString());
      session.pendingFeedback = null;
      saveHookState(state, cwd);

      return {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: parsed.rating === "dismiss"
            ? `Arcana feedback prompt for /${pendingSkill} was dismissed. Do not ask again in this session.`
            : `Arcana feedback was captured for /${pendingSkill}. Acknowledge it briefly if appropriate, then continue with any remaining task. Do not treat the feedback token itself as the user's main task.`,
        },
      };
    }

    // The user moved on without answering the feedback prompt. Clear it and continue.
    session.pendingFeedback = null;
  }

  const invokedSkill = extractArcanaSkill(prompt);
  if (invokedSkill) {
    session.activeSkill = invokedSkill;
    session.correctionSignals = 0;
    session.userTurnsSinceSkill = 0;
    session.pendingFeedback = null;
  } else if (session.activeSkill) {
    session.userTurnsSinceSkill += 1;
    if (hasCorrectionSignal(prompt)) {
      session.correctionSignals += 1;
    }
  }

  session.lastPromptAt = new Date().toISOString();
  saveHookState(state, cwd);
  return null;
}

export function handleSessionEnd(input, cwd = process.cwd()) {
  const state = loadHookState(cwd);
  if (state.sessions[input.session_id]) {
    delete state.sessions[input.session_id];
    saveHookState(state, cwd);
  }
  return null;
}

export function installProjectFeedbackHooks({
  cwd = process.cwd(),
  nodePath,
  cliPath,
  sampleRate,
  cooldownHours,
  requireCorrectionSignal,
  shared = false,
} = {}) {
  const settingsPath = getSettingsPath(cwd, shared);
  ensureDirSync(dirname(settingsPath));

  const settings = existsSync(settingsPath)
    ? parseJsonFile(settingsPath, {})
    : {};

  const command = getFeedbackHookCommand({ nodePath, cliPath });
  settings.hooks = settings.hooks || {};
  for (const existingCommand of [...new Set(getConfiguredFeedbackHookCommands(settings))]) {
    settings.hooks.UserPromptSubmit = removeHookCommand(settings.hooks.UserPromptSubmit, existingCommand);
    settings.hooks.Stop = removeHookCommand(settings.hooks.Stop, existingCommand);
    settings.hooks.SessionEnd = removeHookCommand(settings.hooks.SessionEnd, existingCommand);
  }
  settings.hooks.UserPromptSubmit = mergeHookList(settings.hooks.UserPromptSubmit, command);
  settings.hooks.Stop = mergeHookList(settings.hooks.Stop, command);
  settings.hooks.SessionEnd = mergeHookList(settings.hooks.SessionEnd, command);

  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  const existingConfig = loadAutoFeedbackConfig(cwd);

  const configPath = saveAutoFeedbackConfig({
    enabled: true,
    sampleRate: sampleRate ?? existingConfig.sampleRate,
    cooldownHours: cooldownHours ?? existingConfig.cooldownHours,
    requireCorrectionSignal: requireCorrectionSignal ?? existingConfig.requireCorrectionSignal,
  }, cwd);

  return {
    settingsPath,
    configPath,
    command,
  };
}

export function uninstallProjectFeedbackHooks({ cwd = process.cwd(), shared = false } = {}) {
  const settingsPath = getSettingsPath(cwd, shared);
  const legacyScriptPath = getLegacyScriptPath(cwd);

  if (existsSync(settingsPath)) {
    const settings = parseJsonFile(settingsPath, {});
    if (settings.hooks) {
      const commands = getConfiguredFeedbackHookCommands(settings);

      commands.push(shellEscape(legacyScriptPath));

      for (const command of [...new Set(commands)]) {
        settings.hooks.UserPromptSubmit = removeHookCommand(settings.hooks.UserPromptSubmit, command);
        settings.hooks.Stop = removeHookCommand(settings.hooks.Stop, command);
        settings.hooks.SessionEnd = removeHookCommand(settings.hooks.SessionEnd, command);
      }

      if (settings.hooks.UserPromptSubmit?.length === 0) delete settings.hooks.UserPromptSubmit;
      if (settings.hooks.Stop?.length === 0) delete settings.hooks.Stop;
      if (settings.hooks.SessionEnd?.length === 0) delete settings.hooks.SessionEnd;
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
      writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    }
  }

  if (existsSync(legacyScriptPath)) removeSync(legacyScriptPath);
  if (existsSync(getAutoFeedbackConfigPath(cwd))) removeSync(getAutoFeedbackConfigPath(cwd));
  if (existsSync(getHookStatePath(cwd))) removeSync(getHookStatePath(cwd));
}

export function getProjectFeedbackHookStatus({
  cwd = process.cwd(),
  shared = false,
  nodePath,
  cliPath,
} = {}) {
  const settingsPath = getSettingsPath(cwd, shared);
  const configPath = getAutoFeedbackConfigPath(cwd);
  const settings = existsSync(settingsPath)
    ? parseJsonFile(settingsPath, {})
    : null;
  const command = nodePath && cliPath
    ? getFeedbackHookCommand({ nodePath, cliPath })
    : null;

  const installed = settings ? settingsContainAnyFeedbackHook(settings) : false;
  const config = existsSync(configPath)
    ? loadAutoFeedbackConfig(cwd)
    : null;

  return {
    installed,
    settingsPath,
    configPath,
    config,
    command,
    matchesCurrentInstall: command && settings ? settingsContainHookCommand(settings, command) : null,
  };
}
