#!/usr/bin/env node
/**
 * tests/e2e/runner.js
 * Master CLI test runner and reporter for the Trstprep V2.1 4-Tier E2E Test Suite.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

// Register JSX and asset loader hook for Node 24 ESM component testing
const loaderPath = path.resolve(process.cwd(), "tests/e2e/harness/jsxLoader.mjs");
if (fs.existsSync(loaderPath)) {
  try {
    register(pathToFileURL(loaderPath).href, import.meta.url);
  } catch {}
}

import { resetRegistry, runSuites } from "./harness/testContext.js";
import { ensureLiveTestServer, stopLiveTestServer } from "./harness/testServer.js";
import { apiClient } from "./harness/apiClient.js";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tier: null,
    feature: null,
    all: false,
    bail: false,
    json: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg === "--bail") {
      options.bail = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg.startsWith("--tier=")) {
      options.tier = arg.split("=")[1].trim();
    } else if (arg.startsWith("--feature=")) {
      let rawFeat = arg.split("=")[1].trim().toUpperCase();
      if (/^\d+$/.test(rawFeat)) {
        rawFeat = `F${rawFeat}`;
      }
      options.feature = rawFeat;
    }
  }

  // Default to all if no tier or feature is specified
  if (!options.tier && !options.feature) {
    options.all = true;
  }

  return options;
}

function printHelp() {
  console.log(`
${ANSI.bold}Trstprep V2.1 Unified E2E Test Runner${ANSI.reset}

Usage:
  node tests/e2e/runner.js [options]

Options:
  --tier=1|2|3|4     Execute only test suites belonging to the given tier
  --feature=F<N>     Filter execution to suites matching a specific feature (e.g. --feature=F1, --feature=F11)
  --all              Run full test suite across all 4 tiers (default)
  --bail             Abort immediately upon encountering the first test failure
  --json             Emit structured execution report to tests/e2e-report.json
  --help, -h         Display this help message

Examples:
  node tests/e2e/runner.js --tier=1
  node tests/e2e/runner.js --feature=F4
  node tests/e2e/runner.js --tier=2 --bail
  node tests/e2e/runner.js --all --json
`);
}

function findTestFiles(tiersDir, options) {
  const files = [];

  const tierDirs = [
    { tier: "1", dir: "tier1_contracts" },
    { tier: "2", dir: "tier2_edge_cases" },
    { tier: "3", dir: "tier3_cross_feature" },
    { tier: "4", dir: "tier4_user_journeys" },
  ];

  for (const t of tierDirs) {
    if (options.tier && options.tier !== t.tier) {
      continue;
    }
    const fullDirPath = path.resolve(tiersDir, t.dir);
    if (!fs.existsSync(fullDirPath)) continue;

    const entries = fs.readdirSync(fullDirPath).filter((f) => f.endsWith(".test.js") || f.endsWith(".test.mjs"));

    for (const file of entries) {
      if (options.feature) {
        // e.g. feature=F1 matches tier1_f1_...
        const featLower = options.feature.toLowerCase();
        const featPattern = new RegExp(`_${featLower}_|_pair\\d+_|journey`, "i");
        if (!file.toLowerCase().includes(`_${featLower}_`)) {
          // Check if it's tier3 or tier4 that might cover the feature
          continue;
        }
      }
      files.push({
        tier: t.tier,
        tierName: t.dir,
        fileName: file,
        fullPath: path.resolve(fullDirPath, file),
      });
    }
  }

  return files;
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}======================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}🧪 TRSTPREP V2.1 E2E TEST SUITE RUNNER${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}======================================================${ANSI.reset}`);
  console.log(`${ANSI.dim}Filters: Tier=${options.tier || "ALL"}, Feature=${options.feature || "ALL"}, Bail=${options.bail}, JSON=${options.json}${ANSI.reset}\n`);

  const tiersDir = path.resolve(process.cwd(), "tests/e2e/tiers");
  const testFiles = findTestFiles(tiersDir, options);

  if (testFiles.length === 0) {
    console.error(`\n${ANSI.bold}${ANSI.red}❌ Error: No test files found matching criteria.${ANSI.reset}`);
    console.error(`   Provided filter: tier=${options.tier || "ALL"}, feature=${options.feature || "ALL"}\n`);
    process.exit(1);
  }

  console.log(`${ANSI.bold}Discovered ${testFiles.length} test suite files:${ANSI.reset}`);
  testFiles.forEach((f, idx) => {
    console.log(`  ${ANSI.dim}${String(idx + 1).padStart(2, " ")}.${ANSI.reset} [Tier ${f.tier}] ${f.fileName}`);
  });
  console.log();

  const liveUrl = await ensureLiveTestServer();
  apiClient.setBaseUrl(liveUrl);
  console.log(`${ANSI.cyan}⚡ Live backend API active at: ${liveUrl}${ANSI.reset}\n`);

  try {
    resetRegistry();

    // Dynamically load each test suite file
    for (const file of testFiles) {
      try {
        await import(pathToFileURL(file.fullPath).href);
      } catch (importErr) {
        console.error(`${ANSI.red}❌ Failed to load test suite ${file.fileName}:${ANSI.reset}`, importErr);
        process.exit(1);
      }
    }

    let lastSuiteName = "";
    const results = await runSuites({
      bail: options.bail,
      onTestResult: (tResult) => {
        if (tResult.suiteName !== lastSuiteName) {
          lastSuiteName = tResult.suiteName;
          console.log(`\n${ANSI.bold}${ANSI.blue}▶ ${lastSuiteName}${ANSI.reset}`);
        }
        if (tResult.passed) {
          console.log(`  ${ANSI.green}✓${ANSI.reset} ${tResult.name} ${ANSI.dim}(${tResult.durationMs}ms)${ANSI.reset}`);
        } else {
          console.log(`  ${ANSI.red}✗ ${tResult.name}${ANSI.reset} ${ANSI.dim}(${tResult.durationMs}ms)${ANSI.reset}`);
          if (tResult.error) {
            console.log(`    ${ANSI.red}${tResult.error.message}${ANSI.reset}`);
          }
        }
      },
    });

    console.log(`\n${ANSI.bold}------------------------------------------------------${ANSI.reset}`);
    console.log(`${ANSI.bold}TEST EXECUTION SUMMARY:${ANSI.reset}`);
    console.log(`  Total Tests Run:  ${ANSI.bold}${results.total}${ANSI.reset}`);
    console.log(`  Passed:           ${ANSI.green}${results.passed}${ANSI.reset}`);
    console.log(`  Failed:           ${results.failed > 0 ? ANSI.red + results.failed : ANSI.green + "0"}${ANSI.reset}`);
    console.log(`  Total Duration:   ${(results.durationMs / 1000).toFixed(2)}s`);
    console.log(`${ANSI.bold}------------------------------------------------------${ANSI.reset}`);

    if (results.failures.length > 0) {
      console.log(`\n${ANSI.bold}${ANSI.red}FAILURES DETAILS (${results.failures.length}):${ANSI.reset}`);
      results.failures.forEach((f, i) => {
        console.log(`\n${i + 1}) [${f.suite}] ${f.test}`);
        console.log(`${ANSI.red}${f.error?.stack || f.error?.message || f.error}${ANSI.reset}`);
      });
    }

    if (options.json) {
      const reportPath = path.resolve(process.cwd(), "tests/e2e-report.json");
      const reportData = {
        timestamp: new Date().toISOString(),
        options,
        summary: {
          total: results.total,
          passed: results.passed,
          failed: results.failed,
          durationMs: results.durationMs,
        },
        failures: results.failures.map((f) => ({
          suite: f.suite,
          test: f.test,
          message: f.error?.message,
          stack: f.error?.stack,
        })),
        suites: results.suites,
      };
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf-8");
      console.log(`\n${ANSI.cyan}📄 JSON execution report saved to: ${reportPath}${ANSI.reset}`);
    }

    if (results.failed === 0 && results.total > 0) {
      console.log(`\n${ANSI.bgGreen}${ANSI.bold}  VERDICT: PASS  ${ANSI.reset} All ${results.total} tests executed cleanly.\n`);
      process.exit(0);
    } else {
      console.log(`\n${ANSI.bgRed}${ANSI.bold}  VERDICT: FAIL  ${ANSI.reset} ${results.failed} failed tests.\n`);
      process.exit(1);
    }
  } finally {
    await stopLiveTestServer();
  }
}

main().catch((err) => {
  console.error(`${ANSI.red}FATAL ERROR IN TEST RUNNER:${ANSI.reset}`, err);
  process.exit(1);
});
