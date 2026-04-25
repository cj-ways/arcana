import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import {
  buildStopHookResponse,
  getProjectFeedbackHookStatus,
  handleUserPromptSubmit,
  installProjectFeedbackHooks,
  loadHookState,
  parseAutoFeedbackResponse,
  saveHookState,
  uninstallProjectFeedbackHooks,
} from "../src/utils/feedback-hooks.js";
import { loadFeedbackEntries } from "../src/utils/feedback.js";

const TMP = join(import.meta.dirname, ".tmp-test-feedback-hooks");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

describe("auto feedback parsing", () => {
  it("extracts a three-state rating, reason tags, and transcript consent", () => {
    const parsed = parseAutoFeedbackResponse(
      "Partly helpful: too generic, missed important angle, analyze transcript",
      "feature-audit",
    );

    expect(parsed).toMatchObject({
      matched: true,
      rating: "partly-helpful",
      transcriptConsent: true,
    });
    expect(parsed.reasons).toContain("too-generic");
    expect(parsed.reasons).toContain("missed-important-angle");
  });
});

describe("auto feedback hook lifecycle", () => {
  it("blocks stop once a user corrected an explicit Arcana skill", () => {
    handleUserPromptSubmit(
      {
        session_id: "session-1",
        prompt: "/feature-audit checkout search experience",
      },
      TMP,
    );

    handleUserPromptSubmit(
      {
        session_id: "session-1",
        prompt: "This is too generic. Focus only on enterprise admins.",
      },
      TMP,
    );

    const output = buildStopHookResponse(
      {
        session_id: "session-1",
        transcript_path: join(TMP, "session.txt"),
        stop_hook_active: false,
      },
      TMP,
    );

    expect(output?.decision).toBe("block");
    expect(output?.reason).toContain("How was /feature-audit for this task?");
    expect(loadHookState(TMP).sessions["session-1"].pendingFeedback).toMatchObject({
      skill: "feature-audit",
    });
  });

  it("captures the feedback reply and stores a hook-auto entry", () => {
    const transcriptPath = join(TMP, "session.txt");
    fsExtra.writeFileSync(
      transcriptPath,
      [
        "User: /deep-fix checkout failures",
        "Assistant: I think the worker is timing out.",
        "User: You assumed the wrong service.",
        "Assistant: Can you clarify?",
        "User: Focus only on the API gateway path.",
      ].join("\n"),
    );

    saveHookState(
      {
        schemaVersion: 1,
        cooldowns: {},
        sessions: {
          "session-2": {
            activeSkill: "deep-fix",
            correctionSignals: 1,
            userTurnsSinceSkill: 1,
            pendingFeedback: {
              skill: "deep-fix",
              askedAt: new Date().toISOString(),
              transcriptPath,
            },
            lastPromptAt: new Date().toISOString(),
          },
        },
      },
      TMP,
    );

    const output = handleUserPromptSubmit(
      {
        session_id: "session-2",
        transcript_path: transcriptPath,
        prompt: "Not helpful: wrong assumptions, analyze transcript",
      },
      TMP,
    );

    expect(output?.hookSpecificOutput?.additionalContext).toContain(
      "Arcana feedback was captured for /deep-fix",
    );

    const entries = loadFeedbackEntries({ scope: "project", cwd: TMP });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      skill: "deep-fix",
      rating: "not-helpful",
      source: "hook-auto",
    });
    expect(entries[0].reasons).toContain("wrong-assumptions");
    expect(entries[0].analysis?.recommendations).toContain(
      "Add an early assumption check before committing to a path.",
    );
    expect(loadHookState(TMP).sessions["session-2"].pendingFeedback).toBeNull();
  });
});

describe("auto feedback hook installation", () => {
  it("installs into Claude local settings and removes the hook cleanly", () => {
    const installResult = installProjectFeedbackHooks({
      cwd: TMP,
      nodePath: "/usr/bin/node",
      cliPath: "/tmp/arcana.js",
      sampleRate: 0.25,
      cooldownHours: 12,
      requireCorrectionSignal: false,
    });

    const settingsPath = join(TMP, ".claude", "settings.local.json");
    const settings = JSON.parse(fsExtra.readFileSync(settingsPath, "utf-8"));

    expect(installResult.command).toContain("feedback-hook");
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
      installResult.command,
    );

    const reinstall = installProjectFeedbackHooks({
      cwd: TMP,
      nodePath: "/usr/bin/node",
      cliPath: "/tmp/arcana-next.js",
    });
    const reloadedSettings = JSON.parse(fsExtra.readFileSync(settingsPath, "utf-8"));
    expect(reloadedSettings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(reloadedSettings.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
      reinstall.command,
    );

    const status = getProjectFeedbackHookStatus({
      cwd: TMP,
      nodePath: "/usr/bin/node",
      cliPath: "/tmp/arcana-next.js",
    });
    expect(status.installed).toBe(true);
    expect(status.matchesCurrentInstall).toBe(true);
    expect(status.config).toMatchObject({
      sampleRate: 0.25,
      cooldownHours: 12,
      requireCorrectionSignal: false,
    });

    uninstallProjectFeedbackHooks({ cwd: TMP });

    const after = getProjectFeedbackHookStatus({
      cwd: TMP,
      nodePath: "/usr/bin/node",
      cliPath: "/tmp/arcana.js",
    });
    expect(after.installed).toBe(false);
    expect(fsExtra.existsSync(join(TMP, ".arcana", "feedback", "auto-config.json"))).toBe(false);
  });
});
