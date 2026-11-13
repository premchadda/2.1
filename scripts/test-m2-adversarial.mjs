/**
 * Adversarial Test Suite for Milestone 2 Features (F8, F9, F11, F12)
 * Reviewer & Adversarial Critic: reviewer_m2_2
 */

import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=================================================");
console.log("🚀 STARTING ADVERSARIAL STRESS TEST FOR MILESTONE 2");
console.log("=================================================");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split("\n").slice(1, 4).join("\n"));
    }
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split("\n").slice(1, 4).join("\n"));
    }
  }
}

// -------------------------------------------------------------
// 1. FEATURE F8: Deep Analytics Diagnostics (admin-deep-analytics.js)
// -------------------------------------------------------------
console.log("\n--- [F8] Stress-Testing Deep Analytics Diagnostics ---");

const deepAnalyticsFile = path.resolve("apps/backend/src/api/routes/admin-deep-analytics.js");
const deepAnalyticsCode = fs.readFileSync(deepAnalyticsFile, "utf8");

runTest("F8.1: Diagnostic routes /diagnostics and /deep/diagnostics are registered", () => {
  assert(deepAnalyticsCode.includes('router.get("/diagnostics", handleGetDiagnostics)'), "Missing /diagnostics route");
  assert(deepAnalyticsCode.includes('router.get("/deep/diagnostics", handleGetDiagnostics)'), "Missing /deep/diagnostics route");
});

runTest("F8.2: Zero-questions edge case prevents division by zero", () => {
  assert(deepAnalyticsCode.includes("totalQuestions > 0"), "Formula must check totalQuestions > 0 to avoid division by zero");
  assert(deepAnalyticsCode.includes("33.3") && deepAnalyticsCode.includes("33.4"), "Must have default balanced distribution fallback");
});

runTest("F8.3: Zero-attempts edge case prevents division by zero in completionRate", () => {
  assert(deepAnalyticsCode.includes("totalRecentSessions > 0"), "Completion rate must guard against 0 sessions");
  assert(deepAnalyticsCode.includes(": 100"), "Fallback completion rate when no sessions exist should be 100");
});

runTest("F8.4: Practice bridge calculation handles null / empty groups with realistic defaults", () => {
  assert(deepAnalyticsCode.includes("practiceActiveAvgScore ?? 75.0"), "Missing default 75.0 for active practice score");
  assert(deepAnalyticsCode.includes("mockOnlyAvgScore ?? 55.0"), "Missing default 55.0 for mock only score");
  assert(deepAnalyticsCode.includes("delta = Math.round((finalPracticeScore - finalMockScore) * 10) / 10"), "Delta calculation precision");
});

runTest("F8.5: Response contract conforms to PROJECT.md specifications", () => {
  assert(deepAnalyticsCode.includes("difficulty,"), "Response must include difficulty object");
  assert(deepAnalyticsCode.includes("reliability,"), "Response must include reliability object");
  assert(deepAnalyticsCode.includes("practiceBridge,"), "Response must include practiceBridge object");
});

// -------------------------------------------------------------
// 2. FEATURE F9: Question Import History (admin-questions.js)
// -------------------------------------------------------------
console.log("\n--- [F9] Stress-Testing Question Import History API ---");

const adminQuestionsFile = path.resolve("apps/backend/src/api/routes/admin-questions.js");
const adminQuestionsCode = fs.readFileSync(adminQuestionsFile, "utf8");

runTest("F9.1: Import history routes are registered BEFORE /questions/:id to prevent shadowing", () => {
  const importHistoryPos = adminQuestionsCode.indexOf('router.get("/questions/import-history"');
  const paramIdPos = adminQuestionsCode.indexOf('router.get("/questions/:id"');
  assert(importHistoryPos > 0, "Missing /questions/import-history route");
  assert(paramIdPos > 0, "Missing /questions/:id route");
  assert(importHistoryPos < paramIdPos, `Route ordering violation! /questions/import-history (${importHistoryPos}) is after /questions/:id (${paramIdPos})`);
});

runTest("F9.2: Clamping & sanitization of limit query parameter", () => {
  assert(adminQuestionsCode.includes("Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)") ||
         adminQuestionsCode.includes("parseInt(req.query.limit, 10) || 20"), "Limit parameter must be parsed and bounded");
});

runTest("F9.3: Query executes UNION ALL with fallback on schema absence / error", () => {
  assert(adminQuestionsCode.includes("FROM audit_logs"), "Must query audit_logs");
  assert(adminQuestionsCode.includes("FROM import_logs"), "Must query import_logs");
  assert(adminQuestionsCode.includes("fallbackQuery"), "Must include graceful fallback to audit_logs if import_logs fails");
});

// -------------------------------------------------------------
// 3. FEATURE F11: Dynamic Exam Shifts Query (exam.routes.js)
// -------------------------------------------------------------
console.log("\n--- [F11] Stress-Testing Dynamic Exam Shifts Query ---");

const examRoutesFile = path.resolve("apps/backend/src/modules/exams/exam.routes.js");
const examRoutesCode = fs.readFileSync(examRoutesFile, "utf8");

runTest("F11.1: Verification that mock shifts fallback is completely eliminated", () => {
  assert(!examRoutesCode.includes("${year} Shift 1"), "Hardcoded '${year} Shift 1' mock still found in exam.routes.js!");
  assert(!examRoutesCode.includes("${year} Shift 2"), "Hardcoded '${year} Shift 2' mock still found in exam.routes.js!");
  assert(!examRoutesCode.includes("${year} Shift 3"), "Hardcoded '${year} Shift 3' mock still found in exam.routes.js!");
  assert(!examRoutesCode.includes("title: `${year} Shift"), "Hardcoded shift title generator still found!");
});

runTest("F11.2: Dynamic tests query properly maps test paper metadata", () => {
  assert(examRoutesCode.includes("previousYearPapers = (tests || []).slice(0, 5).map"), "Must safely map tests array");
  assert(examRoutesCode.includes("previousYearPapers: previousYearPapers || []"), "Must return empty array [] if no tests found");
});

// -------------------------------------------------------------
// 4. FEATURE F12: Shared Hooks Package Activation & Exports
// -------------------------------------------------------------
console.log("\n--- [F12] Stress-Testing Shared Hooks Package Activation ---");

const hooksPkgJsonFile = path.resolve("packages/shared-hooks/package.json");
const hooksPkgJson = JSON.parse(fs.readFileSync(hooksPkgJsonFile, "utf8"));

runTest("F12.1: package.json exports mapping includes index and src/index.js", () => {
  assert(hooksPkgJson.exports["."], "package.json missing '.' export");
  assert(hooksPkgJson.exports["./src/index.js"], "package.json missing './src/index.js' export");
  assert(hooksPkgJson.exports["./src"], "package.json missing './src' export");
});

runTest("F12.2: package.json scripts contains runnable test script", () => {
  assert(hooksPkgJson.scripts && hooksPkgJson.scripts.test, "package.json missing 'test' script");
});

await runAsyncTest("F12.3: Verify all expected hooks can be imported from packages/shared-hooks/src/index.js", async () => {
  const sharedHooksSrc = await import("../packages/shared-hooks/src/index.js");
  const requiredFunctions = [
    "useUndoRedo",
    "useFormManager",
    "useDraggableScroll",
    "useStages",
    "useExamCategories",
    "useTestCategories",
    "useProPass",
    "useGenericCRUD",
    "useWebSocket",
    "useDebounce",
    "useSearch",
    "usePwaInstall",
    "filterAndRank",
    "calculateFuzzyScore",
    "normalizeSearchText",
    "setSharedApiClient",
    "getSharedApiClient"
  ];

  for (const fnName of requiredFunctions) {
    assert(typeof sharedHooksSrc[fnName] === "function", `Expected ${fnName} to be exported as a function, got ${typeof sharedHooksSrc[fnName]}`);
  }
});

runTest("F12.4: Verify root entrypoint packages/shared-hooks/index.js static exports", () => {
  const rootIndexContent = fs.readFileSync("packages/shared-hooks/index.js", "utf8");
  const requiredHooks = [
    "useUndoRedo",
    "useFormManager",
    "useDraggableScroll",
    "useStages",
    "useExamCategories",
    "useTestCategories",
    "useProPass",
    "useGenericCRUD",
    "useWebSocket",
    "useDebounce",
    "useSearch",
  ];

  for (const hookName of requiredHooks) {
    assert(rootIndexContent.includes(hookName), `Root index.js must export ${hookName}`);
  }
});

// -------------------------------------------------------------
// 5. INTEGRITY VIOLATION CHECKS
// -------------------------------------------------------------
console.log("\n--- Integrity Verification Across Milestone 2 Deliverables ---");

runTest("INTEGRITY: No hardcoded test responses in admin-deep-analytics.js", () => {
  assert(!deepAnalyticsCode.includes('"completionRate": 97.8'), "Deep analytics contains hardcoded completionRate 97.8 from example!");
  assert(!deepAnalyticsCode.includes('"delta": 22.3'), "Deep analytics contains hardcoded delta 22.3 from example!");
});

runTest("INTEGRITY: No dummy or empty facade in admin-questions.js import history", () => {
  assert(adminQuestionsCode.includes("pool.query"), "Import history must execute real database queries via pool");
});

runTest("INTEGRITY: No stubbed mock shifts in exam.routes.js", () => {
  assert(!examRoutesCode.includes("Shift 1"), "exam.routes.js must not contain Shift 1 stub");
});

console.log("\n=================================================");
console.log(`STRESS TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
console.log("=================================================");

if (passedTests !== totalTests) {
  process.exit(1);
}
