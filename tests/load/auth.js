import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { config } from './k6.config.js';

const BASE_URL = config.baseUrl;

const loginSuccessRate = new Rate('login_success_rate');
const registerSuccessRate = new Rate('register_success_rate');
const loginDuration = new Trend('login_duration', true);
const registerDuration = new Trend('register_duration', true);

export const options = {
  stages: config.stages,
  thresholds: {
    ...config.thresholds,
    login_success_rate: ['rate>0.99'],
    register_success_rate: ['rate>0.99'],
    login_duration: ['p(95)<500'],
    register_duration: ['p(95)<800'],
  },
};

const TEST_USER = {
  email: `loadtest_${Date.now()}@example.com`,
  password: 'LoadTest123!',
  name: 'Load Test User',
};

function register() {
  const payload = JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
    name: TEST_USER.name,
  });

  const res = http.post(`${BASE_URL}/api/auth/register`, payload, {
    headers: config.defaults.headers,
    tags: { name: 'Register' },
  });

  const success = check(res, {
    'register - status is 201': (r) => r.status === 201,
    'register - has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  registerSuccessRate.add(success);
  registerDuration.add(res.timings.duration);
  return res;
}

function login(email, password) {
  const payload = JSON.stringify({
    email: email || TEST_USER.email,
    password: password || TEST_USER.password,
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: config.defaults.headers,
    tags: { name: 'Login' },
  });

  const success = check(res, {
    'login - status is 200': (r) => r.status === 200,
    'login - has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  loginSuccessRate.add(success);
  loginDuration.add(res.timings.duration);
  return res;
}

function refreshToken(token) {
  const res = http.post(`${BASE_URL}/api/auth/refresh`, null, {
    headers: {
      ...config.defaults.headers,
      Authorization: `Bearer ${token}`,
    },
    tags: { name: 'RefreshToken' },
  });

  check(res, {
    'refresh - status is 200': (r) => r.status === 200,
  });

  return res;
}

export default function () {
  const scenario = Math.random();

  if (scenario < 0.5) {
    login();
  } else if (scenario < 0.75) {
    register();
  } else {
    const loginRes = login();
    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        if (body.token) {
          refreshToken(body.token);
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/summary-auth.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  let summary = '\n';

  summary += `${indent}========================================\n`;
  summary += `${indent}  Auth Load Test Summary\n`;
  summary += `${indent}========================================\n`;
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}  Failed Requests: ${data.metrics.http_req_failed?.values?.rate || 0}\n`;
  summary += `${indent}  Avg Response Time: ${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms\n`;
  summary += `${indent}  P95 Response Time: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `${indent}  Login Success Rate: ${(data.metrics.login_success_rate?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}  Register Success Rate: ${(data.metrics.register_success_rate?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}========================================\n`;

  return summary;
}
