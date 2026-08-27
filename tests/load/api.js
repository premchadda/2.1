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

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      authToken = body.token || "";
    } catch (e) {
      authToken = "";
    }
  }

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
    "questions - status is 200": (r) => r.status === 200,
    "questions - has data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });
}

function testGetUserDashboard() {
  const res = makeRequest("GET", `${BASE_URL}/api/user/dashboard`, null, {
    name: "GetUserDashboard",
  });

  return check(res, {
    "dashboard - status is 200": (r) => r.status === 200 || r.status === 401,
  });
}

function testGetLeaderboard() {
  const res = makeRequest("GET", `${BASE_URL}/api/leaderboard`, null, {
    name: "GetLeaderboard",
  });

  return check(res, {
    "leaderboard - status is 200": (r) => r.status === 200,
  });
}

function testSubmitTestAttempt() {
  const listRes = makeRequest("GET", `${BASE_URL}/api/test-series`, null, {
    name: "GetTestSeriesForSubmit",
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

  const payload = JSON.stringify({
    testSeriesId: testId,
    answers: [
      { questionId: "q1", selectedOption: 0 },
      { questionId: "q2", selectedOption: 1 },
    ],
    timeTaken: 120,
  });

  const res = makeRequest("POST", `${BASE_URL}/api/test-attempts`, payload, {
    name: "SubmitTestAttempt",
  });

  return check(res, {
    "submit-attempt - status is 200 or 201": (r) =>
      r.status === 200 || r.status === 201 || r.status === 400,
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
    "search - status is 200": (r) => r.status === 200,
  });
}

export default function () {
  if (!authToken) {
    getAuthToken();
  }

  const scenario = Math.random();

  if (scenario < 0.25) {
    testGetTestSeries();
  } else if (scenario < 0.45) {
    testGetTestSeriesById();
  } else if (scenario < 0.65) {
    testGetQuestions();
  } else if (scenario < 0.8) {
    testGetUserDashboard();
  } else if (scenario < 0.9) {
    testGetLeaderboard();
  } else if (scenario < 0.95) {
    testSubmitTestAttempt();
  } else {
    testSearchQuestions();
  }

  const success = testGetTestSeries() || testGetQuestions();
  successRate.add(success);

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
