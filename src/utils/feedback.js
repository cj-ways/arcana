import fsExtra from "fs-extra";
const { ensureDirSync, existsSync, readFileSync, appendFileSync, writeFileSync } = fsExtra;
import { homedir } from "os";
import { join } from "path";
import { getSkillMetadata } from "./catalog.js";

const FEEDBACK_FILENAME = "entries.jsonl";
const FEEDBACK_SCHEMA_VERSION = 1;

const RATING_OPTIONS = [
  { value: "helpful", label: "Helpful", score: 1 },
  { value: "partly-helpful", label: "Partly helpful", score: 0.5 },
  { value: "not-helpful", label: "Not helpful", score: 0 },
  { value: "dismiss", label: "Dismiss", score: null },
];

const REASON_PROFILES = {
  diagnostic: [
    "missed-real-issue",
    "false-positive",
    "wrong-severity",
    "needed-more-evidence",
    "too-generic",
    "not-actionable",
  ],
  execution: [
    "missed-my-goal",
    "needed-too-much-context",
    "wrong-assumptions",
    "broke-existing-patterns",
    "did-not-finish",
    "not-actionable",
  ],
  advisory: [
    "missed-my-goal",
    "needed-too-much-context",
    "wrong-assumptions",
    "too-generic",
    "too-many-questions",
    "missed-important-angle",
    "not-actionable",
  ],
  general: [
    "missed-my-goal",
    "needed-too-much-context",
    "wrong-assumptions",
    "too-generic",
    "not-actionable",
  ],
};

const TRIAGE_SIGNAL_DEFINITIONS = {
  "missed-real-issue": {
    label: "Missed real issue",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add or extend a scenario with a planted issue the skill must catch, then fail the eval when it misses that issue.",
    assertionHints: [
      "Plant the exact issue type that user feedback says was missed.",
      "Keep at least one clean near-miss in the same fixture to suppress false positives.",
    ],
  },
  "false-positive": {
    label: "False positive",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add or extend a clean or near-miss fixture that the skill must leave unflagged.",
    assertionHints: [
      "Keep the fixture realistic enough that weak heuristics would still be tempted to flag it.",
      "Fail the eval if the report escalates the clean path as a real issue.",
    ],
  },
  "wrong-severity": {
    label: "Wrong severity",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add a severity-labeled scenario and fail the eval when the report grades the issue above or below the intended level.",
    assertionHints: [
      "Use a planted issue whose expected severity is explicit in the fixture notes.",
      "Require the output artifact to include the severity label, not just the issue description.",
    ],
  },
  "needed-more-evidence": {
    label: "Needed more evidence",
    dimension: "process",
    evalKind: "scenario",
    nextAction:
      "Add a process-focused scenario that requires the skill to gather or cite supporting evidence before making the claim.",
    assertionHints: [
      "Fail the eval if the output jumps to a verdict without citing the planted evidence source.",
      "Use artifact or reported-context assertions instead of broad keyword checks.",
    ],
  },
  "too-generic": {
    label: "Too generic",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add an outcome-focused scenario that fails unless the final output is concrete, specific, and anchored to the actual task context.",
    assertionHints: [
      "Require concrete file paths, examples, or prioritized actions in the final artifact.",
      "Keep one generic-sounding but acceptable phrase out of the assertions so the eval does not reward fluff.",
    ],
  },
  "not-actionable": {
    label: "Not actionable",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add an outcome-focused scenario that requires concrete next steps, commands, or implementation guidance instead of generic advice.",
    assertionHints: [
      "Fail the eval if the final output has findings without clear next actions.",
      "Prefer artifact-backed assertions over loose wording checks.",
    ],
  },
  "missed-my-goal": {
    label: "Missed my goal",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add a goal-fidelity scenario that fails unless the final output stays anchored to the user's stated objective.",
    assertionHints: [
      "Make the goal explicit in the prompt and fail if the final output drifts to a different problem.",
      "Use transcript or notes evidence to preserve the exact wording of the missed goal.",
    ],
  },
  "needed-too-much-context": {
    label: "Needed too much context",
    dimension: "process",
    evalKind: "scenario",
    nextAction:
      "Add a process-focused scenario where the initial request already contains enough context and fail if the skill still asks for unnecessary setup details.",
    assertionHints: [
      "Plant the needed context directly in the prompt or fixture so the skill can proceed.",
      "If follow-up context was repeatedly requested, turn that into a negative process check.",
    ],
  },
  "wrong-assumptions": {
    label: "Wrong assumptions",
    dimension: "process",
    evalKind: "scenario",
    nextAction:
      "Add a process-focused scenario that is easy to misread and fail unless the skill checks or states the critical assumption before committing.",
    assertionHints: [
      "Use the corrected user detail from feedback as the planted trap.",
      "Require the final output to acknowledge or test the critical assumption before concluding.",
    ],
  },
  "broke-existing-patterns": {
    label: "Broke existing patterns",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add an outcome-focused scenario that fails when the proposed change violates the project's existing conventions or patterns.",
    assertionHints: [
      "Keep the local convention explicit in fixture files or transcript notes.",
      "Require the output to stay aligned with the established pattern or call out the justified exception.",
    ],
  },
  "did-not-finish": {
    label: "Did not finish",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add an end-to-end scenario that requires the full requested deliverable and fails partial completions.",
    assertionHints: [
      "Use artifact existence or concrete output structure checks to prove completion.",
      "Do not let partial analysis count as success when the task asked for a finished result.",
    ],
  },
  "too-many-questions": {
    label: "Too many questions",
    dimension: "process",
    evalKind: "scenario",
    nextAction:
      "Add a process-focused scenario that already has enough context and fail if the skill keeps asking low-value follow-up questions.",
    assertionHints: [
      "Use the transcript analysis to define which clarifications were unnecessary.",
      "Keep the eval centered on minimum necessary questioning, not zero questions in every case.",
    ],
  },
  "missed-important-angle": {
    label: "Missed important angle",
    dimension: "outcome",
    evalKind: "scenario",
    nextAction:
      "Add an outcome-focused scenario with one clearly material angle the skill must surface, then fail when it misses that angle.",
    assertionHints: [
      "Keep the missing angle decision-relevant, not cosmetic.",
      "Prefer one strong planted omission over many shallow checklist items.",
    ],
  },
};

const CONTEXT_CATEGORIES = [
  {
    category: "goal",
    pattern:
      /\b(i need|i want|the goal|trying to|need it to|want it to|what i actually need)\b/i,
    recommendation: "Clarify the user's concrete outcome earlier.",
  },
  {
    category: "scope",
    pattern:
      /\b(only|just|specifically|focus on|rather than|instead of|not the|not all)\b/i,
    recommendation: "Ask for scope and boundaries before expanding the task.",
  },
  {
    category: "constraints",
    pattern:
      /\b(must|can't|cannot|without|within|required|required to|do not|don't)\b/i,
    recommendation:
      "Surface hard constraints earlier and shape the workflow around them.",
  },
  {
    category: "environment",
    pattern:
      /\b(react|next\.?js|express|node|typescript|javascript|python|pytest|vitest|go|rails|django|postgres|mysql|redis|aws|kubernetes)\b|(?:\/|\\).+\.[a-z0-9]+/i,
    recommendation:
      "Ask for stack, file, or environment context sooner when it changes the workflow.",
  },
  {
    category: "examples",
    pattern: /\b(for example|example|like this|here is|e\.g\.)\b/i,
    recommendation:
      "Invite a concrete example earlier when the request is underspecified.",
  },
];

const DISSATISFACTION_PATTERNS = [
  {
    category: "too-generic",
    pattern: /\b(too generic|generic|too vague|vague|high[- ]level only)\b/i,
    recommendation:
      "Tighten concrete examples and make the output more specific.",
  },
  {
    category: "wrong-assumptions",
    pattern:
      /\b(wrong assumption|wrong assumptions|you assumed|that assumption|not what i meant)\b/i,
    recommendation:
      "Add an early assumption check before committing to a path.",
  },
  {
    category: "too-many-questions",
    pattern:
      /\b(too many questions|stop asking|asked too much|too many follow[- ]ups)\b/i,
    recommendation:
      "Reduce clarifying questions to the minimum needed to proceed safely.",
  },
  {
    category: "not-actionable",
    pattern:
      /\b(not actionable|not useful|not helpful|doesn't help|didn't help)\b/i,
    recommendation: "Increase stepwise guidance and concrete next actions.",
  },
  {
    category: "missed-goal",
    pattern:
      /\b(missed (the )?point|missed my goal|not what i asked|wrong direction)\b/i,
    recommendation:
      "Restate the user's goal and success criteria before diving into execution.",
  },
];

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, "\n");
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => extractText(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (!value || typeof value !== "object") return "";

  if (typeof value.text === "string") return value.text;
  if (typeof value.message === "string") return value.message;
  if (typeof value.content === "string") return value.content;
  if (value.content) return extractText(value.content);

  return Object.values(value)
    .map((item) => extractText(item))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function collectMessages(value, messages = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectMessages(item, messages);
    return messages;
  }

  if (!value || typeof value !== "object") return messages;

  const role =
    typeof value.role === "string"
      ? value.role
      : typeof value.sender === "string"
        ? value.sender
        : typeof value.author === "string"
          ? value.author
          : null;
  const text = extractText(value);

  if (role && text) {
    messages.push({ role: role.toLowerCase(), text: text.trim() });
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectMessages(child, messages);
  }

  return messages;
}

function parsePlainTranscript(content) {
  const lines = normalizeLineEndings(content).split("\n");
  const messages = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const userMatch = trimmed.match(/^(user|human):\s*(.+)$/i);
    if (userMatch) {
      messages.push({ role: "user", text: userMatch[2] });
      continue;
    }

    const assistantMatch = trimmed.match(/^(assistant|claude):\s*(.+)$/i);
    if (assistantMatch) {
      messages.push({ role: "assistant", text: assistantMatch[2] });
    }
  }

  return messages;
}

export function parseTranscriptMessages(content, transcriptPath = "") {
  const normalized = normalizeLineEndings(content).trim();
  if (!normalized) return [];

  if (transcriptPath.endsWith(".jsonl")) {
    const messages = [];
    for (const line of normalized.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        collectMessages(JSON.parse(trimmed), messages);
      } catch {
        // Fall back to plain text parsing below if the file isn't valid JSONL.
        return parsePlainTranscript(normalized);
      }
    }
    return messages;
  }

  if (transcriptPath.endsWith(".json")) {
    try {
      return collectMessages(JSON.parse(normalized), []);
    } catch {
      return parsePlainTranscript(normalized);
    }
  }

  if (normalized.startsWith("{") || normalized.startsWith("[")) {
    try {
      return collectMessages(JSON.parse(normalized), []);
    } catch {
      return parsePlainTranscript(normalized);
    }
  }

  return parsePlainTranscript(normalized);
}

export function analyzeTranscriptContent(
  content,
  skillName,
  transcriptPath = "",
) {
  const messages = parseTranscriptMessages(content, transcriptPath);
  const invocationPattern = new RegExp(`(^|\\s)\\/${skillName}\\b`, "i");
  const invocationIndex = messages.findIndex(
    (message) =>
      message.role === "user" && invocationPattern.test(message.text),
  );
  const startIndex = invocationIndex === -1 ? 0 : invocationIndex;
  const relevantMessages = messages.slice(startIndex);
  const userMessages = relevantMessages.filter(
    (message) => message.role === "user",
  );
  const followUpUserMessages = userMessages.slice(1);
  const assistantMessages = relevantMessages.filter(
    (message) => message.role === "assistant",
  );

  const dissatisfactionSignals = [];
  for (const message of userMessages) {
    for (const pattern of DISSATISFACTION_PATTERNS) {
      if (pattern.pattern.test(message.text)) {
        dissatisfactionSignals.push({
          category: pattern.category,
          snippet: message.text.slice(0, 200),
          recommendation: pattern.recommendation,
        });
      }
    }
  }

  const additionalContext = [];
  for (const message of followUpUserMessages) {
    for (const contextType of CONTEXT_CATEGORIES) {
      if (contextType.pattern.test(message.text)) {
        additionalContext.push({
          category: contextType.category,
          snippet: message.text.slice(0, 200),
          recommendation: contextType.recommendation,
        });
      }
    }
  }

  const recommendations = dedupeStrings([
    ...dissatisfactionSignals.map((item) => item.recommendation),
    ...additionalContext.map((item) => item.recommendation),
  ]);

  if (
    assistantMessages.filter((message) => message.text.includes("?")).length >=
    3
  ) {
    recommendations.push(
      "Reduce clarifying questions or make them more targeted before diving deeper.",
    );
  }

  const summaryParts = [];
  if (dissatisfactionSignals.length > 0) {
    summaryParts.push(
      `Detected ${dissatisfactionSignals.length} dissatisfaction signal${dissatisfactionSignals.length === 1 ? "" : "s"} after /${skillName}.`,
    );
  }
  if (additionalContext.length > 0) {
    const categories = dedupeStrings(
      additionalContext.map((item) => item.category),
    );
    summaryParts.push(
      `The user added follow-up context about ${categories.join(", ")} after the initial request.`,
    );
  }
  if (summaryParts.length === 0) {
    summaryParts.push(
      `No strong transcript signals found for /${skillName}; rely on the explicit rating and notes.`,
    );
  }

  return {
    transcriptPath,
    turnsAnalyzed: relevantMessages.length,
    invocationDetected: invocationIndex !== -1,
    dissatisfactionSignals,
    additionalContext,
    recommendations,
    summary: summaryParts.join(" "),
  };
}

export function analyzeTranscriptFile(transcriptPath, skillName) {
  const content = readFileSync(transcriptPath, "utf-8");
  return analyzeTranscriptContent(content, skillName, transcriptPath);
}

export function getFeedbackStoreDir({
  scope = "project",
  cwd = process.cwd(),
  home = homedir(),
} = {}) {
  const base = scope === "user" ? home : cwd;
  return join(base, ".arcana", "feedback");
}

function parseJsonlFile(filePath) {
  const entries = [];
  const content = normalizeLineEndings(readFileSync(filePath, "utf-8"));
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Preserve existing readable entries and skip corrupt lines.
    }
  }
  return entries;
}

export function loadFeedbackEntries({
  scope = "all",
  cwd = process.cwd(),
  home = homedir(),
} = {}) {
  const locations = [];
  if (scope === "project" || scope === "all") {
    locations.push(getFeedbackStoreDir({ scope: "project", cwd, home }));
  }
  if (scope === "user" || scope === "all") {
    locations.push(getFeedbackStoreDir({ scope: "user", cwd, home }));
  }

  const entries = [];
  for (const dir of locations) {
    const filePath = join(dir, FEEDBACK_FILENAME);
    if (!existsSync(filePath)) continue;
    entries.push(...parseJsonlFile(filePath));
  }

  return entries.sort((a, b) => {
    const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
    return bTime - aTime;
  });
}

export function saveFeedbackEntry(
  entry,
  { scope = "project", cwd = process.cwd(), home = homedir() } = {},
) {
  const dir = getFeedbackStoreDir({ scope, cwd, home });
  ensureDirSync(dir);
  const filePath = join(dir, FEEDBACK_FILENAME);
  appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
  return filePath;
}

export function ratingToScore(rating) {
  const option = RATING_OPTIONS.find((item) => item.value === rating);
  return option ? option.score : null;
}

export function getRatingOptions() {
  return RATING_OPTIONS.map((item) => ({ ...item }));
}

export function getFeedbackProfile(skillName) {
  const normalized = (skillName || "").trim();
  const family = getSkillMetadata(normalized)?.feedbackProfile || "general";
  return {
    skill: normalized,
    family,
    prompt: `How was /${normalized} for this task?`,
    reasons: REASON_PROFILES[family],
    transcriptConsentPrompt: `Allow Arcana to analyze this conversation locally to improve /${normalized}?`,
  };
}

export function parseReasonsInput(input) {
  if (!input) return [];
  if (Array.isArray(input))
    return dedupeStrings(input.map((item) => item.trim()).filter(Boolean));
  return dedupeStrings(
    input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function buildFeedbackEntry({
  skill,
  rating,
  reasons = [],
  notes = "",
  transcriptAnalysis = null,
  transcriptPath = null,
  transcriptConsent = false,
  source = "manual",
}) {
  const profile = getFeedbackProfile(skill);
  return {
    schemaVersion: FEEDBACK_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    skill,
    family: profile.family,
    rating,
    score: ratingToScore(rating),
    reasons: dedupeStrings(reasons),
    notes: notes.trim(),
    source,
    transcript: {
      consented: transcriptConsent,
      path: transcriptPath,
      analyzed: Boolean(transcriptAnalysis),
    },
    analysis: transcriptAnalysis,
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function topEntries(counts, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function normalizePenalty(entry) {
  if (entry?.rating === "not-helpful") return 1;
  if (entry?.rating === "partly-helpful") return 0.5;
  return 0;
}

function truncateSnippet(value, limit = 180) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1).trimEnd()}…`
    : normalized;
}

function pushUnique(list, value, limit = 3) {
  const normalized = truncateSnippet(value);
  if (!normalized || list.includes(normalized)) return;
  if (list.length < limit) list.push(normalized);
}

function classifyTriagePriority(impactScore, occurrences) {
  if (impactScore >= 2 || (impactScore >= 1.5 && occurrences >= 3)) return "high";
  if (impactScore >= 1 || occurrences >= 2) return "medium";
  return "low";
}

function comparePriority(a, b) {
  const rank = { high: 3, medium: 2, low: 1 };
  return (rank[b] || 0) - (rank[a] || 0);
}

export function summarizeFeedback(entries, skillName = null) {
  const filtered = skillName
    ? entries.filter((entry) => entry.skill === skillName)
    : entries;
  const submitted = filtered.filter((entry) => entry.rating !== "dismiss");

  const scored = submitted.filter((entry) => typeof entry.score === "number");
  const averageScore =
    scored.length > 0
      ? scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length
      : null;

  const ratingCounts = countBy(filtered, (entry) => entry.rating);
  const reasonCounts = countBy(
    submitted.flatMap((entry) => entry.reasons || []),
    (reason) => reason,
  );
  const recommendationCounts = countBy(
    submitted.flatMap((entry) => entry.analysis?.recommendations || []),
    (recommendation) => recommendation,
  );
  const skillCounts = countBy(submitted, (entry) => entry.skill);

  return {
    skill: skillName,
    totalEntries: filtered.length,
    submittedEntries: submitted.length,
    averageScore,
    ratingCounts,
    topReasons: topEntries(reasonCounts),
    topRecommendations: topEntries(recommendationCounts),
    skillCounts: topEntries(skillCounts),
  };
}

export function getFeedbackTriageDir({
  scope = "project",
  cwd = process.cwd(),
  home = homedir(),
} = {}) {
  return join(getFeedbackStoreDir({ scope, cwd, home }), "triage");
}

export function buildFeedbackTriage(
  entries,
  { skillName = null, minOccurrences = 2 } = {},
) {
  const filtered = entries.filter(
    (entry) => !skillName || entry.skill === skillName,
  );
  const submitted = filtered.filter((entry) => entry.rating !== "dismiss");
  const triageGroups = new Map();

  for (const entry of submitted) {
    const penalty = normalizePenalty(entry);
    if (penalty <= 0) continue;

    const signals = dedupeStrings(
      (entry.reasons || []).filter((reason) => TRIAGE_SIGNAL_DEFINITIONS[reason]),
    );
    if (signals.length === 0) continue;

    if (!triageGroups.has(entry.skill)) {
      triageGroups.set(entry.skill, {
        totalEntries: 0,
        negativeEntries: 0,
        signals: new Map(),
      });
    }

    const skillGroup = triageGroups.get(entry.skill);
    skillGroup.negativeEntries += 1;

    for (const signal of signals) {
      if (!skillGroup.signals.has(signal)) {
        skillGroup.signals.set(signal, {
          signal,
          occurrences: 0,
          impactScore: 0,
          ratingCounts: {},
          examples: [],
          recommendationCounts: {},
        });
      }

      const aggregate = skillGroup.signals.get(signal);
      aggregate.occurrences += 1;
      aggregate.impactScore += penalty;
      aggregate.ratingCounts[entry.rating] =
        (aggregate.ratingCounts[entry.rating] || 0) + 1;

      pushUnique(aggregate.examples, entry.notes);
      for (const signalEntry of entry.analysis?.dissatisfactionSignals || []) {
        if (signalEntry.category === signal) {
          pushUnique(aggregate.examples, signalEntry.snippet);
        }
      }
      for (const contextEntry of entry.analysis?.additionalContext || []) {
        pushUnique(aggregate.examples, contextEntry.snippet);
      }
      for (const recommendation of entry.analysis?.recommendations || []) {
        aggregate.recommendationCounts[recommendation] =
          (aggregate.recommendationCounts[recommendation] || 0) + 1;
      }
    }
  }

  const skills = submitted
    .reduce((acc, entry) => {
      acc[entry.skill] = (acc[entry.skill] || 0) + 1;
      return acc;
    }, {});

  const triagedSkills = Object.keys(skills)
    .sort((a, b) => a.localeCompare(b))
    .map((skill) => {
      const skillGroup = triageGroups.get(skill) || {
        totalEntries: 0,
        negativeEntries: 0,
        signals: new Map(),
      };
      const candidates = [...skillGroup.signals.values()]
        .filter((aggregate) => aggregate.occurrences >= minOccurrences)
        .map((aggregate) => {
          const definition = TRIAGE_SIGNAL_DEFINITIONS[aggregate.signal];
          return {
            id: `${skill}:${aggregate.signal}`,
            signal: aggregate.signal,
            label: definition.label,
            priority: classifyTriagePriority(
              aggregate.impactScore,
              aggregate.occurrences,
            ),
            occurrences: aggregate.occurrences,
            impactScore: Number(aggregate.impactScore.toFixed(2)),
            averagePenalty: Number(
              (aggregate.impactScore / aggregate.occurrences).toFixed(2),
            ),
            ratingCounts: aggregate.ratingCounts,
            examples: aggregate.examples,
            topRecommendations: topEntries(
              aggregate.recommendationCounts,
              3,
            ),
            suggestedEval: {
              kind: definition.evalKind,
              dimension: definition.dimension,
              nextAction: definition.nextAction,
              assertionHints: [...definition.assertionHints],
            },
          };
        })
        .sort(
          (a, b) =>
            comparePriority(a.priority, b.priority) ||
            b.impactScore - a.impactScore ||
            b.occurrences - a.occurrences ||
            a.label.localeCompare(b.label),
        );

      return {
        skill,
        totalEntries: skills[skill],
        negativeEntries: skillGroup.negativeEntries,
        candidates,
      };
    })
    .filter((entry) => entry.candidates.length > 0)
    .sort(
      (a, b) =>
        (b.candidates[0]?.impactScore || 0) - (a.candidates[0]?.impactScore || 0) ||
        b.candidates.length - a.candidates.length ||
        a.skill.localeCompare(b.skill),
    );

  const candidateCount = triagedSkills.reduce(
    (sum, skill) => sum + skill.candidates.length,
    0,
  );
  const highPriorityCount = triagedSkills.reduce(
    (sum, skill) =>
      sum + skill.candidates.filter((candidate) => candidate.priority === "high").length,
    0,
  );

  return {
    kind: "arcana-feedback-triage",
    generatedAt: new Date().toISOString(),
    filters: {
      skill: skillName,
      minOccurrences,
    },
    totals: {
      loadedEntries: filtered.length,
      submittedEntries: submitted.length,
      skillCount: triagedSkills.length,
      candidateCount,
      highPriorityCount,
    },
    skills: triagedSkills,
  };
}

export function writeFeedbackTriageReport(
  report,
  {
    cwd = process.cwd(),
    home = homedir(),
    scope = "project",
  } = {},
) {
  const dir = getFeedbackTriageDir({ scope, cwd, home });
  ensureDirSync(dir);
  const fileName = report.filters.skill ? `${report.filters.skill}.json` : "index.json";
  const filePath = join(dir, fileName);
  writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
  return filePath;
}
