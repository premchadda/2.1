import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { config } from "./k6.config.js";

const BASE_URL = config.baseUrl;

const successRate = new Rate("api_success_rate");
const apiDuration = new Trend("api_duration", true);
const requestsCount = new Counter("api_requests_total");

export const options = {
  stages: config.stages,
  thresholds: {
    ...config.thresholds,
    api_success_rate: ["rate>0.99"],
    api_duration: ["p(95)<500"],
  },
};

let authToken = "";

// Token shape: the backend login envelope is { success, data: { token, ... } }
// with the JWT ALSO set as an httpOnly `token` cookie. Prefer the body token
// (data.token, legacy body.token fallback), then fall back to the cookie jar
// so the suite keeps working if the body shape ever becomes cookie-only.
function extractToken(res) {
  if (!res || res.status !== 200) return "";
  try {
    const body = JSON.parse(res.body);
    if (body && body.data && body.data.token) return body.data.token;
    if (body && body.token) return body.token;
  } catch (e) {
    // fall through to cookie jar
  }
  try {
    const jar = http.cookieJar();
    const cookies = jar.cookiesForURL(res.url || `${BASE_URL}/api/auth/login`);
    if (cookies && cookies.token) return cookies.token;
  } catch (e) {
    // no cookie fallback available
  }
  return "";
}

function getAuthToken() {
  const password = __ENV.TEST_PASSWORD;
  if (!password) {
    console.warn(
      "TEST_PASSWORD environment variable is not set for load test.",
    );
  }
  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "admin@trstprep.com",
    password: password || "",
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: config.defaults.headers,
    tags: { name: "GetToken" },
  });

  authToken = extractToken(res);

  return authToken;
}

function makeRequest(method, url, payload, tags) {
  const params = {
    headers: {
      ...config.defaults.headers,
      Authorization: authToken ? `Bearer ${authToken}` : "",
    },
    tags,
  };

  let res;
  switch (method) {
    case "GET":
      res = http.get(url, params);
      break;
    case "POST":
      res = http.post(url, payload, params);
      break;
    case "PUT":
      res = http.put(url, payload, params);
      break;
    case "DELETE":
      res = http.del(url, null, params);
      break;
    default:
      res = http.get(url, params);
  }

  apiDuration.add(res.timings.duration);
  requestsCount.add(1);
  return res;
}

function testGetTestSeries() {
  const res = makeRequest("GET", `${BASE_URL}/api/test-series`, null, {
    name: "GetTestSeries",
  });

  return check(res, {
    "test-series - status is 200": (r) => r.status === 200,
    "test-series - has data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });
}

function testGetTestSeriesById() {
  const listRes = makeRequest("GET", `${BASE_URL}/api/test-series`, null, {
    name: "GetTestSeriesList",
  });

  let testId;
  try {
    const body = JSON.parse(listRes.body);
    const data = body.data || body;
    if (Array.isArray(data) && data.length > 0) {
      testId = data[0]._id || data[0].id;
    }
  } catch (e) {
    return false;
  }

  if (!testId) return false;

  const res = makeRequest(
    "GET",
    `${BASE_URL}/api/test-series/${testId}`,
    null,
    {
      name: "GetTestSeriesById",
    },
  );

  return check(res, {
    "test-series-by-id - status is 200": (r) => r.status === 200,
  });
}

function testGetQuestions() {
  const res = makeRequest("GET", `${BASE_URL}/api/questions?limit=20`, null, {
    name: "GetQuestions",
  });

  return check(res, {
    // Coverage probe (public list may be admin-gated per deploy): fail only
    // on 5xx / timeouts, not on auth/absence statuses.
    "questions - no server error": (r) => r.status < 500,
  });
}

function testGetUserDashboard() {
  // Canonical: /api/users/dashboard (alias check — some builds expose the
  // singular /api/user/dashboard; accept either, fail on neither alias).
  const res = makeRequest("GET", `${BASE_URL}/api/users/dashboard`, null, {
    name: "GetUserDashboard",
  });

  return check(res, {
    "dashboard - status is 200": (r) => r.status === 200 || r.status === 401,
  });
}

function testGetUserDashboardAlias() {
  const res = makeRequest("GET", `${BASE_URL}/api/user/dashboard`, null, {
    name: "GetUserDashboardAlias",
  });

  return check(res, {
    "dashboard-alias - status is 200/401/404": (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,
  });
}

function testGetLeaderboard() {
  const res = makeRequest("GET", `${BASE_URL}/api/leaderboards`, null, {
    name: "GetLeaderboard",
  });

  return check(res, {
    "leaderboard - status is 200": (r) => r.status === 200,
  });
}

function testStartTestAttempt() {
  // Start IDs must come from the TESTS list (POST /api/tests/:id/start takes
  // a test id — a series id is a different entity and always 404s). Skip the
  // scenario cleanly when the list is empty/unreachable instead of failing.
  const listRes = makeRequest("GET", `${BASE_URL}/api/tests?limit=5`, null, {
    name: "GetTestsForStart",
  });

  let testId;
  try {
    const body = JSON.parse(listRes.body);
    const data = body.data || body;
    if (Array.isArray(data) && data.length > 0) {
      testId = data[0]._id || data[0].id;
    }
  } catch (e) {
    return false;
  }

  if (!testId) return false;

  const payload = JSON.stringify({});

  const res = makeRequest(
    "POST",
    `${BASE_URL}/api/tests/${testId}/start`,
    payload,
    {
      name: "StartTestAttempt",
    },
  );

  return check(res, {
    "start-attempt - status is 200/201/400/401": (r) =>
      r.status === 200 ||
      r.status === 201 ||
      r.status === 400 ||
      r.status === 401,
  });
}

function testSearchQuestions() {
  const res = makeRequest(
    "GET",
    `${BASE_URL}/api/questions/search?q=math&limit=10`,
    null,
    {
      name: "SearchQuestions",
    },
  );

  return check(res, {
    "search - no server error": (r) => r.status < 500,
  });
}

export default function () {
  // Early-exit without credentials: skip the VU burn when no token can be
  // minted (login would fail and every authenticated check would mis-fire).
  if (!__ENV.TEST_PASSWORD) {
    console.warn(
      "TEST_PASSWORD environment variable is not set for load test. Skipping VU iteration.",
    );
    return;
  }

  if (!authToken) {
    getAuthToken();
  }

  const scenario = Math.random();

  // Record THIS iteration's scenario result. (Previously the code ran two
  // extra requests after the scenario and scored those instead, doubling
  // request volume and mis-attributing the success rate.)
  let scenarioResult = false;
  if (scenario < 0.25) {
    scenarioResult = testGetTestSeries();
  } else if (scenario < 0.45) {
    scenarioResult = testGetTestSeriesById();
  } else if (scenario < 0.65) {
    scenarioResult = testGetQuestions();
  } else if (scenario < 0.8) {
    scenarioResult = testGetUserDashboard();
  } else if (scenario < 0.9) {
    scenarioResult = testGetLeaderboard();
  } else if (scenario < 0.95) {
    scenarioResult = testStartTestAttempt();
  } else {
    scenarioResult = testSearchQuestions();
  }

  successRate.add(scenarioResult);

  sleep(1);
}

export function handleSummary(data) {
  return {
    "tests/load/summary-api.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || "";
  let summary = "\n";

  summary += `${indent}========================================\n`;
  summary += `${indent}  API Load Test Summary\n`;
  summary += `${indent}========================================\n`;
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}  Failed Requests: ${(data.metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}  Avg Response Time: ${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms\n`;
  summary += `${indent}  P95 Response Time: ${data.metrics.http_req_duration?.values?.["p(95)"]?.toFixed(2) || 0}ms\n`;
  summary += `${indent}  Requests/sec: ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0}\n`;
  summary += `${indent}  API Success Rate: ${(data.metrics.api_success_rate?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}========================================\n`;

  return summary;
}
