# Load Testing Suite - Trstprep V2.1

Load testing framework using [Grafana k6](https://k6.io/) for performance testing of the Trstprep platform.

## Prerequisites

1. **Install k6** (choose one):

   **Windows (Chocolatey):**
   ```bash
   choco install k6
   ```

   **Windows (Scoop):**
   ```bash
   scoop install k6
   ```

   **macOS (Homebrew):**
   ```bash
   brew install k6
   ```

   **Linux (Debian/Ubuntu):**
   ```bash
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

   **Docker:**
   ```bash
   docker pull grafana/k6
   ```

2. **Ensure the backend is running** on `http://localhost:3000` (or set `BASE_URL` env var).

## Test Files

| File | Description |
|------|-------------|
| `auth.js` | Tests login, register, and token refresh endpoints |
| `api.js` | Tests main API endpoints (test series, questions, dashboard, etc.) |
| `realtime.js` | Tests WebSocket connections and real-time messaging |
| `k6.config.js` | Shared configuration (stages, thresholds, base URL) |

## Running Tests

### From project root (npm scripts):

```bash
# Run all load tests
npm run load-test

# Run auth-specific tests only
npm run load-test:auth

# Run API-specific tests only
npm run load-test:api
```

### Directly with k6:

```bash
# Run specific test
k6 run tests/load/auth.js
k6 run tests/load/api.js
k6 run tests/load/realtime.js

# With custom base URL
k6 run --env BASE_URL=https://api.trstprep.com tests/load/api.js

# With custom test credentials
k6 run --env TEST_EMAIL=user@example.com --env TEST_PASSWORD=pass123 tests/load/api.js

# With detailed HTTP debug output
k6 run --env HTTP_DEBUG=true tests/load/api.js
```

### Docker:

```bash
docker run --rm -i grafana/k6 run - < tests/load/api.js
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Backend API base URL |
| `TEST_EMAIL` | `admin@trstprep.com` | Test user email for authenticated endpoints |
| `TEST_PASSWORD` | `admin123` | Test user password |
| `HTTP_DEBUG` | (empty) | Set to `true` for verbose HTTP logging |

### Load Stages

Default load pattern in `k6.config.js`:

```
1 min  → 10 users   (ramp up)
2 min  → 50 users   (ramp up)
2 min  → 100 users  (ramp up)
5 min  → 100 users  (sustain)
1 min  → 0 users    (ramp down)
Total: ~11 minutes
```

### Thresholds

- **Response Time**: p95 < 500ms
- **Error Rate**: < 1%
- **Throughput**: > 50 requests/sec
- **Login Success Rate**: > 99%
- **WebSocket Success Rate**: > 95%

## Interpreting Results

### Key Metrics

- **http_req_duration**: Response time (avg, med, p90, p95, p99)
- **http_req_failed**: Percentage of failed requests
- **http_reqs**: Total requests and requests per second
- **iter_duration**: Time per full iteration

### Output Files

Test summaries are saved to:
- `tests/load/summary-auth.json`
- `tests/load/summary-api.json`
- `tests/load/summary-realtime.json`

### Pass/Fail Criteria

Tests pass when:
- p95 response time < 500ms
- Error rate < 1%
- Success rates meet individual thresholds

## Troubleshooting

**Connection refused**: Ensure the backend server is running.

**High error rates**: Check server logs, database connections, and resource limits.

**Timeout issues**: Increase the timeout in `k6.config.js` or check network latency.

**Memory issues**: Reduce the number of virtual users or test duration.
