// ─── OmniVote Load Testing — Shared Configuration ─────────────────────────
//
// This file exports shared constants, helper functions, and threshold
// definitions used across all k6 test scripts.
//
// Usage: import { BASE_URL, publicEndpoints, ... } from './config.js';

// ─── Base URL ──────────────────────────────────────────────────────────────
// Override via environment variable: K6_BASE_URL=http://my-server:3000
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ─── Public Endpoints (no auth required) ────────────────────────────────────
export const PUBLIC_ENDPOINTS = {
  health:    '/api/health',
  auth:      '/api/auth',
  metrics:   '/api/metrics',
  runbooks:  '/api/runbooks',
  slo:       '/api/slo',
  docs:      '/api/docs',
  security:  '/api/security',
};

// ─── Protected Endpoints (require auth) ────────────────────────────────────
export const PROTECTED_ENDPOINTS = {
  dashboard:  '/api/dashboard',
  agents:     '/api/agents',
  incidents:  '/api/incidents',
  alerts:     '/api/alerts',
  elections:  '/api/elections',
  auditLogs:  '/api/audit-logs',
  monitoring: '/api/monitoring/alerts',
};

// ─── Write Endpoints ───────────────────────────────────────────────────────
export const WRITE_ENDPOINTS = {
  login:      '/api/auth',
  incident:   '/api/incidents',
  metrics:    '/api/metrics',
};

// ─── Threshold Presets ─────────────────────────────────────────────────────
export const THRESHOLDS = {
  // Smoke test — everything must be fast
  smoke: {
    http_req_duration: ['avg<200', 'p(95)<500'],
    http_req_failed:   ['rate<0.01'],
  },

  // Normal load — comfortable margins
  load: {
    http_req_duration: ['avg<300', 'p(95)<500'],
    http_req_failed:   ['rate<0.05'],
  },

  // Spike / election day — more lenient
  spike: {
    http_req_duration: ['avg<600', 'p(95)<1000', 'p(99)<3000'],
    http_req_failed:   ['rate<0.10'],
  },

  // Stress — find breaking point, generous thresholds
  stress: {
    http_req_duration: ['avg<1000', 'p(95)<2000'],
    http_req_failed:   ['rate<0.20'],
  },

  // Auth — account for deliberate login delays (anti-timing)
  auth: {
    http_req_duration: ['avg<1500', 'p(95)<2500'],
    http_req_failed:   ['rate<0.05'],
  },
};

// ─── Helper: Pick a random item from an array ───────────────────────────────
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Helper: Weighted random selection ─────────────────────────────────────
// weights: array of numbers, items: array of values
// Returns an item selected based on relative weights
export function weightedRandom(items, weights) {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }

  return items[items.length - 1];
}

// ─── Helper: Random string generator ───────────────────────────────────────
export function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ─── Helper: Random email generator ────────────────────────────────────────
export function randomEmail() {
  return `loadtest-${randomString(10)}@example.com`;
}

// ─── Helper: Generate fake incident payload ─────────────────────────────────
export function fakeIncidentPayload() {
  const severities = ['low', 'medium', 'high', 'critical'];
  const categories = [
    'voter_intimidation',
    'ballot_tampering',
    'polling_place_issue',
    'equipment_failure',
    'queue_violation',
    'voter_suppression',
    'media_misinformation',
  ];

  return JSON.stringify({
    title: `Load test incident ${randomString(6)}`,
    description: 'Automated load test incident — can be safely ignored',
    severity: randomItem(severities),
    category: randomItem(categories),
    location: `${(Math.random() * 360 - 180).toFixed(4)},${(Math.random() * 180 - 90).toFixed(4)}`,
  });
}

// ─── Helper: Hit a public endpoint (GET) ────────────────────────────────────
export function hitPublicEndpoint(path) {
  const res = http.get(`${BASE_URL}${path}`, {
    tags: { endpoint: path },
  });
  return res;
}

// ─── Helper: Hit a protected endpoint (GET, no auth — expects 401) ─────────
export function hitProtectedEndpoint(path) {
  const res = http.get(`${BASE_URL}${path}`, {
    tags: { endpoint: path },
  });
  return res;
}

// ─── Helper: Attempt login with credentials ─────────────────────────────────
export function attemptLogin(email, password) {
  const res = http.post(`${BASE_URL}/api/auth`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: '/api/auth (POST)' },
  });
  return res;
}

// ─── Helper: Submit a fake incident (POST, no auth — expects 401) ──────────
export function submitFakeIncident() {
  const res = http.post(`${BASE_URL}/api/incidents`, fakeIncidentPayload(), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: '/api/incidents (POST)' },
  });
  return res;
}

// ─── Helper: Post client metrics (fire-and-forget) ─────────────────────────
export function postClientMetrics() {
  const payload = JSON.stringify({
    type: 'web-vital',
    name: 'LCP',
    value: Math.random() * 3000 + 500,
    timestamp: new Date().toISOString(),
  });
  const res = http.post(`${BASE_URL}/api/metrics`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: '/api/metrics (POST)' },
  });
  return res;
}
