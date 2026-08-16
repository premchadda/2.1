import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const TARGET_URL = "http://localhost:5001";
const CONCURRENT_USERS = 50;
const EVENTS_PER_USER = 20; // 50 * 20 = 1000 total events
const TOTAL_REQUESTS = CONCURRENT_USERS * EVENTS_PER_USER;

async function runLoadTest() {
  console.log("=========================================");
  console.log("🚀 TRSTPREP TELEMETRY STRESS TEST (1000 EVENTS)");
  console.log("=========================================");
  console.log(`Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`Events per user:  ${EVENTS_PER_USER}`);
  console.log(`Total payload:    ${TOTAL_REQUESTS} requests\n`);

  // 1. Prepare database records
  let userId, testId, attemptId, publicAttemptId;

  try {
    // A. Get or create test user
    let userRes = await pool.query("SELECT id FROM users WHERE email = $1", ["telemetry-load-tester@trstprep.com"]);
    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
    } else {
      const insertUser = await pool.query(
        "INSERT INTO users (name, email, password, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        ["Telemetry Load Tester", "telemetry-load-tester@trstprep.com", "$2b$10$dummyhash", "user", true]
      );
      userId = insertUser.rows[0].id;
    }

    // B. Get or create test
    let testRes = await pool.query("SELECT id FROM tests LIMIT 1");
    if (testRes.rows.length > 0) {
      testId = testRes.rows[0].id;
    } else {
      const insertTest = await pool.query(
        "INSERT INTO tests (title, duration, is_active) VALUES ($1, $2, $3) RETURNING id",
        ["Load Test Dummy Test", 60, true]
      );
      testId = insertTest.rows[0].id;
    }

    const attemptRes = await pool.query(
      `INSERT INTO attempts (user_id, test_id, is_completed, status, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, public_id`,
      [userId, testId, false, "IN_PROGRESS"]
    );
    attemptId = attemptRes.rows[0].id;
    publicAttemptId = attemptRes.rows[0].public_id;

    console.log(`Setup complete: User ID ${userId}, Test ID ${testId}, Attempt ID ${attemptId} (${publicAttemptId})`);
  } catch (dbErr) {
    console.error("❌ Database setup failed:", dbErr.message);
    await pool.end();
    process.exit(1);
  }

  // 2. Generate Auth Token
  const token = jwt.sign(
    { id: userId, role: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // 3. Bootstrap CSRF token
  let csrfToken = "";
  try {
    const bootstrapRes = await fetch(`${TARGET_URL}/api/tests`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-Load-Test": "true"
      }
    });
    csrfToken = bootstrapRes.headers.get("x-csrf-token") || "";
    if (!csrfToken) {
      console.warn("⚠️ CSRF token not returned in header, trying to continue...");
    } else {
      console.log(`Bootstrapped CSRF token: ${csrfToken.slice(0, 10)}...`);
    }
  } catch (err) {
    console.error("❌ Failed to contact backend. Is it running on port 5001?");
    console.error("Error details:", err.message);
    await cleanup(attemptId, userId);
    process.exit(1);
  }

  // 4. Run Concurrent Requests
  const latencies = [];
  let successes = 0;
  let failures = 0;

  const startTestTime = Date.now();

  const runUserTask = async (workerId) => {
    let localCsrf = csrfToken;
    for (let i = 0; i < EVENTS_PER_USER; i++) {
      const eventUuid = crypto.randomUUID();
      const payload = {
        events: [
          {
            id: eventUuid,
            eventType: "tab_switch",
            metadata: { workerId, step: i },
            clientTime: new Date().toISOString(),
            severity: "low",
            timeLeft: 1800
          }
        ]
      };

      const start = Date.now();
      try {
        const response = await fetch(`${TARGET_URL}/api/attempt/${publicAttemptId}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "X-CSRF-Token": localCsrf,
            "X-Load-Test": "true"
          },
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        const duration = Date.now() - start;
        latencies.push(duration);

        if (response.ok) {
          successes++;
          // CSRF token rotation: update token for next request
          const nextCsrf = response.headers.get("x-csrf-token");
          if (nextCsrf) localCsrf = nextCsrf;
        } else {
          failures++;
          console.error(`Worker ${workerId} step ${i} failed [${response.status}]: ${text}`);
        }
      } catch (reqErr) {
        failures++;
        latencies.push(Date.now() - start);
        console.error(`Worker ${workerId} step ${i} error:`, reqErr.message);
      }
    }
  };

  const workers = [];
  for (let w = 0; w < CONCURRENT_USERS; w++) {
    workers.push(runUserTask(w));
  }

  await Promise.all(workers);
  const totalDuration = Date.now() - startTestTime;

  // 5. Query DB to verify event counts
  let dbEventCount = 0;
  try {
    const countRes = await pool.query(
      "SELECT COUNT(*)::int FROM attempt_events WHERE attempt_id = $1",
      [attemptId]
    );
    dbEventCount = countRes.rows[0].count;
  } catch (countErr) {
    console.error("❌ Failed to query database event count:", countErr.message);
  }

  // 6. Clean up
  await cleanup(attemptId, userId);
  await pool.end();

  // 7. Calculate stats
  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = sum / latencies.length || 0;
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const throughput = (successes / (totalDuration / 1000)).toFixed(2);

  // 8. Print Results Table
  console.log("\n=========================================");
  console.log("📊 LOAD TEST RESULTS SUMMARY");
  console.log("=========================================");
  console.table({
    "Total Requests Sent": TOTAL_REQUESTS,
    "Successes (HTTP 2xx)": successes,
    "Failures": failures,
    "Events Verified in DB": dbEventCount,
    "Total Time (ms)": totalDuration,
    "Throughput (req/sec)": throughput,
    "Average Latency (ms)": avg.toFixed(1),
    "p50 Latency (ms)": p50,
    "p95 Latency (ms)": p95,
    "p99 Latency (ms)": p99
  });
  console.log("=========================================");

  if (dbEventCount === TOTAL_REQUESTS && failures === 0) {
    console.log("🎉 SUCCESS: Telemetry pipeline withstood 1000 concurrent events without data loss.");
    process.exit(0);
  } else {
    console.error("❌ FAILURE: Data loss or request failures detected.");
    process.exit(1);
  }
}

async function cleanup(attemptId, userId) {
  try {
    if (attemptId) {
      await pool.query("DELETE FROM attempt_events WHERE attempt_id = $1", [attemptId]);
      await pool.query("DELETE FROM attempts WHERE id = $1", [attemptId]);
    }
    console.log("Cleanup complete.");
  } catch (cleanErr) {
    console.error("⚠️ Cleanup warning:", cleanErr.message);
  }
}

runLoadTest().catch(err => {
  console.error("Fatal error in load test runner:", err);
  process.exit(1);
});
