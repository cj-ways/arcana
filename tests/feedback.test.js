import { describe, it, expect } from "vitest";
import {
  analyzeTranscriptContent,
  buildFeedbackTriage,
  buildFeedbackEntry,
  getFeedbackProfile,
  parseTranscriptMessages,
  summarizeFeedback,
} from "../src/utils/feedback.js";
import { buildFeedbackEvalDraft } from "../src/utils/feedback-eval-drafts.js";

describe("feedback profiles", () => {
  it("uses a three-state prompt model with skill-specific reason tags", () => {
    const profile = getFeedbackProfile("feature-audit");
    expect(profile.prompt).toBe("How was /feature-audit for this task?");
    expect(profile.reasons).toContain("too-many-questions");
    expect(profile.reasons).toContain("missed-important-angle");
  });
});

describe("transcript parsing", () => {
  it("parses simple plain-text transcripts", () => {
    const messages = parseTranscriptMessages(
      "User: /deep-fix failing checkout flow\nAssistant: I can help\nUser: This is too generic",
      "session.txt",
    );

    expect(messages).toEqual([
      { role: "user", text: "/deep-fix failing checkout flow" },
      { role: "assistant", text: "I can help" },
      { role: "user", text: "This is too generic" },
    ]);
  });

  it("parses JSONL transcripts with role/content fields", () => {
    const transcript = [
      JSON.stringify({
        role: "user",
        content: "User asked for /feature-audit search",
      }),
      JSON.stringify({ role: "assistant", content: "Need more context?" }),
    ].join("\n");

    const messages = parseTranscriptMessages(transcript, "session.jsonl");
    expect(messages).toEqual([
      { role: "user", text: "User asked for /feature-audit search" },
      { role: "assistant", text: "Need more context?" },
    ]);
  });
});

describe("transcript analysis", () => {
  it("extracts dissatisfaction signals and follow-up context", () => {
    const transcript = `
User: /feature-audit search
Assistant: What are you trying to improve?
User: This is too generic.
Assistant: Can you clarify?
User: Focus only on enterprise search in the admin panel.
Assistant: Any stack constraints?
User: We use Next.js and Elasticsearch, and I cannot change the ranking service.
`;

    const analysis = analyzeTranscriptContent(
      transcript,
      "feature-audit",
      "session.txt",
    );

    expect(analysis.invocationDetected).toBe(true);
    expect(
      analysis.dissatisfactionSignals.map((item) => item.category),
    ).toContain("too-generic");
    expect(analysis.additionalContext.map((item) => item.category)).toContain(
      "scope",
    );
    expect(analysis.additionalContext.map((item) => item.category)).toContain(
      "environment",
    );
    expect(analysis.recommendations).toContain(
      "Ask for scope and boundaries before expanding the task.",
    );
    expect(analysis.recommendations).toContain(
      "Ask for stack, file, or environment context sooner when it changes the workflow.",
    );
  });
});

describe("feedback summaries", () => {
  it("aggregates ratings, reasons, and transcript recommendations", () => {
    const entries = [
      buildFeedbackEntry({
        skill: "deep-fix",
        rating: "helpful",
        notes: "Strong root-cause flow",
      }),
      buildFeedbackEntry({
        skill: "deep-fix",
        rating: "not-helpful",
        reasons: ["wrong-assumptions"],
        notes: "Assumed the wrong service",
        transcriptConsent: true,
        transcriptAnalysis: {
          recommendations: [
            "Add an early assumption check before committing to a path.",
          ],
        },
      }),
    ];

    const summary = summarizeFeedback(entries, "deep-fix");
    expect(summary.totalEntries).toBe(2);
    expect(summary.ratingCounts["helpful"]).toBe(1);
    expect(summary.ratingCounts["not-helpful"]).toBe(1);
    expect(summary.averageScore).toBe(0.5);
    expect(summary.topReasons[0]).toEqual({
      value: "wrong-assumptions",
      count: 1,
    });
    expect(summary.topRecommendations[0]).toEqual({
      value: "Add an early assumption check before committing to a path.",
      count: 1,
    });
  });
});

describe("feedback triage", () => {
  it("turns repeated negative signals into eval candidates", () => {
    const entries = [
      buildFeedbackEntry({
        skill: "deep-fix",
        rating: "not-helpful",
        reasons: ["wrong-assumptions"],
        notes: "Assumed the wrong service",
        transcriptConsent: true,
        transcriptAnalysis: {
          dissatisfactionSignals: [
            {
              category: "wrong-assumptions",
              snippet: "You assumed the wrong service.",
            },
          ],
          additionalContext: [
            {
              category: "scope",
              snippet: "Focus only on the API gateway path.",
            },
          ],
          recommendations: [
            "Add an early assumption check before committing to a path.",
          ],
        },
      }),
      buildFeedbackEntry({
        skill: "deep-fix",
        rating: "partly-helpful",
        reasons: ["wrong-assumptions"],
        notes: "Still anchored to the worker instead of the API gateway",
      }),
      buildFeedbackEntry({
        skill: "deep-fix",
        rating: "helpful",
        notes: "Good structure otherwise",
      }),
    ];

    const report = buildFeedbackTriage(entries, {
      skillName: "deep-fix",
      minOccurrences: 2,
    });

    expect(report.totals.candidateCount).toBe(1);
    expect(report.skills).toHaveLength(1);
    expect(report.skills[0].candidates[0]).toMatchObject({
      signal: "wrong-assumptions",
      priority: "medium",
      occurrences: 2,
      impactScore: 1.5,
      suggestedEval: {
        kind: "scenario",
        dimension: "process",
      },
    });
    expect(report.skills[0].candidates[0].examples).toContain(
      "Assumed the wrong service",
    );
    expect(report.skills[0].candidates[0].topRecommendations[0]).toEqual({
      value: "Add an early assumption check before committing to a path.",
      count: 1,
    });
  });

  it("builds a local eval draft pack from a repeated complaint", () => {
    const report = buildFeedbackTriage(
      [
        buildFeedbackEntry({
          skill: "deep-fix",
          rating: "not-helpful",
          reasons: ["wrong-assumptions"],
          notes: "Assumed the wrong service",
          transcriptConsent: true,
          transcriptAnalysis: {
            recommendations: [
              "Add an early assumption check before committing to a path.",
            ],
          },
        }),
        buildFeedbackEntry({
          skill: "deep-fix",
          rating: "partly-helpful",
          reasons: ["wrong-assumptions"],
          notes: "Still aimed at the worker instead of the API gateway",
        }),
      ],
      {
        skillName: "deep-fix",
        minOccurrences: 2,
      },
    );

    const draft = buildFeedbackEvalDraft(
      report.skills[0],
      report.skills[0].candidates[0],
    );

    expect(draft.scenarioName).toBe("deep-fix-wrong-assumptions-feedback");
    expect(draft.manifest.scoring.weights).toEqual({
      route: 0.2,
      process: 0.6,
      outcome: 0.2,
    });
    expect(draft.manifest.prompt).toContain("Wrong assumptions");
    expect(draft.readme).toContain("Feedback-Derived Eval Draft");
    expect(draft.readme).toContain("Assumed the wrong service");
    expect(draft.evidence).toContain("Signal: Wrong assumptions");
  });
});
