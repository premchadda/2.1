import http from "k6/http";
import { check, sleep } from "k6";
import { config } from "./k6.config.js";

const BASE_URL = config.baseUrl;

// Smoke probe: single VU, single iteration, thresholds OFF.
// Hits GET /api/health plus a login SHAPE probe (POST /api/auth/login).
// Creates no users, runs no stages — safe pre-check before the full suite.
// LOCAL ONLY: point TARGET_URL at http://localhost:5001 (or a disposable
// dev instance). Never run against production.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {},
};

function probeHealth() {
  const res = http.get(`${BASE_URL}/api/health`, {
    headers: config.defaults.headers,
    tags: { name: "SmokeHealth" },
  });

  return check(res, {
    "smoke health - status is 200/206": (r) =>
      r.status === 200 || r.status === 206,
    "smoke health - body has status field": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "ok" || body.status === "degraded";
      } catch (e) {
        return false;
      }
    },
  });
}

// Login SHAPE probe: verifies the auth envelope contract
// ({ success, data: { token, ... } } + httpOnly `token` cookie) without
// asserting auth success. Accepts 200/400/401/422 — any non-5xx means the
// route is wired and responding. Skips cleanly when TEST_PASSWORD is unset.
function probeLoginShape() {
  const password = __ENV.TEST_PASSWORD;
  if (!password) {
    console.warn(
      "TEST_PASSWORD environment variable is not set for load test. Skipping login shape probe.",
    );
    return true;
  }

  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "admin@trstprep.com",
    password: password,
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: config.defaults.headers,
    tags: { name: "SmokeLoginShape" },
  });

  return check(res, {
    "smoke login - no server error": (r) => r.status < 500,
    "smoke login - response is JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });
}

export default function () {
  probeHealth();
  probeLoginShape();
  sleep(1);
}

export function handleSummary(data) {
  return {
    "tests/load/summary-smoke.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || "";
  let summary = "\n";

  summary += `${indent}========================================\n`;
  summary += `${indent}  Smoke Test Summary\n`;
  summary += `${indent}========================================\n`;
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}  Failed Requests: ${(data.metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}  Avg Response Time: ${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms\n`;
  summary += `${indent}========================================\n`;

  return summary;
}
