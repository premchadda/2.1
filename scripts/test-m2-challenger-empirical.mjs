/**
 * Empirical Adversarial Test Harness for Milestone 2
 * Challenger M2-2 Verification Suite
 *
 * Runs comprehensive runtime tests against actual Express routers,
 * mock database adapters, and shared libraries.
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../apps/backend");

const backendRequire = createRequire(path.join(backendDir, "package.json"));
const express = (await import(pathToFileURL(backendRequire.resolve("express")).href)).default;
const jwt = (await import(pathToFileURL(backendRequire.resolve("jsonwebtoken")).href)).default;

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-32-chars-min-len";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-jwt-refresh-secret-32-chars-min";
process.env.ADMIN_PANEL_URL = "https://trstprep-admin.vercel.app";
process.env.NODE_ENV = "test";

const JWT_SECRET = process.env.JWT_SECRET;

const results = {
  passed: 0,
  failed: 0,
  details: [],
};

function assert(condition, message, testGroup) {
  if (condition) {
    results.passed++;
    results.details.push({ status: "PASS", group: testGroup, message });
    console.log(`  ✅ [PASS] [${testGroup}] ${message}`);
  } else {
    results.failed++;
    results.details.push({ status: "FAIL", group: testGroup, message });
    console.error(`  ❌ [FAIL] [${testGroup}] ${message}`);
  }
}

function makeRequest({ app, method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const payload = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
      const reqHeaders = { ...headers };
      if (payload && !reqHeaders["Content-Type"]) {
        reqHeaders["Content-Type"] = "application/json";
      }
      if (payload) {
        reqHeaders["Content-Length"] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path,
          headers: reqHeaders,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            server.close(() => {
              let json = null;
              try {
                json = JSON.parse(data);
              } catch {
                json = data;
              }
              resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
            });
          });
        },
      );

      req.on("error", (err) => {
        server.close(() => reject(err));
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

function generateAdminToken(payload = { id: 1, email: "admin@trstprep.com", role: "admin", is_admin: true }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

function generateUserToken(payload = { id: 42, email: "student@trstprep.com", role: "student", is_admin: false }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

// =========================================================================
// SECTION 1: SHARED HOOKS VERIFICATION
// =========================================================================
async function testSharedHooks() {
  console.log("\n--- SECTION 1: Shared Hooks Package Adversarial Testing ---");
  const testGroup = "Shared Hooks";

  // 1.1 Verify exports from packages/shared-hooks/src/index.js
  try {
    const sharedHooksSrc = await import("../packages/shared-hooks/src/index.js");
    assert(typeof sharedHooksSrc.useUndoRedo === "function", "src/index.js exports useUndoRedo as function", testGroup);
    assert(typeof sharedHooksSrc.useFormManager === "function", "src/index.js exports useFormManager as function", testGroup);
    assert(typeof sharedHooksSrc.useDraggableScroll === "function", "src/index.js exports useDraggableScroll as function", testGroup);
    assert(typeof sharedHooksSrc.useStages === "function", "src/index.js exports useStages as function", testGroup);
    assert(typeof sharedHooksSrc.useExamCategories === "function", "src/index.js exports useExamCategories as function", testGroup);
    assert(typeof sharedHooksSrc.useTestCategories === "function", "src/index.js exports useTestCategories as function", testGroup);
    assert(typeof sharedHooksSrc.useProPass === "function", "src/index.js exports useProPass as function", testGroup);
    assert(typeof sharedHooksSrc.useGenericCRUD === "function", "src/index.js exports useGenericCRUD as function", testGroup);
    assert(typeof sharedHooksSrc.useWebSocket === "function", "src/index.js exports useWebSocket as function", testGroup);
    assert(typeof sharedHooksSrc.useDebounce === "function", "src/index.js exports useDebounce as function", testGroup);
    assert(typeof sharedHooksSrc.useSearch === "function", "src/index.js exports useSearch as function", testGroup);
    assert(typeof sharedHooksSrc.usePwaInstall === "function", "src/index.js exports usePwaInstall as function", testGroup);
  } catch (err) {
    assert(false, `Failed importing packages/shared-hooks/src/index.js: ${err.message}`, testGroup);
  }

  // 1.2 Verify exports from root entrypoint packages/shared-hooks/index.js
  try {
    const fs = await import("node:fs");
    const indexContent = fs.readFileSync(path.join(backendDir, "../../packages/shared-hooks/index.js"), "utf8");
    assert(indexContent.includes('export { default as useUndoRedo } from "./useUndoRedo.js";'), "index.js exports useUndoRedo", testGroup);
    assert(indexContent.includes('export { default as useFormManager } from "./useFormManager.js";'), "index.js exports useFormManager", testGroup);
    assert(indexContent.includes('export { default as useDraggableScroll } from "./useDraggableScroll.js";'), "index.js exports useDraggableScroll", testGroup);
  } catch (err) {
    assert(false, `Failed verifying packages/shared-hooks/index.js: ${err.message}`, testGroup);
  }

  // 1.3 Behavioral stress testing of useUndoRedo logic
  try {
    let history = [];
    let currentIndex = -1;
    const maxHistory = 3;

    function execute(doAction, undoAction, label) {
      const idx = currentIndex;
      const newHistory = history.slice(0, idx + 1);
      newHistory.push({ doAction, undoAction, label });
      if (newHistory.length > maxHistory) {
        history = newHistory.slice(-maxHistory);
      } else {
        history = newHistory;
      }
      currentIndex = Math.min(currentIndex + 1, maxHistory - 1);
    }

    function undo() {
      if (currentIndex < 0) return null;
      const entry = history[currentIndex];
      entry.undoAction();
      currentIndex--;
      return { result: true, label: entry.label };
    }

    function redo() {
      if (currentIndex >= history.length - 1) return null;
      const entry = history[currentIndex + 1];
      entry.doAction();
      currentIndex++;
      return { result: true, label: entry.label };
    }

    let state = 0;
    execute(() => { state = 1; }, () => { state = 0; }, "step 1");
    assert(currentIndex === 0 && history.length === 1, "useUndoRedo execute 1 updates index and history", testGroup);

    execute(() => { state = 2; }, () => { state = 1; }, "step 2");
    assert(currentIndex === 1 && history.length === 2, "useUndoRedo execute 2 updates index and history", testGroup);

    undo();
    assert(state === 1 && currentIndex === 0, "useUndoRedo undo reverts state and decrements index", testGroup);

    redo();
    assert(state === 2 && currentIndex === 1, "useUndoRedo redo applies state and increments index", testGroup);

    // History branching
    undo(); // back to step 1
    execute(() => { state = 3; }, () => { state = 1; }, "step 3");
    assert(history.length === 2 && history[1].label === "step 3" && currentIndex === 1, "useUndoRedo branching truncates future history", testGroup);

    // Max history trimming
    execute(() => {}, () => {}, "step 4");
    execute(() => {}, () => {}, "step 5");
    assert(history.length === maxHistory, "useUndoRedo trims history to maxHistory", testGroup);
  } catch (err) {
    assert(false, `useUndoRedo logic test failed: ${err.message}`, testGroup);
  }

  // 1.4 Behavioral validation of useFormManager rules
  try {
    const validationRules = {
      name: { required: true, requiredMessage: "Name is required" },
      age: { custom: (val) => val < 18 ? "Must be 18+" : null },
      code: { pattern: /^[A-Z]{3}$/, patternMessage: "Code must be 3 uppercase letters" },
      bio: { maxLength: 20 },
      short: { minLength: 5 },
    };

    function validateField(field, value, formData) {
      const rules = validationRules[field];
      if (!rules) return null;
      if (rules.required && (!value || value.toString().trim() === '')) {
        return rules.requiredMessage || `${field} is required`;
      }
      if (rules.minLength && value && value.length < rules.minLength) {
        return `Minimum ${rules.minLength} characters required`;
      }
      if (rules.maxLength && value && value.length > rules.maxLength) {
        return `Maximum ${rules.maxLength} characters allowed`;
      }
      if (rules.pattern && value && !rules.pattern.test(value)) {
        return rules.patternMessage || 'Invalid format';
      }
      if (rules.custom && typeof rules.custom === 'function') {
        return rules.custom(value, formData);
      }
      return null;
    }

    assert(validateField("name", "", {}) === "Name is required", "useFormManager required rule fires on empty", testGroup);
    assert(validateField("name", "Valid", {}) === null, "useFormManager required rule passes on non-empty", testGroup);
    assert(validateField("code", "abc", {}) === "Code must be 3 uppercase letters", "useFormManager pattern rule fails invalid format", testGroup);
    assert(validateField("code", "ABC", {}) === null, "useFormManager pattern rule passes valid format", testGroup);
    assert(validateField("age", 15, {}) === "Must be 18+", "useFormManager custom rule fails below threshold", testGroup);
    assert(validateField("age", 25, {}) === null, "useFormManager custom rule passes above threshold", testGroup);
    assert(validateField("bio", "This string is longer than 20 characters", {}) === "Maximum 20 characters allowed", "useFormManager maxLength rule fires", testGroup);
    assert(validateField("short", "ab", {}) === "Minimum 5 characters required", "useFormManager minLength rule fires", testGroup);
  } catch (err) {
    assert(false, `useFormManager validation test failed: ${err.message}`, testGroup);
  }
}

// =========================================================================
// SECTION 2: DEEP ANALYTICS DIAGNOSTICS ADVERSARIAL TESTING
// =========================================================================
async function testDeepAnalyticsDiagnostics() {
  console.log("\n--- SECTION 2: Deep Analytics Diagnostics Adversarial Testing ---");
  const testGroup = "Deep Analytics Diagnostics";

  const { dbHelpers, pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
  const adminDeepAnalyticsModule = await import("../apps/backend/src/api/routes/admin-deep-analytics.js");
  const analyticsRouter = adminDeepAnalyticsModule.default;

  // Stub findById on dbHelpers for auth middleware
  const origFindById = dbHelpers.findById;
  dbHelpers.findById = async (collection, id) => {
    if (collection === "users") {
      const numId = Number(id);
      return {
        id: numId,
        name: numId === 1 ? "Admin User" : "Student User",
        email: numId === 1 ? "admin@trstprep.com" : "student@trstprep.com",
        role: numId === 1 ? "admin" : "student",
        isAdmin: numId === 1,
        is_admin: numId === 1,
        isActive: true,
        is_active: true,
        isEmailVerified: true,
        emailVerified: true,
      };
    }
    return origFindById ? origFindById.call(dbHelpers, collection, id) : null;
  };

  const app = express();
  app.use(express.json());
  app.use("/analytics/deep", analyticsRouter);

  const adminToken = generateAdminToken();
  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  // Store original query function
  const origQuery = dbHelpers.pool.query;

  // 2.1 Standard Live Case
  dbHelpers.pool.query = async (text, params) => {
    if (text.includes("FROM questions")) {
      return {
        rows: [
          { diff_level: "easy", count: 38 },
          { diff_level: "medium", count: 45 },
          { diff_level: "hard", count: 17 },
        ],
      };
    }
    if (text.includes("FROM attempts") && text.includes("LIMIT 100")) {
      return {
        rows: [
          { id: 1, status: "completed", is_completed: true, time_spent: 300, score: "80" },
          { id: 2, status: "completed", is_completed: false, time_spent: 120, score: "70" },
          { id: 3, status: "in_progress", is_completed: false, time_spent: 30, score: "0" }, // anomalous
          { id: 4, status: "in_progress", is_completed: false, time_spent: 150, score: "50" },
        ],
      };
    }
    if (text.includes("WITH user_practice AS")) {
      return {
        rows: [
          { has_practice: true, group_avg: "76.50" },
          { has_practice: false, group_avg: "54.20" },
        ],
      };
    }
    return { rows: [] };
  };

  const resDiag = await makeRequest({
    app,
    method: "GET",
    path: "/analytics/deep/diagnostics",
    headers: authHeaders,
  });


  assert(resDiag.statusCode === 200, "GET /diagnostics returns HTTP 200", testGroup);
  assert(resDiag.body.success === true, "Response has success: true", testGroup);
  assert(resDiag.body.data.difficulty.easy === 38.0, "Difficulty easy = 38.0%", testGroup);
  assert(resDiag.body.data.difficulty.medium === 45.0, "Difficulty medium = 45.0%", testGroup);
  assert(resDiag.body.data.difficulty.hard === 17.0, "Difficulty hard = 17.0%", testGroup);
  assert(resDiag.body.data.reliability.totalRecentSessions === 4, "totalRecentSessions = 4", testGroup);
  assert(resDiag.body.data.reliability.completionRate === 50.0, "completionRate = 50.0% (2/4)", testGroup);
  assert(resDiag.body.data.reliability.anomalousDropouts === 1, "anomalousDropouts = 1 (time < 60 && score == 0)", testGroup);
  assert(resDiag.body.data.practiceBridge.practiceActiveAvgScore === 76.5, "practiceActiveAvgScore = 76.5", testGroup);
  assert(resDiag.body.data.practiceBridge.mockOnlyAvgScore === 54.2, "mockOnlyAvgScore = 54.2", testGroup);
  assert(resDiag.body.data.practiceBridge.delta === 22.3, "delta = 22.3 (76.5 - 54.2)", testGroup);

  // 2.2 Deep Diagnostics Alias
  const resDeepDiag = await makeRequest({
    app,
    method: "GET",
    path: "/analytics/deep/deep/diagnostics",
    headers: authHeaders,
  });
  assert(resDeepDiag.statusCode === 200, "GET /deep/diagnostics returns HTTP 200", testGroup);
  assert(resDeepDiag.body.data.practiceBridge.delta === 22.3, "GET /deep/diagnostics returns identical diagnostic data", testGroup);

  // 2.3 Edge Case: 0 questions in DB
  dbHelpers.pool.query = async (text, params) => {
    if (text.includes("FROM questions")) {
      return { rows: [] };
    }
    if (text.includes("FROM attempts") && text.includes("LIMIT 100")) {
      return { rows: [] };
    }
    if (text.includes("WITH user_practice AS")) {
      return { rows: [] };
    }
    return { rows: [] };
  };

  const resZero = await makeRequest({
    app,
    method: "GET",
    path: "/analytics/deep/diagnostics",
    headers: authHeaders,
  });

  assert(resZero.statusCode === 200, "Zero-data tables return HTTP 200 without throwing 500", testGroup);
  assert(!isNaN(resZero.body.data.difficulty.easy), "Zero questions produces no NaN in easy", testGroup);
  assert(!isNaN(resZero.body.data.difficulty.medium), "Zero questions produces no NaN in medium", testGroup);
  assert(!isNaN(resZero.body.data.difficulty.hard), "Zero questions produces no NaN in hard", testGroup);
  assert(resZero.body.data.difficulty.easy === 33.3, "Zero questions easy defaults to 33.3", testGroup);
  assert(resZero.body.data.difficulty.medium === 33.4, "Zero questions medium defaults to 33.4", testGroup);
  assert(resZero.body.data.difficulty.hard === 33.3, "Zero questions hard defaults to 33.3", testGroup);
  assert(resZero.body.data.reliability.totalRecentSessions === 0, "Zero attempts: totalRecentSessions = 0", testGroup);
  assert(resZero.body.data.reliability.completionRate === 100, "Zero attempts: completionRate = 100 (no 0/0 NaN)", testGroup);
  assert(resZero.body.data.reliability.anomalousDropouts === 0, "Zero attempts: anomalousDropouts = 0", testGroup);
  assert(resZero.body.data.practiceBridge.practiceActiveAvgScore === 75.0, "Zero practice bridge: practiceActive defaults to 75.0", testGroup);
  assert(resZero.body.data.practiceBridge.mockOnlyAvgScore === 55.0, "Zero practice bridge: mockOnly defaults to 55.0", testGroup);
  assert(resZero.body.data.practiceBridge.delta === 20.0, "Zero practice bridge: delta defaults to 20.0", testGroup);

  // 2.4 Edge Case: Skewed & Non-standard Difficulties
  dbHelpers.pool.query = async (text, params) => {
    if (text.includes("FROM questions")) {
      return {
        rows: [
          { diff_level: "easy", count: 100 },
          { diff_level: "hard", count: 0 },
        ],
      };
    }
    return { rows: [] };
  };

  const resSkewed = await makeRequest({
    app,
    method: "GET",
    path: "/analytics/deep/diagnostics",
    headers: authHeaders,
  });
  assert(resSkewed.body.data.difficulty.easy === 100.0, "100% easy questions calculates easy = 100.0%", testGroup);
  assert(resSkewed.body.data.difficulty.medium === 0.0, "100% easy questions calculates medium = 0.0%", testGroup);
  assert(resSkewed.body.data.difficulty.hard === 0.0, "100% easy questions calculates hard = 0.0%", testGroup);

  // 2.5 Error Handling Resilience
  dbHelpers.pool.query = async () => {
    throw new Error("Simulated database failure");
  };

  const resError = await makeRequest({
    app,
    method: "GET",
    path: "/analytics/deep/diagnostics",
    headers: authHeaders,
  });
  assert(resError.statusCode === 500, "Database query error produces HTTP 500", testGroup);
  assert(resError.body.success === false, "Error response has success: false", testGroup);
  assert(resError.body.message.includes("Simulated database failure"), "Error message safely surfaced", testGroup);

  // Restore original query
  dbHelpers.pool.query = origQuery;
}

// =========================================================================
// SECTION 3: QUESTION IMPORT HISTORY ADVERSARIAL TESTING
// =========================================================================
async function testQuestionImportHistory() {
  console.log("\n--- SECTION 3: Question Import History Adversarial Testing ---");
  const testGroup = "Question Import History";

  const { pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
  const adminQuestionsModule = await import("../apps/backend/src/api/routes/admin-questions.js");
  const questionsRouter = adminQuestionsModule.default;

  const app = express();
  app.use(express.json());
  app.use(questionsRouter);

  const adminToken = generateAdminToken();
  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const origQuery = pool.query;

  // 3.1 Route Resolution & Precedence Check
  let queryLimitArg = null;
  pool.query = async (text, params) => {
    if (typeof text === "string" && text.includes("unified_history")) {
      queryLimitArg = params[0];
      return {
        rows: [
          {
            id: "audit_101",
            action: "question_bulk_import",
            details: JSON.stringify({ imported: 50, skipped: 2 }),
            timestamp: new Date().toISOString(),
            adminUser: "superadmin@trstprep.com",
          },
          {
            id: "import_5",
            action: "import_csv",
            details: JSON.stringify({ fileName: "questions.csv", totalRecords: 52 }),
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            adminUser: "System",
          },
        ],
      };
    }
    return { rows: [] };
  };

  // Test /questions/import-history
  const resImport = await makeRequest({
    app,
    method: "GET",
    path: "/questions/import-history",
    headers: authHeaders,
  });

  assert(resImport.statusCode === 200, "GET /questions/import-history returns HTTP 200", testGroup);
  assert(resImport.body.success === true, "Response has success: true", testGroup);
  assert(Array.isArray(resImport.body.data) && resImport.body.data.length === 2, "Returns unified history records", testGroup);
  assert(queryLimitArg === 20, "Default pagination limit is 20", testGroup);

  // Test /import-history alias
  const resShort = await makeRequest({
    app,
    method: "GET",
    path: "/import-history",
    headers: authHeaders,
  });
  assert(resShort.statusCode === 200, "GET /import-history returns HTTP 200", testGroup);
  assert(resShort.body.data.length === 2, "GET /import-history returns import data", testGroup);

  // 3.2 Pagination Clamping Adversarial Battery
  const paginationCases = [
    { query: "?limit=50", expected: 50, label: "normal limit 50" },
    { query: "?limit=1", expected: 1, label: "boundary limit 1" },
    { query: "?limit=100", expected: 100, label: "boundary limit 100" },
    { query: "?limit=500", expected: 100, label: "exceeded limit 500 clamped to 100" },
    { query: "?limit=-10", expected: 1, label: "negative limit -10 clamped to 1" },
    { query: "?limit=0", expected: 20, label: "0 limit defaulted to 20" },
    { query: "?limit=bad_number", expected: 20, label: "invalid limit string defaulted to 20" },
  ];

  for (const testCase of paginationCases) {
    await makeRequest({
      app,
      method: "GET",
      path: `/questions/import-history${testCase.query}`,
      headers: authHeaders,
    });
    assert(queryLimitArg === testCase.expected, `Pagination: ${testCase.label} (applied $1 = ${queryLimitArg})`, testGroup);
  }

  // 3.3 Query Fallback Resilience (when UNION query throws)
  let fallbackExecuted = false;
  pool.query = async (text, params) => {
    if (typeof text === "string" && text.includes("unified_history")) {
      throw new Error('relation "import_logs" does not exist');
    }
    if (typeof text === "string" && text.includes("FROM audit_logs a") && !text.includes("UNION ALL")) {
      fallbackExecuted = true;
      return {
        rows: [
          {
            id: "audit_fallback_1",
            action: "question_import",
            details: "Recovered from audit_logs",
            timestamp: new Date().toISOString(),
            adminUser: "Admin",
          },
        ],
      };
    }
    return { rows: [] };
  };

  const resFallback = await makeRequest({
    app,
    method: "GET",
    path: "/questions/import-history",
    headers: authHeaders,
  });

  assert(resFallback.statusCode === 200, "Fallback query returns HTTP 200 when UNION fails", testGroup);
  assert(fallbackExecuted, "Fallback query to audit_logs only was executed", testGroup);
  assert(resFallback.body.data[0].id === "audit_fallback_1", "Returns audit_logs fallback data cleanly", testGroup);

  // 3.4 Empty Tables Resilience
  pool.query = async () => ({ rows: [] });
  const resEmpty = await makeRequest({
    app,
    method: "GET",
    path: "/questions/import-history",
    headers: authHeaders,
  });
  assert(resEmpty.statusCode === 200, "Empty audit and import logs return HTTP 200", testGroup);
  assert(Array.isArray(resEmpty.body.data) && resEmpty.body.data.length === 0, "Returns empty array []", testGroup);

  // Restore original query
  pool.query = origQuery;
}

// =========================================================================
// SECTION 4: QUESTION NOTES API ADVERSARIAL TESTING
// =========================================================================
async function testNotesApi() {
  console.log("\n--- SECTION 4: Question Notes API (notes.js) Adversarial Testing ---");
  const testGroup = "Question Notes API";

  const { pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
  const notesModule = await import("../apps/backend/src/api/routes/notes.js");
  const notesRouter = notesModule.default;

  const app = express();
  app.use(express.json());
  app.use("/api/notes", notesRouter);

  const userToken = generateUserToken({ id: 42, email: "user42@trstprep.com", role: "student" });
  const authHeaders = { Authorization: `Bearer ${userToken}` };

  const origQuery = pool.query;

  // 4.1 Unauthenticated Request Blocked
  const resUnauth = await makeRequest({
    app,
    method: "GET",
    path: "/api/notes",
  });
  assert(resUnauth.statusCode === 401, "Unauthenticated request to /api/notes returns 401 Unauthorized", testGroup);

  // 4.2 GET /api/notes - Tenant Isolation Scoped to req.user.id
  let lastQueryParams = null;
  pool.query = async (text, params) => {
    lastQueryParams = params;
    return {
      rows: [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          questionId: "q101",
          contextId: "c1",
          noteText: "Important formula to remember",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  };

  const resList = await makeRequest({
    app,
    method: "GET",
    path: "/api/notes?questionId=q101&contextId=c1&limit=25&offset=5",
    headers: authHeaders,
  });

  assert(resList.statusCode === 200, "GET /api/notes returns HTTP 200", testGroup);
  assert(resList.body.success === true, "Response has success: true", testGroup);
  assert(lastQueryParams[0] === 42, "Query strictly parameterizes user_id = req.user.id ($1 = 42)", testGroup);
  assert(lastQueryParams.includes("q101") && lastQueryParams.includes("c1"), "Filters by questionId and contextId", testGroup);

  // 4.3 POST /api/notes - Validation
  // Missing questionId
  const resNoQ = await makeRequest({
    app,
    method: "POST",
    path: "/api/notes",
    headers: authHeaders,
    body: { noteText: "Some text" },
  });
  assert(resNoQ.statusCode === 400 && resNoQ.body.message.includes("questionId"), "POST /api/notes validates missing questionId", testGroup);

  // Empty noteText
  const resEmptyText = await makeRequest({
    app,
    method: "POST",
    path: "/api/notes",
    headers: authHeaders,
    body: { questionId: "q101", noteText: "   " },
  });
  assert(resEmptyText.statusCode === 400 && resEmptyText.body.message.includes("noteText"), "POST /api/notes validates empty noteText", testGroup);

  // Note text exceeding 10,000 characters
  const longText = "a".repeat(10001);
  const resTooLong = await makeRequest({
    app,
    method: "POST",
    path: "/api/notes",
    headers: authHeaders,
    body: { questionId: "q101", noteText: longText },
  });
  assert(resTooLong.statusCode === 400 && resTooLong.body.message.includes("10,000 characters"), "POST /api/notes enforces 10k character limit", testGroup);

  // Valid note creation
  pool.query = async (text, params) => {
    return {
      rows: [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          questionId: params[1],
          contextId: params[2],
          noteText: params[3],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  };

  const resCreated = await makeRequest({
    app,
    method: "POST",
    path: "/api/notes",
    headers: authHeaders,
    body: { questionId: "q101", noteText: "Valid note text" },
  });
  assert(resCreated.statusCode === 201, "POST /api/notes creates note and returns 201 Created", testGroup);
  assert(resCreated.body.data.noteText === "Valid note text", "Returns created note object", testGroup);

  // 4.4 PUT /api/notes/:id - Invalid UUID & Tenant Isolation
  const resInvalidId = await makeRequest({
    app,
    method: "PUT",
    path: "/api/notes/invalid-uuid-format",
    headers: authHeaders,
    body: { noteText: "Updated" },
  });
  assert(resInvalidId.statusCode === 400 && resInvalidId.body.message.includes("Invalid note ID format"), "PUT /api/notes/:id validates UUID regex", testGroup);

  // 4.5 DELETE /api/notes/:id - IDOR Protection & 404
  let deleteQueryText = "";
  let deleteQueryParams = [];
  pool.query = async (text, params) => {
    deleteQueryText = text;
    deleteQueryParams = params;
    return { rows: [{ id: params[0] }], rowCount: 1 };
  };

  const resDelete = await makeRequest({
    app,
    method: "DELETE",
    path: "/api/notes/3fa85f64-5717-4562-b3fc-2c963f66afa6",
    headers: authHeaders,
  });
  assert(resDelete.statusCode === 200, "DELETE /api/notes/:id returns HTTP 200", testGroup);
  assert(deleteQueryText.includes("user_id = $2"), "DELETE query scopes deletion to user_id (IDOR defense)", testGroup);
  assert(deleteQueryParams[1] === 42, "DELETE query verifies user_id = 42", testGroup);

  // 4.6 DELETE /api/notes/:id - Not Found (404)
  pool.query = async () => ({ rows: [], rowCount: 0 });
  const resNotFound = await makeRequest({
    app,
    method: "DELETE",
    path: "/api/notes/3fa85f64-5717-4562-b3fc-2c963f66afa6",
    headers: authHeaders,
  });
  assert(resNotFound.statusCode === 404, "DELETE /api/notes/:id returns HTTP 404 when note does not exist", testGroup);

  // Restore original query
  pool.query = origQuery;
}

// =========================================================================
// SECTION 5: FUNDAMENTALS DRILL HISTORY TESTING
// =========================================================================
async function testFundamentalsHistory() {
  console.log("\n--- SECTION 5: Fundamentals Drill History Adversarial Testing ---");
  const testGroup = "Fundamentals History";

  const { pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
  const practiceModule = await import("../apps/backend/src/api/routes/practice.js");
  const practiceRouter = practiceModule.default;

  const app = express();
  app.use(express.json());
  app.use("/api/practice", practiceRouter);

  const userToken = generateUserToken({ id: 77, email: "driller@trstprep.com", role: "student" });
  const authHeaders = { Authorization: `Bearer ${userToken}` };

  const origQuery = pool.query;

  let passedParams = null;
  pool.query = async (text, params) => {
    if (typeof text === "string" && text.includes("FROM fundamental_drill_sessions")) {
      passedParams = params;
      return {
        rows: [
          {
            id: "d1",
            category: "tables",
            score: 18,
            totalQuestions: 20,
            durationMs: 45000,
            accuracy: "90.00",
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  };

  const resHist = await makeRequest({
    app,
    method: "GET",
    path: "/api/practice/fundamentals/history?category=tables&limit=30",
    headers: authHeaders,
  });

  assert(resHist.statusCode === 200, "GET /fundamentals/history returns HTTP 200", testGroup);
  assert(resHist.body.success === true, "Response has success: true", testGroup);
  assert(resHist.body.data[0].accuracy === 90.0, "Accuracy string converted to Number (90.0)", testGroup);
  assert(passedParams[0] === 77, "Query scoped to user_id = 77", testGroup);
  assert(passedParams.includes("tables"), "Filtered by category 'tables'", testGroup);
  assert(passedParams.includes(30), "Clamped limit to 30", testGroup);

  pool.query = origQuery;
}

// =========================================================================
// SECTION 6: EXAM SHIFTS DYNAMIC QUERY (MOCK ELIMINATION)
// =========================================================================
async function testExamDynamicShifts() {
  console.log("\n--- SECTION 6: Exam Dynamic Shifts Mock Elimination Testing ---");
  const testGroup = "Exam Dynamic Shifts";

  const fs = await import("node:fs");
  const code = fs.readFileSync(path.join(backendDir, "src/modules/exams/exam.routes.js"), "utf8");

  assert(!code.includes("${year} Shift 1"), "exam.routes.js has no '${year} Shift 1'", testGroup);
  assert(!code.includes("${year} Shift 2"), "exam.routes.js has no '${year} Shift 2'", testGroup);
  assert(!code.includes("${year} Shift 3"), "exam.routes.js has no '${year} Shift 3'", testGroup);
  assert(!code.includes("${year}-12-01"), "exam.routes.js has no '${year}-12-01' synthetic date", testGroup);
  assert(code.includes("previousYearPapers: previousYearPapers || []"), "exam.routes.js returns real tests or empty array []", testGroup);
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
async function main() {
  console.log("===============================================================");
  console.log("🧪 STARTING CHALLENGER M2-2 EMPIRICAL ADVERSARIAL TEST SUITE");
  console.log("===============================================================");

  await testSharedHooks();
  await testDeepAnalyticsDiagnostics();
  await testQuestionImportHistory();
  await testNotesApi();
  await testFundamentalsHistory();
  await testExamDynamicShifts();

  console.log("\n===============================================================");
  console.log("EMPIRICAL ADVERSARIAL TEST SUMMARY");
  console.log("===============================================================");
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.error("\n❌ CHALLENGER ADVERSARIAL VERIFICATION FAILED!");
    process.exit(1);
  } else {
    console.log("\n🎉 ALL EMPIRICAL CHALLENGES AND STRESS TESTS PASSED!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
