# OmniVote k6 Load Tests

Performance and reliability test suite for the OmniVote election monitoring API.

## Prerequisites

[k6](https://k6.io/docs/getting-started/installation/) must be installed:

```bash
# macOS (Homebrew)
brew install k6

# Linux (APT)
sudo apt-get install k6

# Linux (with APT repository)
sudo gpg -no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Or download binary directly from https://github.com/grafana/k6/releases
```

## Quick Start

Make sure the dev server is running on port 3000:

```bash
npm run dev
```

Then run tests from another terminal:

```bash
# Quick smoke test (1 VU, 1 iteration - ~3 seconds)
npm run test:load:smoke

# Steady-state load (50 VUs, ~3 minutes)
npm run test:load

# Election-day spike (up to 200 VUs, ~6 minutes)
npm run test:load:spike

# Stress test (up to 500 VUs, ~11 minutes)
npm run test:load:stress

# Auth-focused test (20 VUs, 2 minutes)
npm run test:load:auth
```

## Test Scripts

| Script | Purpose | VUs | Duration | Description |
|--------|---------|-----|----------|-------------|
| `smoke.js` | Smoke test | 1 | ~3s | Verifies all endpoints respond correctly |
| `load.js` | Steady-state | 50 | ~3m | Normal traffic simulation with 60/30/10 split |
| `spike.js` | Election day | 20-200 | ~6m | Traffic surge simulation |
| `stress.js` | Stress test | 100-500 | ~11m | Find the breaking point |
| `auth.js` | Auth security | 20 | 2m | Brute force and rate limiting test |

## Custom Metrics

Each script defines custom k6 metrics beyond the built-ins:

- **load.js**: `public_read_success`, `protected_read_handled`, `write_success`, per-type latency trends
- **spike.js**: `spike_read_success`, `spike_login_attempt`, `spike_incident_submit`, `spike_incidents_submitted`
- **stress.js**: `stress_request_success`, `stress_5xx_rate`, `stress_request_duration`, `stress_total_requests`
- **auth.js**: `auth_success`, `auth_401`, `auth_429`, `auth_5xx`, `auth_lockouts`, `auth_total_attempts`

## Configuration

### Base URL

Override the target URL with an environment variable:

```bash
K6_BASE_URL=http://staging.example.com k6 run load-tests/smoke.js
```

### Thresholds

Thresholds are defined in `config.js` and can be adjusted there:

- **Smoke**: p(95) < 500ms, error rate < 1%
- **Load**: p(95) < 500ms, error rate < 5%
- **Spike**: p(95) < 1s, p(99) < 3s, error rate < 10%
- **Stress**: p(95) < 2s, error rate < 20%
- **Auth**: p(95) < 2.5s, error rate < 5%

### Output Formats

```bash
# JSON output for CI integration
k6 run --out json=results.json load-tests/load.js

# InfluxDB for Grafana dashboards
k6 run --out influxdb=http://localhost:8086/k6 load-tests/load.js

# Summary only (no per-request output)
k6 run --summary-export=summary.json load-tests/load.js
```

## Important Notes

- Scripts work without a running server (they get connection errors, which is expected)
- Protected endpoints (dashboard, agents, incidents, etc.) return 401 without authentication - this is intentional for load testing the middleware
- The auth endpoint has a deliberate 500-2000ms random delay on failed logins (anti-timing attack measure)
- The auth test specifically targets a small email pool (10 addresses) to trigger rate limiting and lockouts
- All POST bodies use JSON with `Content-Type: application/json` header
