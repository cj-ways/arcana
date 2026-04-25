#!/usr/bin/env node

import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getPackageRoot } from "../src/utils/paths.js";

const packageRoot = getPackageRoot();
const binPath = join(packageRoot, "bin", "arcana.js");
const tempProject = mkdtempSync(join(tmpdir(), "arcana-smoke-"));

function fail(message, details = "") {
  const body = details ? `\n${details.trim()}\n` : "";
  throw new Error(`${message}${body}`);
}

function run(args, { cwd = tempProject, expectStatus = 0 } = {}) {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.error) throw result.error;

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (result.status !== expectStatus) {
    fail(
      `Smoke command failed: node ${binPath} ${args.join(" ")}`,
      `${stdout}${stderr}`,
    );
  }

  if (stderr.trim()) {
    fail(
      `Smoke command wrote to stderr: node ${binPath} ${args.join(" ")}`,
      stderr,
    );
  }

  return stdout;
}

try {
  const version = run(["--version"], { cwd: packageRoot }).trim();
  if (!version) fail("Smoke version check returned empty output.");

  const initialList = JSON.parse(
    run(["list", "--scope", "project", "--json"]),
  );
  if (initialList.kind !== "arcana-list") {
    fail("Smoke list check returned the wrong report kind.");
  }

  run(["add", "deep-fix", "--scope", "project", "--agent", "claude"]);

  const info = JSON.parse(run(["info", "deep-fix", "--json"]));
  if (info.kind !== "arcana-info" || info.name !== "deep-fix") {
    fail("Smoke info check returned the wrong skill metadata.");
  }

  const doctor = JSON.parse(run(["doctor", "--scope", "project", "--json"]));
  if (doctor.kind !== "arcana-doctor") {
    fail("Smoke doctor check returned the wrong report kind.");
  }
  if (doctor.summary.warnCount !== 0 || doctor.summary.failCount !== 0) {
    fail(
      "Smoke doctor check reported warnings or failures.",
      JSON.stringify(doctor.summary, null, 2),
    );
  }

  const installedList = JSON.parse(
    run(["list", "--scope", "project", "--json"]),
  );
  const deepFix = installedList.skills.find((skill) => skill.name === "deep-fix");
  if (!deepFix?.installed) {
    fail("Smoke install check did not see deep-fix as installed.");
  }
} finally {
  rmSync(tempProject, { recursive: true, force: true });
}
