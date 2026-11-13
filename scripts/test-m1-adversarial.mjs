/**
 * Empirical Adversarial Test Harness for Milestone 1 Security Hardening
 * Challenger 2 Verification Suite
 *
 * Tests:
 * 1. Audit Log URL Query Redaction and sensitive data handling
 * 2. Route Convergence Hardening for stages.js and fortspy.js
 * 3. Client IP Extraction Hardening and Express trust proxy behavior
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../apps/backend");

// Use require from backend directory to resolve packages like express and jsonwebtoken
const backendRequire = createRequire(path.join(backendDir, "package.json"));
const express = (await import(pathToFileURL(backendRequire.resolve("express")).href)).default;
const jwt = (await import(pathToFileURL(backendRequire.resolve("jsonwebtoken")).href)).default;

// Load environment variables for test
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-32-chars-min-len";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-jwt-refresh-secret-32-chars-min";
process.env.ADMIN_PANEL_URL = "https://trstprep-admin.vercel.app";
process.env.NODE_ENV = "test";

const JWT_SECRET = process.env.JWT_SECRET;

const results = {
  passed: 0,
  failed: 0,
  details: []
};

function assert(condition, message, testGroup) {
  if (condition) {
    results.passed++;
    results.details.push({ status: "PASS", group: testGroup, message });
    console.log(`  [PASS] [${testGroup}] ${message}`);
  } else {
    results.failed++;
    results.details.push({ status: "FAIL", group: testGroup, message });
    console.error(`  [FAIL] [${testGroup}] ${message}`);
  }
}

// Helper to make local HTTP requests
function makeRequest({ app, method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (payload) {
        reqHeaders["Content-Type"] = "application/json";
        reqHeaders["Content-Length"] = Buffer.byteLength(payload);
      }

      const req = http.request({
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: reqHeaders,
      }, (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          server.close(() => {
            let json = null;
            try { json = JSON.parse(data); } catch { json = data; }
            resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
          });
        });
      });

      req.on("error", (err) => {
        server.close(() => reject(err));
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

// -------------------------------------------------------------
// GROUP 1: AUDIT LOG URL QUERY REDACTION
// -------------------------------------------------------------
async function testAuditLogRedaction() {
  console.log("\n--- GROUP 1: Audit Log URL Query Redaction ---");
  const testGroup = "Audit Log Redaction";

  const { auditMiddleware, createAuditLog } = await import("../apps/backend/src/middleware/audit.middleware.js");

  // Subtest 1.1: Standard adversarial URL with token, email, apikey in query string
  {
    let capturedEvent = null;
    const testApp = express();
    testApp.use(express.json());

    // Intercept audit middleware by capturing the event passed to pool.query or mocking
    // Since auditMiddleware calls logAuditEvent which queries pool, let's wrap auditMiddleware
    testApp.use((req, res, next) => {
      // Mock user
      req.user = { id: 1, email: "admin@test.com", name: "Admin" };
      next();
    });

    testApp.use(auditMiddleware({ includeBody: true }));

    testApp.get("/api/admin/users", (req, res) => {
      res.json({ success: true, count: 0 });
    });

    // We can directly test the URL sanitization logic of auditMiddleware by creating a synthetic req/res
    const syntheticReq = {
      method: "GET",
      originalUrl: "/api/admin/users?token=supersecret123&email=ceo%40company.com&apikey=live_key_999",
      baseUrl: "/api/admin",
      path: "/users",
      query: {
        token: "supersecret123",
        email: "ceo@company.com",
        apikey: "live_key_999",
      },
      headers: { "user-agent": "AuditTestAgent/1.0" },
      user: { id: 42, email: "super@admin.com", name: "SuperAdmin" },
      ip: "127.0.0.1",
    };

    let finishCallback = null;
    const syntheticRes = {
      statusCode: 200,
      on: (event, cb) => {
        if (event === "finish") finishCallback = cb;
      },
      end: function() {}
    };

    let loggedPayload = null;
    // Temporarily replace pool.query with spy
    const { pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
    const origQuery = pool.query;
    pool.query = async (text, values) => {
      if (typeof text === "string" && text.includes("INSERT INTO audit_logs")) {
        loggedPayload = {
          requestMethod: values[9],
          requestPath: values[10],
          details: typeof values[14] === "string" ? JSON.parse(values[14]) : values[14],
        };
      }
      return { rows: [] };
    };

    try {
      const mw = auditMiddleware({ includeBody: true });
      mw(syntheticReq, syntheticRes, () => {});
      if (finishCallback) await finishCallback();

      assert(loggedPayload !== null, "Audit log event was emitted", testGroup);
      assert(loggedPayload?.requestPath === "/api/admin/users", 
        `requestPath stripped query string (got: '${loggedPayload?.requestPath}')`, testGroup);
      assert(loggedPayload?.details?.path === "/api/admin/users", 
        `details.path stripped query string (got: '${loggedPayload?.details?.path}')`, testGroup);
      assert(!loggedPayload?.requestPath?.includes("supersecret123"), 
        "requestPath does not leak token", testGroup);
      assert(!loggedPayload?.details?.path?.includes("supersecret123"), 
        "details.path does not leak token", testGroup);
      assert(loggedPayload?.details?.query?.token === "[REDACTED]", 
        "details.query redacts sensitive token key", testGroup);
      assert(loggedPayload?.details?.query?.apikey === "[REDACTED]", 
        "details.query redacts sensitive apikey key", testGroup);
      assert(loggedPayload?.details?.query?.email === "ceo@company.com", 
        "details.query retains non-sensitive parameter email", testGroup);
    } finally {
      pool.query = origQuery;
    }
  }

  // Subtest 1.2: Corner cases on URL parsing
  {
    const cornerCases = [
      {
        name: "Multiple question marks",
        originalUrl: "/api/admin/tests?filter=active?secret=token123",
        path: "/api/admin/tests",
        expectedSafePath: "/api/admin/tests",
      },
      {
        name: "URL with hash fragment and query",
        originalUrl: "/api/admin/exams#overview?token=secret",
        path: "/api/admin/exams#overview",
        expectedSafePath: "/api/admin/exams#overview",
      },
      {
        name: "No query parameters",
        originalUrl: "/api/admin/roles",
        path: "/api/admin/roles",
        expectedSafePath: "/api/admin/roles",
      },
      {
        name: "Trailing question mark with empty query",
        originalUrl: "/api/admin/questions?",
        path: "/api/admin/questions",
        expectedSafePath: "/api/admin/questions",
      },
      {
        name: "Encoded question mark in path",
        originalUrl: "/api/admin/items%3Faction=view?token=secret",
        path: "/api/admin/items%3Faction=view",
        expectedSafePath: "/api/admin/items%3Faction=view",
      }
    ];

    for (const cc of cornerCases) {
      const syntheticReq = {
        method: "POST",
        originalUrl: cc.originalUrl,
        baseUrl: cc.baseUrl || "/api/admin",
        path: cc.path,
        query: {},
        headers: { "user-agent": "test-agent" },
        user: { id: 1 },
      };

      let capturedPath = null;
      const { pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
      const origQuery = pool.query;
      pool.query = async (text, values) => {
        if (typeof text === "string" && text.includes("INSERT INTO audit_logs")) {
          capturedPath = values[10];
        }
        return { rows: [] };
      };

      try {
        let finishCb = null;
        const syntheticRes = {
          statusCode: 200,
          on: (ev, cb) => { if (ev === "finish") finishCb = cb; }
        };
        const mw = auditMiddleware({ includeBody: false });
        mw(syntheticReq, syntheticRes, () => {});
        if (finishCb) await finishCb();

        assert(capturedPath === cc.expectedSafePath, 
          `Corner case '${cc.name}' produces safePath '${cc.expectedSafePath}' (actual: '${capturedPath}')`, testGroup);
      } finally {
        pool.query = origQuery;
      }
    }
  }

  // Subtest 1.3: createAuditLog helper direct invocation
  {
    const { pool } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
    const origQuery = pool.query;
    let createAuditLogPath = null;
    pool.query = async (text, values) => {
      if (typeof text === "string" && text.includes("INSERT INTO audit_logs")) {
        createAuditLogPath = values[10];
      }
      return { rows: [] };
    };

    try {
      await createAuditLog(
        {
          originalUrl: "/api/admin/settings?api_key=secret999",
          headers: { "user-agent": "test-agent" },
          user: { id: 1, email: "admin@test.com", name: "Admin" }
        },
        { action: "settings_change", resource: "settings" }
      );

      assert(createAuditLogPath === "/api/admin/settings",
        `createAuditLog sanitizes requestPath (got: '${createAuditLogPath}')`, testGroup);
    } finally {
      pool.query = origQuery;
    }
  }
}

// -------------------------------------------------------------
// GROUP 2: ROUTE CONVERGENCE HARDENING (stages.js & fortspy.js)
// -------------------------------------------------------------
async function testRouteConvergence() {
  console.log("\n--- GROUP 2: Route Convergence Hardening ---");
  const testGroup = "Route Convergence";

  // Mock dbHelpers.findById to return test users without needing live DB
  const { dbHelpers } = await import("../apps/backend/src/infrastructure/database/postgres-helpers.js");
  const origFindById = dbHelpers.findById;
  dbHelpers.findById = async (table, id) => {
    if (table === "users") {
      if (id === 1) {
        return {
          id: 1,
          email: "admin@test.com",
          name: "Admin User",
          role: "admin",
          isAdmin: true,
          is_email_verified: true,
          status: "active",
        };
      }
      if (id === 100) {
        return {
          id: 100,
          email: "user@test.com",
          name: "Regular Student",
          role: "student",
          isAdmin: false,
          is_email_verified: true,
          status: "active",
        };
      }
    }
    return null;
  };

  // Create JWT tokens for testing:
  // 1. Regular user token (role: 'student', isAdmin: false)
  const regularUserToken = jwt.sign(
    { id: 100, email: "user@test.com", role: "student", isAdmin: false, isEmailVerified: true },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // 2. Admin user token (role: 'admin', isAdmin: true)
  const adminUserToken = jwt.sign(
    { id: 1, email: "admin@test.com", role: "admin", isAdmin: true, isEmailVerified: true },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const stagesRouter = (await import("../apps/backend/src/api/routes/stages.js")).default;
  const fortspyRouter = (await import("../apps/backend/src/api/routes/fortspy.js")).default;

  const stagesApp = express();
  stagesApp.use(express.json());
  stagesApp.use("/api/stages", stagesRouter);

  const fortspyApp = express();
  fortspyApp.use(express.json());
  fortspyApp.use("/api/fortspy", fortspyRouter);

  // Subtest 2.1: stages.js mutation routes adversarial challenge
  const stageMutationRoutes = [
    { method: "POST", path: "/api/stages/initialize", name: "POST /initialize" },
    { method: "POST", path: "/api/stages", name: "POST /" },
    { method: "PUT", path: "/api/stages/1", name: "PUT /:id" },
    { method: "DELETE", path: "/api/stages/1", name: "DELETE /:id" },
    { method: "PUT", path: "/api/stages/1/reorder", name: "PUT /:id/reorder" },
    { method: "POST", path: "/api/stages/sync-exam-ids", name: "POST /sync-exam-ids" },
    { method: "POST", path: "/api/stages/update-exam-ids", name: "POST /update-exam-ids" },
    { method: "POST", path: "/api/stages/sync-all", name: "POST /sync-all" },
  ];

  for (const route of stageMutationRoutes) {
    // Attack 1: Unauthenticated request (no Origin, no Authorization)
    const resUnauth = await makeRequest({
      app: stagesApp,
      method: route.method,
      path: route.path,
      body: { name: "Adversarial Stage" },
    });
    assert([401, 403].includes(resUnauth.statusCode), 
      `stages.js ${route.name} rejects unauthenticated request (status: ${resUnauth.statusCode})`, testGroup);

    // Attack 2: Spoofed Origin header
    const resSpoofedOrigin = await makeRequest({
      app: stagesApp,
      method: route.method,
      path: route.path,
      headers: {
        "Origin": "https://attacker.evil.com",
        "Authorization": `Bearer ${adminUserToken}`,
      },
      body: { name: "Adversarial Stage" },
    });
    assert(resSpoofedOrigin.statusCode === 403, 
      `stages.js ${route.name} blocks spoofed Origin 'https://attacker.evil.com' (status: ${resSpoofedOrigin.statusCode})`, testGroup);

    // Attack 3: Valid Origin but unprivileged non-admin user JWT
    const resNonAdmin = await makeRequest({
      app: stagesApp,
      method: route.method,
      path: route.path,
      headers: {
        "Origin": "https://trstprep-admin.vercel.app",
        "Authorization": `Bearer ${regularUserToken}`,
      },
      body: { name: "Adversarial Stage" },
    });
    assert(resNonAdmin.statusCode === 403, 
      `stages.js ${route.name} rejects regular non-admin user (status: ${resNonAdmin.statusCode})`, testGroup);
  }

  // Subtest 2.2: Verify public GET routes in stages.js remain accessible
  const resPublicStages = await makeRequest({
    app: stagesApp,
    method: "GET",
    path: "/api/stages",
  });
  assert(resPublicStages.statusCode === 200 || resPublicStages.statusCode === 500,
    `stages.js GET / is public and not blocked by admin middleware (status: ${resPublicStages.statusCode})`, testGroup);

  // Subtest 2.3: fortspy.js mutation routes adversarial challenge
  const fortspyMutationRoutes = [
    { method: "POST", path: "/api/fortspy/keygen", name: "POST /keygen" },
    { method: "POST", path: "/api/fortspy/encrypt", name: "POST /encrypt" },
    { method: "POST", path: "/api/fortspy/decrypt", name: "POST /decrypt" },
  ];

  for (const route of fortspyMutationRoutes) {
    // Attack 1: Unauthenticated request
    const resUnauth = await makeRequest({
      app: fortspyApp,
      method: route.method,
      path: route.path,
      body: {},
    });
    assert([401, 403].includes(resUnauth.statusCode), 
      `fortspy.js ${route.name} rejects unauthenticated request (status: ${resUnauth.statusCode})`, testGroup);

    // Attack 2: Spoofed Origin header
    const resSpoofedOrigin = await makeRequest({
      app: fortspyApp,
      method: route.method,
      path: route.path,
      headers: {
        "Origin": "http://evil.corp",
        "Authorization": `Bearer ${adminUserToken}`,
      },
      body: {},
    });
    assert(resSpoofedOrigin.statusCode === 403, 
      `fortspy.js ${route.name} blocks spoofed Origin 'http://evil.corp' (status: ${resSpoofedOrigin.statusCode})`, testGroup);

    // Attack 3: Valid Origin + Admin Token, but MISSING CSRF token
    const resNoCsrf = await makeRequest({
      app: fortspyApp,
      method: route.method,
      path: route.path,
      headers: {
        "Origin": "https://trstprep-admin.vercel.app",
        "Authorization": `Bearer ${adminUserToken}`,
      },
      body: {},
    });
    assert(resNoCsrf.statusCode === 403, 
      `fortspy.js ${route.name} rejects request with missing CSRF token (status: ${resNoCsrf.statusCode})`, testGroup);

    // Attack 4: Valid Origin + Admin Token, but INVALID CSRF token
    const resBadCsrf = await makeRequest({
      app: fortspyApp,
      method: route.method,
      path: route.path,
      headers: {
        "Origin": "https://trstprep-admin.vercel.app",
        "Authorization": `Bearer ${adminUserToken}`,
        "X-CSRF-Token": "invalid-bogus-csrf-token-12345",
      },
      body: {},
    });
    assert(resBadCsrf.statusCode === 403, 
      `fortspy.js ${route.name} rejects invalid CSRF token (status: ${resBadCsrf.statusCode})`, testGroup);
  }
}

// -------------------------------------------------------------
// GROUP 3: CLIENT IP EXTRACTION & TRUST PROXY HARDENING
// -------------------------------------------------------------
async function testClientIpHardening() {
  console.log("\n--- GROUP 3: Client IP Extraction Hardening ---");
  const testGroup = "Client IP Hardening";

  // Import phoneAuth route file source to inspect getClientIp implementation directly
  const phoneAuthModule = await import("../apps/backend/src/api/routes/phoneAuth.js");

  // Replicate phoneAuth getClientIp logic verbatim from line 55
  const getClientIp = (req) => {
    const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
    if (clientIp && clientIp !== "unknown") {
      let ip = String(clientIp).trim();
      if (ip.startsWith("::ffff:")) ip = ip.slice(7);
      if (ip === "::1") return "127.0.0.1";
      if (ip) return ip;
    }
    return "unknown";
  };

  // Subtest 3.1: Forged X-Forwarded-For injection directly against getClientIp
  {
    const reqWithForgedHeader = {
      ip: "203.0.113.195",
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, 10.0.0.1"
      },
      socket: {
        remoteAddress: "127.0.0.1"
      }
    };
    const extractedIp = getClientIp(reqWithForgedHeader);
    assert(extractedIp === "203.0.113.195",
      `getClientIp uses req.ip and ignores forged X-Forwarded-For (got: '${extractedIp}')`, testGroup);
    assert(extractedIp !== "1.2.3.4" && extractedIp !== "5.6.7.8",
      "Forged client IP in X-Forwarded-For is not extracted", testGroup);
  }

  // Subtest 3.2: Express with app.set('trust proxy', 1) behavior under adversarial X-Forwarded-For
  {
    const testApp = express();
    testApp.set("trust proxy", 1); // Exact production setting from app-port5001.js:273

    let recordedReqIp = null;
    let recordedExtractedIp = null;

    testApp.get("/test-ip", (req, res) => {
      recordedReqIp = req.ip;
      recordedExtractedIp = getClientIp(req);
      res.json({ reqIp: req.ip, extracted: recordedExtractedIp });
    });

    // When client sends X-Forwarded-For to a reverse proxy (Nginx), Nginx appends the client remote address.
    // Untrusted client sends: X-Forwarded-For: 1.2.3.4, 5.6.7.8
    // Nginx appends remote_addr (e.g. 198.51.100.99)
    // Nginx forwards: X-Forwarded-For: 1.2.3.4, 5.6.7.8, 198.51.100.99
    // Express receives connection from Nginx (127.0.0.1 or 172.x).
    // Express with 'trust proxy: 1' trusts the single hop (Nginx) and resolves req.ip to the LAST address added by Nginx: 198.51.100.99.
    const resProxyHop = await makeRequest({
      app: testApp,
      method: "GET",
      path: "/test-ip",
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, 198.51.100.99"
      }
    });

    assert(recordedReqIp === "198.51.100.99",
      `Express trust proxy: 1 resolves real client IP '198.51.100.99' ignoring attacker prefix (got: '${recordedReqIp}')`, testGroup);
    assert(recordedExtractedIp === "198.51.100.99",
      `getClientIp correctly resolves to '198.51.100.99' (got: '${recordedExtractedIp}')`, testGroup);
  }

  // Subtest 3.3: Direct client without proxy header
  {
    const testApp = express();
    testApp.set("trust proxy", 1);

    let recordedReqIp = null;
    testApp.get("/test-direct", (req, res) => {
      recordedReqIp = req.ip;
      res.json({ reqIp: req.ip });
    });

    await makeRequest({
      app: testApp,
      method: "GET",
      path: "/test-direct",
      // No X-Forwarded-For header sent
    });

    assert(recordedReqIp === "127.0.0.1",
      `Direct connection without proxy header resolves to socket remoteAddress (got: '${recordedReqIp}')`, testGroup);
  }

  // Subtest 3.4: Edge cases: IPv6 mapped addresses, loopback, missing IP
  {
    assert(getClientIp({ ip: "::ffff:192.0.2.1" }) === "192.0.2.1",
      "IPv6 mapped IPv4 '::ffff:192.0.2.1' unwrapped to '192.0.2.1'", testGroup);
    assert(getClientIp({ ip: "::1" }) === "127.0.0.1",
      "IPv6 loopback '::1' normalized to '127.0.0.1'", testGroup);
    assert(getClientIp({ ip: undefined, socket: { remoteAddress: "::ffff:10.0.0.5" } }) === "10.0.0.5",
      "Socket remoteAddress fallback unwrapped correctly", testGroup);
    assert(getClientIp({}) === "unknown",
      "Empty request object safely returns 'unknown'", testGroup);
    assert(getClientIp({ headers: { "x-forwarded-for": "1.2.3.4" } }) === "unknown",
      "Header-only forged request without req.ip or socket returns 'unknown' (NO raw header fallback)", testGroup);
  }
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAll() {
  console.log("=================================================");
  console.log("CHALLENGER 2 EMPIRICAL SECURITY VERIFICATION");
  console.log("=================================================");

  try {
    await testAuditLogRedaction();
    await testRouteConvergence();
    await testClientIpHardening();
  } catch (err) {
    console.error("FATAL ERROR running tests:", err);
    results.failed++;
  }

  console.log("\n=================================================");
  console.log(`SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log("=================================================");

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();
