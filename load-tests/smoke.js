// ─── OmniVote Smoke Test ──────────────────────────────────────────────────
//
// Minimal load verification — 1 VU, 1 iteration.
// Confirms all critical endpoints respond correctly.
//
// Run:  k6 run load-tests/smoke.js
//

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, THRESHOLDS } from './config.js';

// ─── Test Options ───────────────────────────────────────────────────────────
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: THRESHOLDS.smoke,
};

// ─── Main Test Function ─────────────────────────────────────────────────────
export default function () {
  // 1. Health check — should always be 200 with expected shape
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health_check' },
  });
  check(healthRes, {
    'GET /api/health status 200': (r) => r.status === 200,
    'GET /api/health has status field': (r) => {
      try { const body = r.json(); return 'status' in body; } catch { return false; }
    },
    'GET /api/health has version': (r) => {
      try { const body = r.json(); return 'version' in body; } catch { return false; }
    },
    'GET /api/health has database check': (r) => {
      try { const body = r.json(); return 'database' in body; } catch { return false; }
    },
  });

  sleep(0.3);

  // 2. Auth (GET) — returns tenant list for unauthenticated users
  const authGetRes = http.get(`${BASE_URL}/api/auth`, {
    tags: { name: 'auth_tenants' },
  });
  check(authGetRes, {
    'GET /api/auth status 200': (r) => r.status === 200,
    'GET /api/auth has tenants array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.tenants);
      } catch { return false; }
    },
  });

  sleep(0.3);

  // 3. Auth (POST) — invalid credentials should return 401
  const authPostRes = http.post(
    `${BASE_URL}/api/auth`,
    JSON.stringify({ email: 'nonexistent@test.com', password: 'wrongpassword' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login_invalid' } },
  );
  check(authPostRes, {
    'POST /api/auth invalid creds → 401': (r) => r.status === 401,
    'POST /api/auth has error message': (r) => {
      try { const body = r.json(); return 'error' in body; } catch { return false; }
    },
  });

  sleep(0.3);

  // 4. Metrics — Prometheus text format, contains 'omnivote'
  const metricsRes = http.get(`${BASE_URL}/api/metrics`, {
    tags: { name: 'metrics' },
  });
  check(metricsRes, {
    'GET /api/metrics status 200': (r) => r.status === 200,
    'GET /api/metrics contains omnivote': (r) => r.body.includes('omnivote'),
    'GET /api/metrics has process_uptime': (r) => r.body.includes('omnivote_process_uptime_seconds'),
  });

  sleep(0.3);

  // 5. Dashboard without auth — should return 401
  const dashboardRes = http.get(`${BASE_URL}/api/dashboard`, {
    tags: { name: 'dashboard_noauth' },
  });
  check(dashboardRes, {
    'GET /api/dashboard without auth → 401': (r) => r.status === 401,
  });

  sleep(0.3);

  // 6. Runbooks — public endpoint, should return 200
  const runbooksRes = http.get(`${BASE_URL}/api/runbooks`, {
    tags: { name: 'runbooks' },
  });
  check(runbooksRes, {
    'GET /api/runbooks status 200': (r) => r.status === 200,
    'GET /api/runbooks has array': (r) => {
      try { const body = r.json(); return Array.isArray(body.runbooks) || Array.isArray(body); } catch { return false; }
    },
  });

  sleep(0.3);

  // 7. SLO — public endpoint, should return 200
  const sloRes = http.get(`${BASE_URL}/api/slo`, {
    tags: { name: 'slo' },
  });
  check(sloRes, {
    'GET /api/slo status 200': (r) => r.status === 200,
    'GET /api/slo has reports': (r) => {
      try { const body = r.json(); return Array.isArray(body.reports); } catch { return false; }
    },
  });

  sleep(0.3);

  // 8. Agents without auth — should return 401
  const agentsRes = http.get(`${BASE_URL}/api/agents`, {
    tags: { name: 'agents_noauth' },
  });
  check(agentsRes, {
    'GET /api/agents without auth → 401': (r) => r.status === 401,
  });

  sleep(0.3);

  // 9. Incidents without auth — should return 401
  const incidentsRes = http.get(`${BASE_URL}/api/incidents`, {
    tags: { name: 'incidents_noauth' },
  });
  check(incidentsRes, {
    'GET /api/incidents without auth → 401': (r) => r.status === 401,
  });

  sleep(0.3);

  // 10. Alerts without auth — should return 401
  const alertsRes = http.get(`${BASE_URL}/api/alerts`, {
    tags: { name: 'alerts_noauth' },
  });
  check(alertsRes, {
    'GET /api/alerts without auth → 401': (r) => r.status === 401,
  });
}