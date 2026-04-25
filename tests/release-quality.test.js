import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dirname, join } from "path";
import fsExtra from "fs-extra";
import {
  buildReleaseQualitySummary,
  renderReleaseQualityMarkdown,
} from "../src/utils/release-quality.js";

const TMP = join(import.meta.dirname, ".tmp-test-release-quality");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

function writeJson(filePath, value) {
  fsExtra.ensureDirSync(dirname(filePath));
  fsExtra.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("release quality summary", () => {
  it("summarizes complete release evidence and keeps non-blocking drafts visible", () => {
    const now = new Date("2026-04-16T12:00:00.000Z");
    const scorecardsDir = join(TMP, "evals", "scorecards");
    const triggerResultsDir = join(TMP, "evals", "trigger-results", "deep-fix_1");
    const feedbackTriageDir = join(TMP, ".arcana", "feedback", "triage");

    writeJson(join(scorecardsDir, "index.json"), {
      schemaVersion: 1,
      generatedAt: "2026-04-15T12:00:00.000Z",
      skills: [
        {
          skill: "deep-fix",
          generatedAt: "2026-04-15T12:00:00.000Z",
          scorecardPath: "evals/scorecards/deep-fix.json",
          scenarioCount: 1,
          averageSkillScore: 0.9,
          averageBaselineScore: 0.4,
          averageScoreDelta: 0.5,
          status: "improved",
        },
      ],
    });

    writeJson(join(triggerResultsDir, "report.json"), {
      skill: "deep-fix",
      evaluatedAt: "2026-04-15T12:00:00.000Z",
      summary: {
        overall: { passRate: 1 },
        bySet: { validation: { passRate: 1 } },
        byCollection: {
          shouldTrigger: { passRate: 1 },
          shouldNotTrigger: { passRate: 1 },
        },
      },
    });

    writeJson(join(feedbackTriageDir, "index.json"), {
      kind: "arcana-feedback-triage",
      generatedAt: "2026-04-15T12:00:00.000Z",
      totals: {
        candidateCount: 0,
        highPriorityCount: 0,
      },
      skills: [],
    });

    writeJson(
      join(
        feedbackTriageDir,
        "drafts",
        "deep-fix",
        "wrong-assumptions",
        "manifest.json",
      ),
      { name: "deep-fix-wrong-assumptions-feedback" },
    );

    const summary = buildReleaseQualitySummary({
      cwd: TMP,
      skillNames: ["deep-fix"],
      staleDays: 14,
      now,
      scorecardsDir,
      triggerResultsDir: join(TMP, "evals", "trigger-results"),
      feedbackTriageDir,
    });

    expect(summary.releaseReady).toBe(true);
    expect(summary.blockingItems).toEqual([]);
    expect(summary.feedback.draftCount).toBe(1);
    expect(summary.attentionItems).toContain(
      "Local feedback-derived eval drafts awaiting review: 1",
    );

    const markdown = renderReleaseQualityMarkdown(summary);
    expect(markdown).toContain("Release ready: yes");
    expect(markdown).toContain("Local draft packs: 1");
  });

  it("blocks releases on missing or stale evidence and open high-priority feedback", () => {
    const now = new Date("2026-04-16T12:00:00.000Z");
    const scorecardsDir = join(TMP, "evals", "scorecards");
    const triggerResultsDir = join(TMP, "evals", "trigger-results", "deep-fix_1");
    const feedbackTriageDir = join(TMP, ".arcana", "feedback", "triage");

    writeJson(join(scorecardsDir, "index.json"), {
      schemaVersion: 1,
      generatedAt: "2026-03-01T12:00:00.000Z",
      skills: [
        {
          skill: "deep-fix",
          generatedAt: "2026-03-01T12:00:00.000Z",
          scorecardPath: "evals/scorecards/deep-fix.json",
          scenarioCount: 1,
          averageSkillScore: 0.9,
          averageBaselineScore: 0.4,
          averageScoreDelta: 0.5,
          status: "regressed",
        },
      ],
    });

    writeJson(join(triggerResultsDir, "report.json"), {
      skill: "deep-fix",
      evaluatedAt: "2026-03-01T12:00:00.000Z",
      summary: {
        overall: { passRate: 0.8 },
        bySet: { validation: { passRate: 0.66 } },
        byCollection: {
          shouldTrigger: { passRate: 0.66 },
          shouldNotTrigger: { passRate: 1 },
        },
      },
    });

    writeJson(join(feedbackTriageDir, "index.json"), {
      kind: "arcana-feedback-triage",
      generatedAt: "2026-04-15T12:00:00.000Z",
      totals: {
        candidateCount: 2,
        highPriorityCount: 1,
      },
      skills: [],
    });

    const summary = buildReleaseQualitySummary({
      cwd: TMP,
      skillNames: ["deep-fix", "pressure-test"],
      staleDays: 14,
      now,
      scorecardsDir,
      triggerResultsDir: join(TMP, "evals", "trigger-results"),
      feedbackTriageDir,
    });

    expect(summary.releaseReady).toBe(false);
    expect(summary.blockingItems).toEqual(
      expect.arrayContaining([
        "Missing scorecards for 1 skill(s): pressure-test",
        "Stored scorecards marked regressed: deep-fix",
        "Missing trigger reports for 1 skill(s): pressure-test",
        "Open high-priority feedback candidates: 1",
      ]),
    );
    expect(summary.attentionItems).toContain(
      "Trigger validation below 100%: deep-fix (66%)",
    );
  });
});
