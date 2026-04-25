import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import fsExtra from "fs-extra";
import {
  buildImportMetadata,
  buildImportSource,
  getImportRefreshCommand,
  getImportedContentChecksum,
  inspectImportedSkill,
  prependImportAttribution,
  summarizeImportOverwriteRisk,
  writeImportMetadata,
} from "../src/utils/import-metadata.js";

const TMP = join(import.meta.dirname, ".tmp-test-import-metadata");

beforeEach(() => {
  fsExtra.ensureDirSync(TMP);
});

afterEach(() => {
  fsExtra.removeSync(TMP);
});

describe("import metadata utilities", () => {
  it("ignores the attribution comment when hashing imported content", () => {
    const raw = "---\nname: sample\ndescription: 'Demo'\n---\n# Sample\n";
    const attributed = prependImportAttribution(raw, "file:/tmp/sample/SKILL.md");

    expect(getImportedContentChecksum(attributed)).toBe(getImportedContentChecksum(raw));
  });

  it("detects local modifications against stored import metadata", () => {
    const skillDir = join(TMP, "sample");
    fsExtra.ensureDirSync(skillDir);

    const raw = "---\nname: sample\ndescription: 'Demo'\n---\n# Sample\n";
    const attributed = prependImportAttribution(raw, "file:/tmp/sample/SKILL.md");
    fsExtra.writeFileSync(join(skillDir, "SKILL.md"), attributed);
    writeImportMetadata(skillDir, buildImportMetadata({
      name: "sample",
      source: buildImportSource({
        input: "./sample",
        label: "file:/tmp/sample/SKILL.md",
        type: "local",
        localPath: "/tmp/sample/SKILL.md",
      }),
      checksum: getImportedContentChecksum(raw),
      importedAt: "2026-04-09T00:00:00.000Z",
      arcanaVersion: "1.9.0",
    }));

    fsExtra.writeFileSync(
      join(skillDir, "SKILL.md"),
      prependImportAttribution(`${raw}\n## Local edits\n`, "file:/tmp/sample/SKILL.md"),
    );

    const inspection = inspectImportedSkill(skillDir);
    expect(inspection.trustState).toBe("modified-locally");
  });

  it("classifies overwrite risk for current, changed, and locally modified imports", () => {
    const source = buildImportSource({
      input: "./sample",
      label: "file:/tmp/sample/SKILL.md",
      type: "local",
      localPath: "/tmp/sample/SKILL.md",
    });

    const currentInspection = {
      metadata: {
        source,
        checksum: "aaaa",
        importedAt: "2026-04-09T00:00:00.000Z",
      },
      attribution: "file:/tmp/sample/SKILL.md",
      currentChecksum: "aaaa",
      trustState: "current",
    };

    expect(summarizeImportOverwriteRisk({
      existingInspection: currentInspection,
      incomingName: "sample",
      incomingChecksum: "aaaa",
      incomingSource: source,
      incomingLines: 10,
    }).status).toBe("already-current");

    expect(summarizeImportOverwriteRisk({
      targetExists: true,
      existingInspection: null,
      incomingName: "sample",
      incomingChecksum: "cccc",
      incomingSource: source,
      incomingLines: 10,
    }).status).toBe("unknown-existing");

    expect(summarizeImportOverwriteRisk({
      existingInspection: currentInspection,
      incomingName: "sample",
      incomingChecksum: "bbbb",
      incomingSource: source,
      incomingLines: 10,
    }).status).toBe("content-changed");

    expect(summarizeImportOverwriteRisk({
      existingInspection: {
        ...currentInspection,
        trustState: "modified-locally",
      },
      incomingName: "sample",
      incomingChecksum: "bbbb",
      incomingSource: source,
      incomingLines: 10,
    }).status).toBe("local-edits");
  });

  it("builds refresh commands that preserve exact source refs and shell-quote local paths", () => {
    expect(getImportRefreshCommand({
      source: {
        type: "github-repo",
        owner: "openai",
        repo: "skills",
        path: ".curated/gh-address-comments",
      },
    }, "gh-address-comments")).toBe(
      "arcana import 'openai/skills' '.curated/gh-address-comments' --review --force",
    );

    expect(getImportRefreshCommand({
      source: {
        type: "local",
        localPath: "/tmp/skill packs/my-skill/SKILL.md",
      },
    }, "my-skill")).toBe(
      "arcana import '/tmp/skill packs/my-skill/SKILL.md' --review --force",
    );
  });
});
