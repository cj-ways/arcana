import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import { spawnSync } from "child_process";
import {
  markArcanaManaged,
  getManagedContentHash,
  stripArcanaMarker,
} from "../src/utils/copy.js";
import { getPackageSkillsDir } from "../src/utils/paths.js";

const TMP = join(import.meta.dirname, ".tmp-test-commands");
const BIN = join(import.meta.dirname, "..", "bin", "arcana.js");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

function run(args) {
  const result = spawnSync(`"${process.execPath}" "${BIN}" ${args}`, {
    shell: true,
    encoding: "utf-8",
    timeout: 15000,
    cwd: TMP,
    stdio: "pipe",
  });
  return {
    output: (result.stdout || "") + (result.stderr || ""),
    status: result.status ?? 1,
  };
}

describe("arcana add", () => {
  it("installs a skill to project scope", () => {
    const { output, status } = run(
      "add deep-fix --scope project --agent claude",
    );
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
    expect(
      fsExtra.existsSync(
        join(TMP, ".claude", "skills", "deep-fix", "SKILL.md"),
      ),
    ).toBe(true);
  });

  it("installs multiple skills", () => {
    const { output, status } = run(
      "add deep-fix create-pr --scope project --agent claude",
    );
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
    expect(output).toContain("✓ create-pr");
  });

  it("exits non-zero for unknown skill name", () => {
    const { output, status } = run("add nonexistent-xyz --scope project");
    expect(status).not.toBe(0);
    expect(output).toContain("Unknown skill");
    expect(output).toContain("Run `arcana list`");
  });

  it("exits non-zero with no arguments", () => {
    const { output, status } = run("add");
    expect(status).not.toBe(0);
    expect(output).toContain("Usage:");
  });

  it("installs all skills with --all", () => {
    const { output, status } = run("add --all --scope project --agent claude");
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
    expect(output).toContain("✓ deep-review");
    expect(output).toContain("agent");
  });

  it("detects conflict with existing non-arcana skill", () => {
    const customDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(
      join(customDir, "SKILL.md"),
      "---\nname: my-custom\n---\n# Custom",
    );

    const { output } = run("add deep-fix --scope project --agent claude");
    expect(output).toContain("skipped");
  });

  it("--force overrides conflict", () => {
    const customDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(customDir);
    fsExtra.writeFileSync(
      join(customDir, "SKILL.md"),
      "---\nname: my-custom\n---\n# Custom",
    );

    const { output, status } = run(
      "add deep-fix --scope project --agent claude --force",
    );
    expect(status).toBe(0);
    expect(output).toContain("✓ deep-fix");
  });

  it("supports --dry-run without writing files", () => {
    const { output, status } = run(
      "add deep-fix --scope project --agent claude --dry-run",
    );
    expect(status).toBe(0);
    expect(output).toContain("Would install");
    expect(output).toContain("Dry run complete");
    expect(
      fsExtra.existsSync(
        join(TMP, ".claude", "skills", "deep-fix", "SKILL.md"),
      ),
    ).toBe(false);
  });
});

describe("arcana remove", () => {
  it("removes an installed skill", () => {
    run("add deep-fix --scope project --agent claude");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "deep-fix"))).toBe(
      true,
    );

    const { output, status } = run("remove deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("Removed deep-fix");
    expect(fsExtra.existsSync(join(TMP, ".claude", "skills", "deep-fix"))).toBe(
      false,
    );
  });

  it("exits non-zero for non-installed skill", () => {
    const { output, status } = run("remove deep-fix");
    expect(status).not.toBe(0);
    expect(output).toContain("not found");
  });

  it("exits non-zero with no arguments", () => {
    const { output, status } = run("remove");
    expect(status).not.toBe(0);
    expect(output).toContain("Usage:");
  });
});

describe("arcana list", () => {
  it("lists available skills (exit 0)", () => {
    const { output, status } = run("list");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Skills");
    expect(output).toContain("deep-fix");
    expect(output).toContain("deep-review");
  });

  it("shows installed status after adding", () => {
    run("add deep-fix --scope project --agent claude");
    const { output } = run("list");
    expect(output).toContain("✓ deep-fix");
  });

  it("emits machine-readable inventory with --json", () => {
    run("add deep-fix --scope project --agent claude");
    const { output, status } = run("list --scope project --json");
    expect(status).toBe(0);
    const report = JSON.parse(output);
    expect(report.kind).toBe("arcana-list");
    expect(report.scope).toBe("project");
    expect(report.skills.find((skill) => skill.name === "deep-fix")).toMatchObject({
      name: "deep-fix",
      installed: true,
    });
    expect(report.agents.find((agent) => agent.name === "code-reviewer")).toMatchObject({
      name: "code-reviewer",
      installed: false,
    });
  });
});

describe("arcana use", () => {
  it("prints skill content to stdout (exit 0)", () => {
    const { output, status } = run("use deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("name: deep-fix");
    expect(output).toContain("description:");
  });

  it("prints agent content to stdout", () => {
    const { output, status } = run("use code-reviewer");
    expect(status).toBe(0);
    expect(output).toContain("name: code-reviewer");
  });

  it("exits non-zero for unknown skill", () => {
    const { output, status } = run("use nonexistent-xyz");
    expect(status).not.toBe(0);
    expect(output).toContain("Unknown skill or agent");
    expect(output).toContain("Available:");
    expect(output).toContain("Run `arcana list`");
  });
});

describe("arcana info", () => {
  it("shows skill metadata (exit 0)", () => {
    const { output, status } = run("info deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("deep-fix");
    expect(output).toContain("Type:");
    expect(output).toContain("skill");
    expect(output).toContain("Lines:");
    expect(output).toContain("Size:");
  });

  it("shows agent metadata", () => {
    const { output, status } = run("info code-reviewer");
    expect(status).toBe(0);
    expect(output).toContain("code-reviewer");
    expect(output).toContain("agent");
  });

  it("emits skill metadata as JSON", () => {
    const { output, status } = run("info deep-fix --json");
    expect(status).toBe(0);
    const report = JSON.parse(output);
    expect(report.kind).toBe("arcana-info");
    expect(report.type).toBe("skill");
    expect(report.name).toBe("deep-fix");
    expect(report.lines).toBeGreaterThan(0);
    expect(report.sizeKb).toBeGreaterThan(0);
  });

  it("exits non-zero for unknown name", () => {
    const { output, status } = run("info nonexistent-xyz");
    expect(status).not.toBe(0);
    expect(output).toContain("Unknown skill or agent");
  });
});

describe("arcana doctor", () => {
  it("runs without error in a clean directory", () => {
    const { output, status } = run("doctor");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Doctor");
    expect(output).toContain("Summary:");
  });

  it("finds installed skills after adding", () => {
    run("add deep-fix --scope project --agent claude");
    const { output } = run("doctor");
    expect(output).toContain("deep-fix");
    expect(output).toContain("PASS");
  });

  it("emits a machine-readable health report with --json", () => {
    run("add deep-fix --scope project --agent claude");
    const { output, status } = run("doctor --scope project --json");
    expect(status).toBe(0);
    const report = JSON.parse(output);
    expect(report.kind).toBe("arcana-doctor");
    expect(report.scope).toBe("project");
    expect(report.summary.exitCode).toBe(0);
    expect(report.skillLocations.some((location) => location.installedSkills.includes("deep-fix"))).toBe(true);
  });
});

describe("arcana feedback", () => {
  it("records structured feedback without prompting when flags are provided", () => {
    const { output, status } = run(
      'feedback deep-fix --rating helpful --notes "clear workflow"',
    );
    expect(status).toBe(0);
    expect(output).toContain("Arcana Feedback");
    expect(output).toContain("Saved feedback for /deep-fix");
    expect(
      fsExtra.existsSync(join(TMP, ".arcana", "feedback", "entries.jsonl")),
    ).toBe(true);
  });

  it("analyzes a transcript with consent when requested", () => {
    const transcriptPath = join(TMP, "feature-audit-transcript.txt");
    fsExtra.writeFileSync(
      transcriptPath,
      [
        "User: /feature-audit search",
        "Assistant: What are you trying to improve?",
        "User: This is too generic.",
        "Assistant: Can you narrow it down?",
        "User: Focus only on enterprise search in the admin panel.",
        "Assistant: Any stack constraints?",
        "User: We use Next.js and Elasticsearch.",
      ].join("\n"),
    );

    const { output, status } = run(
      `feedback feature-audit --rating not-helpful --reasons too-generic,missed-important-angle --notes "needed stronger prioritization" --transcript "${transcriptPath}" --analyze-transcript`,
    );
    expect(status).toBe(0);
    expect(output).toContain("Transcript Analysis");
    expect(output).toContain(
      "Ask for scope and boundaries before expanding the task.",
    );
  });
});

describe("arcana feedback-report", () => {
  it("summarizes stored feedback entries", () => {
    run('feedback deep-fix --rating helpful --notes "clear workflow"');
    run(
      'feedback deep-fix --rating not-helpful --reasons wrong-assumptions --notes "assumed the wrong service"',
    );

    const { output, status } = run("feedback-report deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Feedback Report");
    expect(output).toContain("Skill: /deep-fix");
    expect(output).toContain("Average score");
    expect(output).toContain("wrong assumptions");
  });
});

describe("arcana feedback-triage", () => {
  it("turns repeated complaints into candidate eval follow-ups", () => {
    run(
      'feedback deep-fix --rating not-helpful --reasons wrong-assumptions --notes "Assumed the wrong service"',
    );
    run(
      'feedback deep-fix --rating partly-helpful --reasons wrong-assumptions --notes "Still aimed at the worker instead of the API gateway"',
    );

    const { output, status } = run("feedback-triage deep-fix");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Feedback Triage");
    expect(output).toContain("/deep-fix");
    expect(output).toContain("Wrong assumptions");
    expect(output).toContain("scenario/process");
  });

  it("writes a local triage report with --write", () => {
    run(
      'feedback feature-audit --rating not-helpful --reasons too-generic --notes "Needed stronger prioritization"',
    );
    run(
      'feedback feature-audit --rating partly-helpful --reasons too-generic --notes "Still too broad"',
    );

    const { output, status } = run("feedback-triage feature-audit --write");
    expect(status).toBe(0);
    expect(output).toContain("Stored in:");
    expect(
      fsExtra.existsSync(
        join(TMP, ".arcana", "feedback", "triage", "feature-audit.json"),
      ),
    ).toBe(true);
  });

  it("writes local eval draft packs with --write-drafts", () => {
    run(
      'feedback deep-fix --rating not-helpful --reasons wrong-assumptions --notes "Assumed the wrong service"',
    );
    run(
      'feedback deep-fix --rating partly-helpful --reasons wrong-assumptions --notes "Still aimed at the worker instead of the API gateway"',
    );

    const { output, status } = run(
      "feedback-triage deep-fix --write-drafts --draft-limit 1",
    );

    expect(status).toBe(0);
    expect(output).toContain("Local Eval Drafts");
    expect(output).toContain("wrong-assumptions");
    expect(
      fsExtra.existsSync(
        join(
          TMP,
          ".arcana",
          "feedback",
          "triage",
          "drafts",
          "deep-fix",
          "wrong-assumptions",
          "manifest.json",
        ),
      ),
    ).toBe(true);
    expect(
      fsExtra.existsSync(
        join(
          TMP,
          ".arcana",
          "feedback",
          "triage",
          "drafts",
          "deep-fix",
          "wrong-assumptions",
          "README.md",
        ),
      ),
    ).toBe(true);
    expect(
      fsExtra.existsSync(
        join(
          TMP,
          ".arcana",
          "feedback",
          "triage",
          "drafts",
          "deep-fix",
          "wrong-assumptions",
          "evidence.md",
        ),
      ),
    ).toBe(true);
  });
});

describe("arcana feedback-promote", () => {
  it("blocks promotion when the draft still has placeholders and no real fixture", () => {
    run(
      'feedback deep-fix --rating not-helpful --reasons wrong-assumptions --notes "Assumed the wrong service"',
    );
    run(
      'feedback deep-fix --rating partly-helpful --reasons wrong-assumptions --notes "Still aimed at the worker instead of the API gateway"',
    );
    run("feedback-triage deep-fix --write-drafts --draft-limit 1");

    const { output, status } = run(
      "feedback-promote deep-fix wrong-assumptions",
    );

    expect(status).not.toBe(0);
    expect(output).toContain("Promotion blocked");
    expect(output).toContain("Add at least one real fixture file");
    expect(output).toContain("Remove placeholder text");
  });

  it("promotes a reviewed draft into evals/scenarios and archives the original draft", () => {
    run(
      'feedback deep-fix --rating not-helpful --reasons wrong-assumptions --notes "Assumed the wrong service"',
    );
    run(
      'feedback deep-fix --rating partly-helpful --reasons wrong-assumptions --notes "Still aimed at the worker instead of the API gateway"',
    );
    run("feedback-triage deep-fix --write-drafts --draft-limit 1");

    const draftDir = join(
      TMP,
      ".arcana",
      "feedback",
      "triage",
      "drafts",
      "deep-fix",
      "wrong-assumptions",
    );
    const manifestPath = join(draftDir, "manifest.json");
    const manifest = JSON.parse(fsExtra.readFileSync(manifestPath, "utf-8"));
    manifest.description =
      "Feedback-derived scenario for /deep-fix assumption-checking around the API gateway path.";
    manifest.prompt =
      "Investigate the API gateway route selection and write the final report to artifacts/deep-fix-wrong-assumptions-feedback-report.md.";
    manifest.expected[0].description = "Report artifact file exists";
    manifest.expected[1].description =
      "Report validates the API gateway assumption before concluding";
    manifest.expected[1].contentIncludes = [
      "Validate the API gateway assumption",
    ];
    manifest.falsePositives[0].description =
      "Report should not jump straight to the worker-only path";
    manifest.falsePositives[0].contentIncludes = [
      "Worker-only root cause",
    ];
    fsExtra.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    fsExtra.writeFileSync(
      join(draftDir, "README.md"),
      "# Reviewed Feedback Scenario\n\nThis draft was reviewed and is ready for promotion.\n",
    );
    fsExtra.ensureDirSync(join(draftDir, "src"));
    fsExtra.writeFileSync(
      join(draftDir, "src", "gateway.js"),
      "export function resolveRoute(input) { return input?.path || '/'; }\n",
    );

    const dryRun = run("feedback-promote deep-fix wrong-assumptions --dry-run");
    expect(dryRun.status).toBe(0);
    expect(dryRun.output).toContain("Draft is promotable");

    const promoted = run("feedback-promote deep-fix wrong-assumptions");
    expect(promoted.status).toBe(0);
    expect(promoted.output).toContain(
      "Promoted to evals/scenarios/deep-fix-wrong-assumptions-feedback/",
    );

    expect(
      fsExtra.existsSync(
        join(
          TMP,
          "evals",
          "scenarios",
          "deep-fix-wrong-assumptions-feedback",
          "manifest.json",
        ),
      ),
    ).toBe(true);
    expect(fsExtra.existsSync(draftDir)).toBe(false);
    expect(
      fsExtra
        .readdirSync(
          join(
            TMP,
            ".arcana",
            "feedback",
            "triage",
            "promoted",
            "deep-fix",
          ),
        )
        .some((entry) => entry.startsWith("wrong-assumptions-")),
    ).toBe(true);
  });
});

describe("arcana feedback-hooks", () => {
  it("installs and reports Claude Code auto-feedback hooks", () => {
    const install = run("feedback-hooks install --sample-rate 0.2 --cooldown-hours 8");
    expect(install.status).toBe(0);
    expect(install.output).toContain("Installed automatic Arcana feedback prompts");

    const status = run("feedback-hooks status");
    expect(status.status).toBe(0);
    expect(status.output).toContain("Arcana Auto Feedback");
    expect(status.output).toContain("Installed in Claude Code local project settings");
    expect(status.output).toContain("20%");
    expect(status.output).toContain("8 hour(s)");
  });

  it("uninstalls auto-feedback hooks", () => {
    run("feedback-hooks install");
    const uninstall = run("feedback-hooks uninstall");
    expect(uninstall.status).toBe(0);
    expect(uninstall.output).toContain("Removed automatic Arcana feedback hooks");

    const status = run("feedback-hooks status");
    expect(status.output).toContain("Not installed");
  });

  it("rejects invalid sampling values", () => {
    const result = run("feedback-hooks install --sample-rate 2");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Invalid --sample-rate");
    expect(result.output).toContain("Use a value between 0 and 1.");
  });
});

describe("arcana update", () => {
  it("reports current when installed skills already match package source", () => {
    run("add deep-fix --scope project --agent claude");
    const { output, status } = run("update");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Update");
    expect(output).toContain("already current");
  });

  it("updates older managed skills when their stored hash matches installed content", () => {
    const skillDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    const oldContent =
      "---\nname: deep-fix\ndescription: old\n---\n# Old packaged content\n";
    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      markArcanaManaged(oldContent, {
        version: "1.8.0",
        hash: getManagedContentHash(oldContent),
      }),
    );

    const { output, status } = run("update");
    expect(status).toBe(0);
    expect(output).toContain("deep-fix updated");

    const installed = fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(stripArcanaMarker(installed)).toBe(
      fsExtra.readFileSync(
        join(getPackageSkillsDir(), "deep-fix", "SKILL.md"),
        "utf-8",
      ),
    );
  });

  it("skips locally edited managed skills without force", () => {
    const skillDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    const sourceContent = fsExtra.readFileSync(
      join(getPackageSkillsDir(), "deep-fix", "SKILL.md"),
      "utf-8",
    );
    const customized = `${sourceContent}\n## Local Notes\nkeep this\n`;

    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      markArcanaManaged(customized, {
        version: "1.8.0",
        hash: getManagedContentHash(sourceContent),
      }),
    );

    const { output, status } = run("update");
    expect(status).toBe(0);
    expect(output).toContain("local edits detected");
    expect(
      stripArcanaMarker(
        fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8"),
      ),
    ).toBe(customized);
  });

  it("restores locally edited managed skills with --force", () => {
    const skillDir = join(TMP, ".claude", "skills", "deep-fix");
    fsExtra.ensureDirSync(skillDir);

    const sourceContent = fsExtra.readFileSync(
      join(getPackageSkillsDir(), "deep-fix", "SKILL.md"),
      "utf-8",
    );
    const customized = `${sourceContent}\n## Local Notes\nkeep this\n`;

    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      markArcanaManaged(customized, {
        version: "1.8.0",
        hash: getManagedContentHash(sourceContent),
      }),
    );

    const { output, status } = run("update --force");
    expect(status).toBe(0);
    expect(output).toContain("deep-fix updated");
    expect(
      stripArcanaMarker(
        fsExtra.readFileSync(join(skillDir, "SKILL.md"), "utf-8"),
      ),
    ).toBe(sourceContent);
  });

  it("runs without error even with no project-level skills", () => {
    const { output, status } = run("update");
    expect(status).toBe(0);
    expect(output).toContain("Arcana Update");
  });
});

describe("arcana sync (exit codes)", () => {
  it("exits non-zero when .agents/skills/ does not exist", () => {
    const { status } = run("sync");
    expect(status).not.toBe(0);
  });

  it("exits 0 on successful sync", () => {
    const canonical = join(TMP, ".agents", "skills", "test-skill");
    fsExtra.ensureDirSync(canonical);
    fsExtra.writeFileSync(
      join(canonical, "SKILL.md"),
      "---\nname: test-skill\n---\n# Test",
    );
    fsExtra.ensureDirSync(join(TMP, ".claude"));

    const { status } = run("sync");
    expect(status).toBe(0);
  });

  it("supports --dry-run without creating mirror directories", () => {
    const canonical = join(TMP, ".agents", "skills", "test-skill");
    fsExtra.ensureDirSync(canonical);
    fsExtra.writeFileSync(
      join(canonical, "SKILL.md"),
      "---\nname: test-skill\n---\n# Test",
    );
    fsExtra.ensureDirSync(join(TMP, ".claude"));

    const { output, status } = run("sync --dry-run");
    expect(status).toBe(0);
    expect(output).toContain("Would sync");
    expect(output).toContain("Dry run complete");
    expect(
      fsExtra.existsSync(join(TMP, ".claude", "skills", "test-skill", "SKILL.md")),
    ).toBe(false);
  });

  it("shows troubleshooting details with --verbose", () => {
    const canonical = join(TMP, ".agents", "skills", "test-skill");
    fsExtra.ensureDirSync(canonical);
    fsExtra.writeFileSync(
      join(canonical, "SKILL.md"),
      "---\nname: test-skill\n---\n<!-- arcana-managed -->\n# Test",
    );

    const staleCustom = join(TMP, ".claude", "skills", "custom-stale");
    fsExtra.ensureDirSync(staleCustom);
    fsExtra.writeFileSync(
      join(staleCustom, "SKILL.md"),
      "---\nname: custom-stale\n---\n# Custom",
    );

    const { output, status } = run("sync --clean --verbose");
    expect(status).toBe(0);
    expect(output).toContain("[debug] canonical dir");
    expect(output).toContain("[debug] selected targets");
    expect(output).toContain("[debug] canonical skill names");
    expect(output).toContain("[debug] preserving entry");
    expect(fsExtra.existsSync(staleCustom)).toBe(true);
  });
});

describe("upgrade path: migration + update + sync", () => {
  it("renames skill via migration and updates it", () => {
    // Simulate pre-migration state: user has old-named skill installed
    const skillsDir = join(TMP, ".claude", "skills");
    fsExtra.ensureDirSync(join(skillsDir, "new-project-idea"));
    fsExtra.writeFileSync(
      join(skillsDir, "new-project-idea", "SKILL.md"),
      "---\nname: new-project-idea\n---\n<!-- arcana-managed -->\n# Old content",
    );

    // Run update — should apply migration (rename) then re-copy
    const { output } = run("update");
    expect(output).toContain("Arcana Update");

    // The old name should be gone, new name should exist with latest content
    expect(fsExtra.existsSync(join(skillsDir, "new-project-idea"))).toBe(false);
    expect(fsExtra.existsSync(join(skillsDir, "idea-audit", "SKILL.md"))).toBe(
      true,
    );
  });
});
