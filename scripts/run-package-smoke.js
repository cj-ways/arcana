#!/usr/bin/env node

import { spawnSync } from "child_process";
import { mkdtempSync, readdirSync, rmSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getPackageRoot } from "../src/utils/paths.js";

const packageRoot = getPackageRoot();
const repoNodeModules = join(packageRoot, "node_modules");
const tempRoot = mkdtempSync(join(tmpdir(), "arcana-package-smoke-"));
const packDir = join(tempRoot, "pack");
const unpackDir = join(tempRoot, "unpacked");
const npmCacheDir = join(tempRoot, "npm-cache");
const tempProject = join(tempRoot, "project");

function fail(message, details = "") {
  const body = details ? `\n${details.trim()}\n` : "";
  throw new Error(`${message}${body}`);
}

function runCommand(command, args, { cwd = packageRoot, env = process.env, expectStatus = 0 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.error) throw result.error;

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (result.status !== expectStatus) {
    fail(
      `Command failed: ${command} ${args.join(" ")}`,
      `${stdout}${stderr}`,
    );
  }

  return { stdout, stderr };
}

function runPackagedCli(binPath, args, { cwd = tempProject, expectStatus = 0 } = {}) {
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
      `Packaged smoke command failed: node ${binPath} ${args.join(" ")}`,
      `${stdout}${stderr}`,
    );
  }

  if (stderr.trim()) {
    fail(
      `Packaged smoke command wrote to stderr: node ${binPath} ${args.join(" ")}`,
      stderr,
    );
  }

  return stdout;
}

try {
  runCommand("mkdir", ["-p", packDir, unpackDir, npmCacheDir, tempProject]);

  runCommand("npm", ["pack", "--pack-destination", packDir], {
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });

  const tarballName = readdirSync(packDir).find((name) => name.endsWith(".tgz"));
  if (!tarballName) {
    fail("Package smoke could not find a tarball after npm pack.");
  }

  const tarballPath = join(packDir, tarballName);
  runCommand("tar", ["-xzf", tarballPath, "-C", unpackDir]);

  const packagedRoot = join(unpackDir, "package");
  const packagedNodeModules = join(packagedRoot, "node_modules");
  symlinkSync(repoNodeModules, packagedNodeModules, "dir");

  const binPath = join(packagedRoot, "bin", "arcana.js");
  const version = runPackagedCli(binPath, ["--version"], { cwd: packagedRoot }).trim();
  if (!version) fail("Packaged smoke version check returned empty output.");

  const initialList = JSON.parse(
    runPackagedCli(binPath, ["list", "--scope", "project", "--json"]),
  );
  if (initialList.kind !== "arcana-list") {
    fail("Packaged smoke list check returned the wrong report kind.");
  }

  runPackagedCli(binPath, ["add", "deep-fix", "--scope", "project", "--agent", "claude"]);

  const info = JSON.parse(runPackagedCli(binPath, ["info", "deep-fix", "--json"]));
  if (info.kind !== "arcana-info" || info.name !== "deep-fix") {
    fail("Packaged smoke info check returned the wrong skill metadata.");
  }

  const doctor = JSON.parse(runPackagedCli(binPath, ["doctor", "--scope", "project", "--json"]));
  if (doctor.kind !== "arcana-doctor") {
    fail("Packaged smoke doctor check returned the wrong report kind.");
  }
  if (doctor.summary.warnCount !== 0 || doctor.summary.failCount !== 0) {
    fail(
      "Packaged smoke doctor check reported warnings or failures.",
      JSON.stringify(doctor.summary, null, 2),
    );
  }

  const installedList = JSON.parse(
    runPackagedCli(binPath, ["list", "--scope", "project", "--json"]),
  );
  const deepFix = installedList.skills.find((skill) => skill.name === "deep-fix");
  if (!deepFix?.installed) {
    fail("Packaged smoke install check did not see deep-fix as installed.");
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
