const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const config = {
  baseUrl: BASE_URL,

  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Sustain 100 users for 5 minutes
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],

  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
    http_reqs: ['rate>50'],            // At least 50 requests per second throughput
  },

  options: {
    noConnectionReuse: false,
    userAgent: 'TrstprepLoadTest/1.0',
    insecureSkipTLSVerify: true,
    batchPerHost: 6,
    httpDebug: __ENV.HTTP_DEBUG || '',
  },

  defaults: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '10s',
  },
};
