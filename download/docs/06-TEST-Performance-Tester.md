# 06 — Performance Testing Guide

**OmniVote Monitor v2.1 — Multi-Tenant Election Monitoring Platform**
**Document Owner:** Performance & QA Team
**Last Updated:** 2025-07-12
**Status:** Active

---

## 1. Performance Testing Strategy

### 1.1 Context & Risk Profile

OmniVote Monitor v2.1 is a multi-tenant election monitoring platform built on Next.js 16, Prisma ORM, SQLite, and the Bun runtime. The system serves 3 tenants, approximately 90 users, and tracks roughly 400 polling units. On election day, traffic can spike by 10x–100x as field agents submit incident reports, operations center staff monitor dashboards in real time, and the public-facing situation room attracts external observers.

The critical load window spans **12–16 hours of continuous peak activity** on election day. During this window the system must remain responsive, data-intact, and available. Any downtime or significant degradation directly impacts election integrity monitoring.

### 1.2 Performance Targets

| Metric | Target | Rationale |
|---|---|---|
| **p95 API response time** | < 2 seconds | Field agents on slow networks need fast confirmations |
| **p99 API response time** | < 5 seconds | Acceptable ceiling for complex aggregation queries |
| **Error rate (5xx)** | 0% under peak load | Data loss from failed submissions is unacceptable |
| **Dashboard TTI** | < 3 seconds on 4G, < 8 seconds on 3G | Operations center and field agents respectively |
| **Concurrent users** | 1,000 sustained, 3,000 spike | 10x–30x current baseline of ~90 users |
| **Data volume capacity** | 10,000+ PUs, 50,000+ incidents, 100,000+ OSINT posts | 10x current volumes with headroom |

### 1.3 Key Constraints

- **Low-bandwidth field agents:** Many field agents operate on 2G/3G connections in rural Nigeria. API payloads must be small and responses must complete before network timeouts.
- **SQLite single-writer limitation:** Only one write transaction can execute at a time. Concurrent POST/PATCH requests will serialize at the database level.
- **Real-time polling overhead:** The current architecture uses 30-second polling across multiple `useQuery` hooks, generating significant request volume.
- **Monolithic frontend bundle:** All 27+ dashboard components load in a single page, creating a large initial JavaScript payload.

---

## 2. Current Performance Baseline

Before any optimization work, establish a reproducible baseline. Run all tests below in a staging environment that mirrors production hardware and data volumes.

### 2.1 Runtime & Infrastructure

| Component | Technology | Performance Implication |
|---|---|---|
| **Runtime** | Bun | Generally faster than Node.js for I/O-bound workloads; however, ecosystem maturity for tooling is lower |
| **Database** | SQLite (single file) | No connection pooling overhead, but single-writer lock means all writes are sequential. Reads can be concurrent in WAL mode |
| **Frontend Framework** | Next.js 16 + React 19 | Server Components available but not yet leveraged; all dashboard components client-rendered |
| **ORM** | Prisma | Generates efficient queries when `include` is used properly; N+1 risk if relations are lazily loaded |
| **Deployment** | Single server (assumed) | No horizontal scaling; single point of failure |

### 2.2 Frontend Characteristics

- **27+ dashboard components** loaded in a single page via `page.tsx` imports — no code splitting
- **40+ Radix UI packages** plus Leaflet, Recharts, Framer Motion, and MDX Editor in the bundle
- **30-second polling** across 6+ simultaneous `useQuery` hooks = approximately 12 requests/minute per active dashboard session
- **400+ Leaflet map markers** rendered without clustering
- **Large Recharts datasets** rendered without virtualization

### 2.3 Data Model Scale

- **23 Prisma models** across 3 tenants
- **28 API routes** (GET/POST/PATCH/DELETE)
- Current production data: ~90 users, ~400 polling units, moderate incident and OSINT volumes
- Election day projection: 10,000+ polling units, 50,000+ incidents, 100,000+ OSINT posts

---

## 3. Load Testing Scenarios

Each scenario below must be executed against a staging environment with production-equivalent data volumes (pre-seeded database). Record results in the benchmark table in Section 6.

### 3.1 Normal Load (Baseline)

Simulates typical daily usage outside of election day. Establishes the performance floor.

| Parameter | Value |
|---|---|
| Concurrent users | 100 |
| Requests per user per minute | 10 |
| Request mix | 60% GET, 30% POST, 10% PATCH |
| Test duration | 1 hour |
| Data volume | Current production (~400 PUs, ~90 users) |
| Pass criteria | All responses < 1s, 0% error rate |

### 3.2 Peak Load (Election Day)

Simulates the sustained high-traffic period during vote counting and incident reporting. This is the most important test.

| Parameter | Value |
|---|---|
| Concurrent users | 1,000 |
| Requests per user per minute | 30 |
| Request mix | 40% GET (dashboards), 50% POST (incident submissions, PVT uploads), 10% PATCH (status updates) |
| Test duration | 4 hours |
| Data volume | Election day projection (10,000+ PUs, 50,000+ incidents) |
| Pass criteria | p95 < 2s, 0% error rate, no data loss |

**Critical focus areas:**
- Incident submission throughput under heavy POST load
- SQLite write-lock contention (measure queue depth)
- Dashboard query performance with 50K+ incident records
- Memory stability over 4 hours

### 3.3 Stress Test (Breaking Point)

Progressively increases load until the system degrades. The goal is not to pass but to discover the failure mode and the maximum sustainable throughput.

| Parameter | Value |
|---|---|
| Starting concurrent users | 100 |
| Ramp to | 5,000 |
| Ramp duration | 30 minutes |
| Hold at peak | 30 minutes |
| Request mix | Same as peak load scenario |
| Data volume | Election day projection |

**Measure and record:**
- Maximum concurrent users before p95 exceeds 5s
- Maximum throughput (requests/second) before error rate exceeds 1%
- Bottleneck identification: CPU saturation, memory exhaustion, SQLite write-lock queue, or network bandwidth
- Failure mode: graceful degradation (slow responses) vs. hard failure (crashes, data corruption)

### 3.4 Endurance Test (All-Day Election)

Simulates the full election day duration to catch slow-burn issues like memory leaks, database bloat, and resource exhaustion.

| Parameter | Value |
|---|---|
| Concurrent users | 500 (sustained) |
| Test duration | 12 hours continuous |
| Request mix | 50% GET, 40% POST, 10% PATCH |
| Data volume | Starts at election day projection; grows throughout test |

**Monitor continuously:**
- **Memory usage trend** — plot every 5 minutes; any upward trend without corresponding load increase indicates a leak
- **SQLite WAL file size** — WAL files grow with writes; if they exceed 1GB, checkpointing may cause latency spikes
- **Database file size** — monitor for unexpected bloat from un-vacuumed records
- **Response time trend** — watch for gradual degradation over hours
- **Disk I/O** — SQLite is disk-bound; watch for I/O saturation

### 3.5 Spike Test

Simulates a sudden surge in traffic caused by a breaking news event (e.g., violence at a polling station, broadcast appeal for observers to report).

| Parameter | Value |
|---|---|
| Baseline | 100 concurrent users, normal load |
| Spike | Jump to 3,000 concurrent users in 60 seconds |
| Spike duration | 10 minutes |
| Recovery measurement | Return to baseline, measure time to restore p95 < 1s |
| Repeat | 3 spikes within 1 hour |

**Pass criteria:**
- No crashes or data corruption during spike
- Error rate stays below 5% during spike
- Recovery to baseline performance within 5 minutes of spike ending

---

## 4. Database Performance Testing

### 4.1 SQLite Limitations & Mitigations

SQLite is the current database and its limitations are the single greatest performance risk for election day.

| Limitation | Impact | Test Approach | Mitigation |
|---|---|---|---|
| **Single-writer lock** | All POST/PATCH/DELETE operations serialize. At 500 writes/second, queue time dominates | Measure write throughput with `k6` POST storm; record lock wait times | Enable WAL mode; batch writes; consider PostgreSQL migration |
| **No connection pooling** | Each Prisma client opens a file descriptor; Bun manages these at the runtime level | Monitor file descriptor count under load | Reuse a single Prisma client instance (already recommended by Prisma) |
| **WAL mode disabled by default** | Readers block on writes; no concurrent read-write | Compare read latency with and without WAL mode enabled | `PRAGMA journal_mode=WAL;` in Prisma schema or startup script |
| **OS-level file locking** | The `.db` file is locked at the OS level; NFS or network-mounted storage will fail catastrophically | Verify database is on local SSD, not network storage | Ensure local disk; never NFS for SQLite |

**Mandatory test:** Run the Peak Load scenario (Section 3.2) with WAL mode enabled vs. disabled. Document the difference in read latency under write load.

### 4.2 Query Performance Benchmarks

For each of the 28 API routes, execute the following query performance tests:

1. **N+1 Detection:** Run each route with Prisma logging enabled (`log: ['query']`). Count the number of SQL queries per HTTP request. Any route generating more than 3 SQL queries per request should be investigated for N+1 patterns. Ensure all relation loading uses `include` or `select` in a single query.

2. **Pagination Scaling:** Test all list endpoints (`/api/incidents`, `/api/osint`, `/api/polling-units`) with increasing `limit` values and `offset` positions. Measure:
   - `offset=0, limit=50` (typical page)
   - `offset=50,000, limit=50` (deep pagination — SQLite must scan all skipped rows)
   - `offset=0, limit=1000` (bulk export)

3. **Index Coverage:** For every query identified in step 1, run `EXPLAIN QUERY PLAN` and verify that indexes are being used. Cross-reference with `@@index` directives in the Prisma schema. Any full table scan on a table with >10,000 rows is a performance risk.

4. **Aggregation Queries:** The following endpoints perform heavy aggregations and must be benchmarked separately:
   - **Situation Room dashboard** — counts and group-bys across incidents, PUs, and OSINT
   - **PVT Sankey diagram** — multi-join aggregation across PVT results, parties, and polling units
   - **OSINT analytics** — count and trend queries across 100K+ posts
   - **KPI summary endpoints** — called on every dashboard refresh

### 4.3 Database Migration Path Testing

Before election day, the team may migrate from SQLite to PostgreSQL. Test this migration path thoroughly:

1. **Schema migration:** Run `prisma migrate` to convert the SQLite schema to PostgreSQL. Verify all 23 models, relations, and indexes transfer correctly.
2. **Query parity:** Run the same 28 API route benchmarks against PostgreSQL. Compare p50, p95, and p99 latencies. Pay special attention to aggregation queries.
3. **Connection pooling:** Test with PgBouncer in transaction-pooling mode. Measure connection reuse and overhead.
4. **Read replicas:** If PostgreSQL is deployed with a read replica, route all GET (dashboard) queries to the replica and measure the reduction in write-query contention.
5. **Data migration:** Time a full data migration of 10,000 PUs, 50,000 incidents, and 100,000 OSINT posts from SQLite to PostgreSQL.

---

## 5. Frontend Performance Testing

### 5.1 Page Load Performance

| Measurement | Tool | Target |
|---|---|---|
| **First Contentful Paint (FCP)** | Lighthouse | < 1.8s on 4G |
| **Largest Contentful Paint (LCP)** | Lighthouse | < 2.5s on 4G |
| **Time to Interactive (TTI)** | Lighthouse | < 3.0s on 4G, < 8.0s on 3G |
| **Total Blocking Time (TBT)** | Lighthouse | < 200ms |
| **Cumulative Layout Shift (CLS)** | Lighthouse | < 0.1 |

**Critical test — Tab rendering time:** The dashboard has 21 tabs. Measure the time to fully render each tab when switched to. Tabs that load large datasets (map view, analytics charts, OSINT feed) should be individually benchmarked.

**Bundle analysis:** Run `webpack-bundle-analyzer` (or the Vite/Next.js equivalent) to identify:
- Total JavaScript bundle size
- Largest individual chunks
- Duplicated dependencies across chunks
- Tree-shaking opportunities (are all 40+ Radix UI packages actually used?)

**Code splitting audit:** Currently, `page.tsx` imports all dashboard components upfront. This means the browser downloads and parses the entire application before anything renders. Measure the impact of lazy-loading each tab's component with `React.lazy()` + `Suspense`.

### 5.2 Client-Side Runtime Performance

| Concern | Test Method | Current Risk |
|---|---|---|
| **Polling overhead** | Chrome DevTools Network tab: count requests/minute from 6 simultaneous `useQuery` hooks at 30s intervals | 12 req/min per session; ×1,000 users = 12,000 req/min at peak |
| **React Query cache** | Chrome DevTools Performance tab: record cache invalidation and re-render cycles | Full invalidation triggers re-fetches of all 6 hooks simultaneously |
| **Leaflet rendering** | Profile render time with 400+ markers on a low-end device | No marker clustering; each marker is a separate DOM element |
| **Recharts rendering** | Profile render time with 1,000+ data points in line/bar charts | No data downsampling or virtualization |
| **Framer Motion** | Profile animation frame rates during tab transitions | Complex animations may drop frames on low-end devices |
| **Memory usage** | Chrome DevTools Memory tab: take heap snapshots before/after 30 minutes of dashboard use | Watch for detached DOM nodes from unmounted tabs |

### 5.3 Mobile & Low-Bandwidth Performance

Field agents are the most critical users and have the worst network conditions.

**Device testing matrix:**

| Device Tier | Example | RAM | CPU | Network |
|---|---|---|---|---|
| Low-end Android | Samsung Galaxy A03s | 2–3 GB | Octa-core 1.8 GHz | 3G (750 kbps, 200ms RTT) |
| Mid-range Android | Samsung Galaxy A54 | 6 GB | Octa-core 2.4 GHz | 4G (5 Mbps, 50ms RTT) |
| Operations center | Modern laptop | 16+ GB | Modern x86 | Broadband (50+ Mbps, 10ms RTT) |

**Test on low-end (3G simulation):**
- Login flow: Can a field agent authenticate and reach the incident submission form within 10 seconds?
- Incident submission: Can a form POST with photo attachment complete within 5 seconds on 3G?
- Dashboard: Is the operations center dashboard usable on a mid-range device on 4G?
- Offline resilience: What happens when the network drops mid-submission? Does the app retry? Is data preserved?

---

## 6. API Endpoint Benchmarks

Execute all benchmarks with the election day data volume (10,000 PUs, 50,000 incidents, 100,000 OSINT posts). Record results in the table below.

| # | Route | Method | Current p50 | Current p95 | Target p95 | Bottleneck | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/api/auth/login` | POST | — | — | < 500ms | DB (user lookup) | |
| 2 | `/api/auth/session` | GET | — | — | < 200ms | CPU (JWT verify) | |
| 3 | `/api/tenants` | GET | — | — | < 300ms | DB | |
| 4 | `/api/polling-units` | GET | — | — | < 1,000ms | DB (large table scan) | |
| 5 | `/api/polling-units/[id]` | GET | — | — | < 300ms | DB | |
| 6 | `/api/polling-units` | POST | — | — | < 1,000ms | DB (write lock) | |
| 7 | `/api/polling-units/[id]` | PATCH | — | — | < 1,000ms | DB (write lock) | |
| 8 | `/api/incidents` | GET | — | — | < 1,500ms | DB (filter + sort + paginate) | |
| 9 | `/api/incidents/[id]` | GET | — | — | < 300ms | DB | |
| 10 | `/api/incidents` | POST | — | — | < 2,000ms | DB (write lock) + Network (media upload) | |
| 11 | `/api/incidents/[id]` | PATCH | — | — | < 1,000ms | DB (write lock) | |
| 12 | `/api/incidents/bulk` | POST | — | — | < 5,000ms | DB (batch writes) | |
| 13 | `/api/osint` | GET | — | — | < 2,000ms | DB (100K+ rows) | |
| 14 | `/api/osint/[id]` | GET | — | — | < 300ms | DB | |
| 15 | `/api/osint` | POST | — | — | < 1,000ms | DB (write lock) | |
| 16 | `/api/osint/bulk-import` | POST | — | — | < 10,000ms | DB (mass insert) | |
| 17 | `/api/pvt/results` | GET | — | — | < 2,000ms | DB (aggregation joins) | |
| 18 | `/api/pvt/results` | POST | — | — | < 1,000ms | DB (write lock) | |
| 19 | `/api/pvt/sankey` | GET | — | — | < 3,000ms | DB (heavy aggregation) | |
| 20 | `/api/analytics/kpi` | GET | — | — | < 2,000ms | DB (multi-table counts) | |
| 21 | `/api/analytics/trends` | GET | — | — | < 3,000ms | DB (time-series aggregation) | |
| 22 | `/api/situation-room` | GET | — | — | < 2,000ms | DB (composite query) | |
| 23 | `/api/users` | GET | — | — | < 500ms | DB | |
| 24 | `/api/users` | POST | — | — | < 1,000ms | DB (write lock) | |
| 25 | `/api/users/[id]` | PATCH | — | — | < 1,000ms | DB (write lock) | |
| 26 | `/api/assignments` | GET | — | — | < 500ms | DB | |
| 27 | `/api/assignments` | POST | — | — | < 1,000ms | DB (write lock) | |
| 28 | `/api/reports/export` | GET | — | — | < 5,000ms | DB (full table export) | |

**Bottleneck legend:**
- **DB** — Database query or write-lock contention is the primary cost
- **CPU** — Server-side computation (JSON serialization, data transformation) dominates
- **Network** — Response payload size or upload bandwidth is the constraint
- **Memory** — Large result sets consume excessive memory during serialization

**How to benchmark each endpoint:**
```bash
# Individual endpoint with autocannon
autocannon -c 50 -d 30 http://localhost:3000/api/incidents

# Individual endpoint with k6
k6 run --vus 50 --duration 30s scripts/incidents-get.js
```

---

## 7. Tools

| Tool | Purpose | When to Use |
|---|---|---|
| **k6** | Scriptable load testing; supports HTTP, WebSocket (future); produces detailed metrics | All load scenarios (Sections 3.1–3.5). Primary load testing tool |
| **autocannon** | Quick HTTP benchmarking from the command line; Node.js based | Ad-hoc single-endpoint benchmarks; fast iteration during optimization |
| **Lighthouse** | Core Web Vitals (FCP, LCP, TTI, CLS, TBT); accessibility and SEO | Frontend performance audit (Section 5.1); run in CI/CD |
| **webpack-bundle-analyzer** | Visualizes bundle composition; identifies large dependencies | Bundle size optimization (Section 5.1); run during build analysis |
| **Chrome DevTools** | Performance profiling, memory leak detection, network waterfall, rendering analysis | Client-side performance debugging (Section 5.2); mobile simulation |
| **sqlite3 CLI** | `EXPLAIN QUERY PLAN` for slow query analysis; manual database inspection | Query optimization (Section 4.2) |
| **pgbench** | PostgreSQL benchmarking tool; standardized TPC-B-like workload | Post-migration performance comparison (Section 4.3) |
| **bun --profile** | Bun's built-in CPU profiler | Server-side CPU hotspot identification |
| **docker stats** | Container resource monitoring | Real-time CPU/memory observation during load tests |

### Tool Installation

```bash
# k6
brew install k6              # macOS
# or: snap install k6        # Linux
# or: choco install k6       # Windows

# autocannon
npm install -g autocannon

# Lighthouse (via Chrome or CLI)
npm install -g lighthouse

# Bundle analyzer
npm install -g @next/bundle-analyzer

# sqlite3 (usually pre-installed)
sqlite3 omni-vote.db "EXPLAIN QUERY PLAN SELECT * FROM incidents LIMIT 10;"
```

---

## 8. Performance Testing Scripts

### 8.1 Baseline Load Test (k6)

```javascript
// scripts/baseline-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '56m', target: 100 },  // Hold for 1 hour
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // All responses < 1s
    errors: ['rate<0.01'],             // < 1% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || 'test-token';

const endpoints = [
  { method: 'GET', path: '/api/polling-units', weight: 20 },
  { method: 'GET', path: '/api/incidents', weight: 15 },
  { method: 'GET', path: '/api/osint', weight: 10 },
  { method: 'GET', path: '/api/analytics/kpi', weight: 10 },
  { method: 'GET', path: '/api/situation-room', weight: 5 },
  { method: 'POST', path: '/api/incidents', weight: 20, body: {
    title: 'Test incident',
    description: 'Load test incident submission',
    severity: 'MEDIUM',
    pollingUnitId: 'pu-test-001',
    tenantId: 'tenant-1',
  }},
  { method: 'POST', path: '/api/pvt/results', weight: 10, body: {
    pollingUnitId: 'pu-test-001',
    partyId: 'party-1',
    votes: 150,
  }},
  { method: 'PATCH', path: '/api/incidents/inc-001', weight: 10, body: {
    status: 'VERIFIED',
  }},
];

function pickEndpoint() {
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const ep of endpoints) {
    r -= ep.weight;
    if (r <= 0) return ep;
  }
  return endpoints[0];
}

export default function () {
  const ep = pickEndpoint();
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };

  const url = `${BASE_URL}${ep.path}`;
  let res;

  if (ep.method === 'GET') {
    res = http.get(url, params);
  } else if (ep.method === 'POST') {
    res = http.post(url, JSON.stringify(ep.body), params);
  } else if (ep.method === 'PATCH') {
    res = http.patch(url, JSON.stringify(ep.body), params);
  }

  apiLatency.add(res.timings.duration);
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  sleep(Math.random() * 5 + 1); // 1–6s between requests (~10 req/min)
}
```

### 8.2 Election Day Simulation (k6)

```javascript
// scripts/election-day.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const incidentLatency = new Trend('incident_post_latency');
const dashboardLatency = new Trend('dashboard_get_latency');

export const options = {
  stages: [
    { duration: '10m', target: 500 },   // Morning ramp: polls opening
    { duration: '30m', target: 1000 },  // Sustained peak: voting + incidents
    { duration: '1h', target: 1000 },   // Extended peak: vote counting
    { duration: '30m', target: 500 },   // Wind down
    { duration: '10m', target: 0 },     // Off
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.001'], // 0% error rate
    incident_post_latency: ['p(95)<2000'],
    dashboard_get_latency: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Simulate a field agent submitting incidents
function fieldAgentFlow() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.FIELD_TOKEN}`,
    },
  };

  // Submit an incident
  const incidentRes = http.post(
    `${BASE_URL}/api/incidents`,
    JSON.stringify({
      title: `Incident at PU-${__VU}-${Date.now()}`,
      description: 'Reported via load test simulation',
      severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 4)],
      category: ['VIOLENCE', 'INTIMIDATION', 'BALLOT_STUFFING', 'LOGISTICS'][Math.floor(Math.random() * 4)],
      pollingUnitId: `pu-${Math.floor(Math.random() * 10000)}`,
      tenantId: 'tenant-1',
    }),
    params,
  );
  incidentLatency.add(incidentRes.timings.duration);
  check(incidentRes, { 'incident created': (r) => r.status === 201 });

  sleep(Math.random() * 10 + 5); // 5–15s between submissions
}

// Simulate an operations center user monitoring dashboards
function dashboardUserFlow() {
  const params = {
    headers: {
      'Authorization': `Bearer ${__ENV.DASHBOARD_TOKEN}`,
    },
  };

  const dashboards = [
    '/api/situation-room',
    '/api/analytics/kpi',
    '/api/analytics/trends',
    '/api/incidents?limit=50&sort=createdAt:desc',
    '/api/pvt/sankey',
    '/api/osint?limit=50',
  ];

  for (const path of dashboards) {
    const res = http.get(`${BASE_URL}${path}`, params);
    dashboardLatency.add(res.timings.duration);
    check(res, { 'dashboard loaded': (r) => r.status === 200 });
    sleep(2); // Simulate 30s polling by cycling through 6 endpoints in ~30s
  }
}

export default function () {
  // 70% field agents, 30% dashboard users
  if (Math.random() < 0.7) {
    fieldAgentFlow();
  } else {
    dashboardUserFlow();
  }
}
```

### 8.3 Spike Test (k6)

```javascript
// scripts/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    // Baseline
    { duration: '2m', target: 100 },
    { duration: '3m', target: 100 },
    // SPIKE 1
    { duration: '1m', target: 3000 },   // Ramp to 3000 in 60s
    { duration: '5m', target: 3000 },   // Hold spike
    { duration: '2m', target: 100 },    // Recovery
    { duration: '5m', target: 100 },    // Baseline again
    // SPIKE 2
    { duration: '1m', target: 3000 },
    { duration: '5m', target: 3000 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    // SPIKE 3
    { duration: '1m', target: 3000 },
    { duration: '5m', target: 3000 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    // Cool down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'], // Allow up to 5% during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  };

  const endpoints = [
    () => http.get(`${BASE_URL}/api/situation-room`, params),
    () => http.get(`${BASE_URL}/api/incidents?limit=20`, params),
    () => http.get(`${BASE_URL}/api/analytics/kpi`, params),
    () => http.post(`${BASE_URL}/api/incidents`, JSON.stringify({
      title: `Spike incident ${Date.now()}`,
      description: 'Spike test',
      severity: 'HIGH',
      pollingUnitId: `pu-${Math.floor(Math.random() * 10000)}`,
      tenantId: 'tenant-1',
    }), params),
  ];

  const fn = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = fn();

  check(res, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 })
    || errorRate.add(1);

  sleep(Math.random() * 2 + 0.5);
}
```

---

## 9. Monitoring During Tests

All load tests must be accompanied by real-time infrastructure monitoring. Use the following dashboard/checklist:

### 9.1 Server Metrics

| Metric | Tool | Sampling Rate | Alert Threshold |
|---|---|---|---|
| CPU usage (%) | `top`, `htop`, or Prometheus node exporter | 5s | > 80% sustained |
| Memory usage (MB) | `free -m`, Prometheus | 5s | > 80% of available |
| Disk I/O (MB/s) | `iostat`, Prometheus | 5s | Saturating disk bandwidth |
| Network I/O (Mbps) | `nload`, Prometheus | 5s | Approaching link capacity |
| File descriptors open | `lsof \| wc -l` | 30s | > 1,000 |
| Bun process RSS | `/proc/<pid>/status` or `ps aux` | 5s | Steady upward trend = leak |

### 9.2 Application Metrics

| Metric | Collection Method | Sampling Rate |
|---|---|---|
| Request rate (req/s) | k6 built-in metrics | 1s |
| Error rate by endpoint | k6 built-in metrics | 1s |
| p50 / p75 / p90 / p95 / p99 latencies | k6 built-in metrics | 1s |
| SQLite WAL file size | `ls -la *.wal` | 30s |
| SQLite database file size | `ls -la *.db` | 60s |
| SQLite write-lock wait time | Custom instrumentation in API routes | Per request |
| Request queue depth | Bun event loop lag (`process.eventLoopUtilization()`) | 5s |
| Active Prisma connections | Prisma middleware logging | Per request |

### 9.3 Monitoring Script

```bash
#!/bin/bash
# scripts/monitor.sh — Run alongside k6 tests
# Usage: ./monitor.sh <output-dir>

OUTDIR="${1:-./test-results/monitoring}"
mkdir -p "$OUTDIR"
INTERVAL=5

echo "timestamp,cpu_pct,mem_used_mb,mem_pct,disk_io_wb,wal_size_kb,fd_count" \
  > "$OUTDIR/system_metrics.csv"

while true; do
  TIMESTAMP=$(date -Iseconds)
  CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'.' -f1)
  MEM_USED=$(free -m | awk 'NR==2{print $3}')
  MEM_PCT=$(free | awk 'NR==2{printf "%.0f", $3/$2*100}')
  DISK_IO=$(iostat -d 1 1 2>/dev/null | tail -1 | awk '{print $5}' || echo "N/A")
  WAL_SIZE=$(stat -c%s omni-vote.db-wal 2>/dev/null || echo "0")
  FD_COUNT=$(lsof 2>/dev/null | wc -l || echo "0")

  echo "$TIMESTAMP,$CPU,$MEM_USED,$MEM_PCT,$DISK_IO,$((WAL_SIZE/1024)),$FD_COUNT" \
    >> "$OUTDIR/system_metrics.csv"

  sleep $INTERVAL
done
```

---

## 10. Performance Optimization Recommendations

Based on the known architecture of OmniVote Monitor v2.1, the following optimizations are prioritized by impact and implementation effort.

### 10.1 Critical (Must-Do Before Election Day)

| # | Optimization | Impact | Effort | Details |
|---|---|---|---|---|
| 1 | **Enable SQLite WAL mode** | High | Low | `PRAGMA journal_mode=WAL;` allows concurrent reads during writes. Single biggest SQLite performance win. Add to Prisma schema via `previewFeatures = ["prismaSchemaExtensions"]` or a startup script. |
| 2 | **Migrate to PostgreSQL** | Very High | High | Eliminates single-writer bottleneck entirely. Enables connection pooling (PgBouncer), read replicas, and true concurrent writes. This is the most impactful change for election day scalability. |
| 3 | **Implement React.lazy for dashboard components** | High | Medium | Code-split the 21 dashboard tabs so only the active tab's JavaScript is loaded. Reduces initial bundle by an estimated 60–70%. Use `next/dynamic` with `ssr: false` for client-only components like Leaflet maps. |
| 4 | **Add server-side caching for KPI endpoints** | High | Low | Cache `/api/analytics/kpi` and `/api/situation-room` responses in memory with a 30–60 second TTL. These are the most frequently polled endpoints and the data changes gradually. Use a simple `Map` with TTL or `node-cache`. |

### 10.2 High Priority (Should-Do)

| # | Optimization | Impact | Effort | Details |
|---|---|---|---|---|
| 5 | **Reduce polling frequency** | Medium | Low | Increase polling interval from 30s to 60s for non-critical data (OSINT feed, trends). Reduce requests per session from 12/min to ~8/min. At 1,000 users, this eliminates 4,000 req/min. |
| 6 | **Implement WebSocket for real-time updates** | High | Medium | Replace HTTP polling with WebSocket/SSE push for dashboard data. Reduces request volume by ~90% and improves data freshness. Use Socket.io or the native WebSocket API. |
| 7 | **Add Leaflet marker clustering** | Medium | Low | Use `react-leaflet-cluster` or `supercluster` to cluster 400+ polling unit markers. Renders ~50 cluster markers instead of 400+ individual markers. Massive rendering performance improvement on mobile. |
| 8 | **Virtualize long lists** | Medium | Low | Use `@tanstack/react-virtual` (formerly `react-virtual`) for incident lists, OSINT feeds, and polling unit tables. Only render visible rows. Reduces DOM nodes from thousands to ~20. |

### 10.3 Medium Priority (Nice-to-Have)

| # | Optimization | Impact | Effort | Details |
|---|---|---|---|---|
| 9 | **Add CDN for static assets** | Medium | Medium | Serve Next.js static files, images, and fonts via Cloudflare or similar CDN. Reduces origin server load and improves TTFB for global/remote users. |
| 10 | **Optimize bundle size** | Medium | Medium | Audit and remove unused Radix UI packages. Replace Framer Motion with CSS transitions for simple animations. Consider replacing Recharts with a lighter charting library if only basic charts are needed. |
| 11 | **Batch write API** | High | Medium | Create a `/api/incidents/batch` endpoint that accepts an array of incidents and inserts them in a single Prisma transaction. Reduces SQLite write-lock acquisitions by N× for bulk operations. |
| 12 | **Optimize images for mobile** | Low | Low | Compress and resize images uploaded by field agents before storing. Serve responsive images with `next/image` and automatic format negotiation (WebP/AVIF). |
| 13 | **Database query optimization pass** | High | Medium | For each of the 28 routes: run `EXPLAIN QUERY PLAN`, add missing `@@index` directives, eliminate N+1 queries, and ensure pagination uses cursor-based (keyset) pagination instead of `OFFSET` for large tables. |
| 14 | **Implement connection reuse** | Low | Low | Ensure the Prisma client is instantiated once at the application level (not per-request). Bun already handles this well, but verify with `lsof` that the number of file descriptors stays constant under load. |

### 10.4 Optimization Priority Matrix

```
         High Impact
              |
   PostgreSQL  |  React.lazy  |  KPI Cache
   Migration   |  Code Split  |  WAL Mode
              |
 Medium Effort | Low Effort
--------------+--------------
              |
   WebSocket   |  Marker      |  Polling
   Push        |  Clustering  |  Interval
              |
         Lower Impact
```

**Recommended execution order:**
1. Enable WAL mode (5 minutes, immediate improvement)
2. Add KPI caching (1–2 hours, immediate improvement)
3. React.lazy code splitting (4–8 hours, large frontend improvement)
4. PostgreSQL migration (2–5 days, critical for election day)
5. WebSocket real-time updates (3–5 days, eliminates polling)
6. Marker clustering + list virtualization (2–4 hours, mobile improvement)
7. Bundle size optimization (ongoing, iterative)

---

## Appendix A: Test Execution Checklist

- [ ] Provision staging environment with production-equivalent hardware
- [ ] Seed database with election day data volumes (10K PUs, 50K incidents, 100K OSINT)
- [ ] Verify WAL mode is enabled (or disabled, depending on test variant)
- [ ] Run baseline load test (Section 3.1), record results in Section 6 table
- [ ] Run peak load test (Section 3.2), record results
- [ ] Run stress test (Section 3.3), identify breaking point
- [ ] Run endurance test (Section 3.4), check for memory leaks
- [ ] Run spike test (Section 3.5), measure recovery time
- [ ] Run Lighthouse audit on dashboard page, record Core Web Vitals
- [ ] Run bundle analyzer, document largest chunks
- [ ] Run `EXPLAIN QUERY PLAN` on all aggregation queries
- [ ] Test on low-end Android device with 3G network simulation
- [ ] Document all findings and update the benchmark table
- [ ] File performance bugs for any route exceeding targets
- [ ] Re-run tests after optimizations to measure improvement

## Appendix B: Result Template

After each test run, record results using this format:

```
Test: [Scenario Name]
Date: [YYYY-MM-DD HH:MM]
Environment: [Hardware specs, Bun version, SQLite/Postgres version]
Data Volume: [PU count, incident count, OSINT count]
Duration: [Actual test duration]

Results:
- Throughput: [X req/s]
- p50 latency: [X ms]
- p95 latency: [X ms]
- p99 latency: [X ms]
- Error rate: [X%]
- Max concurrent users: [X]
- Peak memory: [X MB]
- WAL file size at end: [X MB]
- Observations: [Any anomalies, patterns, or concerns]
- Bottleneck: [CPU / Memory / Disk I/O / SQLite lock / Network]
```