#!/usr/bin/env node
// Portable k6 single-file loop (win32-safe alternative to the sh-only
// `test:all` loop in tests/load/package.json).
//
// Usage (from the repo root):
//   node scripts/k6-run.js                 # api, auth, realtime in order
//   node scripts/k6-run.js --file=smoke    # single file (no .js suffix needed)
//   node scripts/k6-run.js --file=api -- smoke-specific k6 flags go after --
//   TARGET_URL=http://localhost:5001 node scripts/k6-run.js
//
// Each file runs as its own `k6 run` process so per-file summary JSON paths
// (tests/load/summary-*.json, repo-root relative) keep working. Stops on the
// first failing file (same semantics as `test:all`). LOCAL ONLY: never point
// TARGET_URL at production — the register flow creates real users and staged
// VUs are a self-inflicted DDoS on shared infra.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const LOAD_DIR = path.join(REPO_ROOT, "tests", "load");

const ALL_FILES = ["api", "auth", "realtime"];

function parseArgs(argv) {
  const files = [];
  const passthrough = [];
  let inPassthrough = false;
  for (const arg of argv) {
    if (inPassthrough) {
      passthrough.push(arg);
      continue;
    }
    if (arg === "--") {
      inPassthrough = true;
      continue;
    }
    if (arg.startsWith("--file=")) {
      files.push(arg.slice("--file=".length).replace(/\.js$/, ""));
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/k6-run.js [--file=<name>] [-- <k6 flags>]\n" +
          `Default files: ${ALL_FILES.join(", ")} (run from the repo root).`,
      );
      process.exit(0);
    }
    // Bare names are also accepted: node scripts/k6-run.js smoke
    if (!arg.startsWith("-")) {
      files.push(arg.replace(/\.js$/, ""));
      continue;
    }
    passthrough.push(arg);
  }
  return { files: files.length > 0 ? files : ALL_FILES, passthrough };
}

const { files, passthrough } = parseArgs(process.argv.slice(2));

for (const name of files) {
  const script = path.join(LOAD_DIR, `${name}.js`);
  console.log(`\n=== k6 run tests/load/${name}.js ===`);
  // shell:true keeps `k6` resolution working on win32 (cmd.exe/PowerShell)
  // and POSIX sh alike; cwd=repo root so summary-*.json paths resolve.
  const result = spawnSync("k6", ["run", script, ...passthrough], {
    stdio: "inherit",
    cwd: REPO_ROOT,
    shell: true,
    env: process.env,
  });
  if (result.error) {
    console.error(
      `Failed to launch k6 for ${name}.js: ${result.error.message}`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      `k6 run tests/load/${name}.js exited with code ${result.status}`,
    );
    process.exit(result.status);
  }
}

console.log("\nAll k6 files passed.");
