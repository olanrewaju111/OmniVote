// --- OmniVote Steady-State Load Test -----------------------------------------
//
// Simulates normal operational traffic.
// 50 VUs peak, mix of public reads (60%), protected reads (30%),
// and write operations (10%).
//
// Run:  k6 run load-tests/load.js
//

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  BASE_URL,
  PUBLIC_ENDPOINTS,
  PROTECTED_ENDPOINTS,
  THRESHOLDS,
  randomItem,
  randomEmail,
  postClientMetrics,
} from './config.js';

// --- Custom Metrics --------------------------------------------------------
const publicReadRate = new Rate('public_read_success');
const protectedReadRate = new Rate('protected_read_handled');
const writeRate = new Rate('write_success');
const publicReadLatency = new Trend('public_read_duration');
const protectedReadLatency = new Trend('protected_read_duration');
const writeLatency = new Trend('write_duration');

// --- Test Options ----------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '2m',  target: 50 },   // steady state
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    ...THRESHOLDS.load,
    public_read_success:     ['rate>0.95'],
    protected_read_handled:  ['rate>0.95'],
    write_success:           ['rate>0.80'],
  },
};

// --- Public Read (60%) ------------------------------------------------------
const publicPaths = Object.values(PUBLIC_ENDPOINTS);

function doPublicRead() {
  const path = randomItem(publicPaths);
  const start = Date.now();
  const res = http.get(`${BASE_URL}${path}`, { tags: { type: 'public_read', endpoint: path } });
  publicReadLatency.add(Date.now() - start);
  const ok = check(res, {
    [`Public GET ${path} status < 500`]: (r) => r.status < 500,
  });
  publicReadRate.add(ok);
}

// --- Protected Read (30%) ----------------------------------------------------
const protectedPaths = Object.values(PROTECTED_ENDPOINTS);

function doProtectedRead() {
  const path = randomItem(protectedPaths);
  const start = Date.now();
  const res = http.get(`${BASE_URL}${path}`, { tags: { type: 'protected_read', endpoint: path } });
  protectedReadLatency.add(Date.now() - start);
  // These will get 401 without auth - that's expected and OK
  const handled = check(res, {
    [`Protected GET ${path} returns 401 or 200`]: (r) => r.status === 401 || r.status === 200,
    [`Protected GET ${path} no 5xx`]: (r) => r.status < 500,
  });
  protectedReadRate.add(handled);
}

// --- Write (10%) -------------------------------------------------------------
function doWrite() {
  const start = Date.now();
  const roll = Math.random();
  let res;

  if (roll < 0.7) {
    // 70% of writes: login attempt with random invalid email
    res = http.post(
      `${BASE_URL}/api/auth`,
      JSON.stringify({ email: randomEmail(), password: 'wrongpassword' }),
      { headers: { 'Content-Type': 'application/json' }, tags: { type: 'write', endpoint: '/api/auth (POST)' } },
    );
  } else if (roll < 0.9) {
    // 20% of writes: post client metrics
    res = postClientMetrics();
  } else {
    // 10% of writes: submit incident (will get 401)
    res = http.post(
      `${BASE_URL}/api/incidents`,
      JSON.stringify({
        title: `Load test ${Math.random().toString(36).slice(2)}`,
        description: 'Automated load test incident',
        severity: 'low',
        category: 'equipment_failure',
        location: '0,0',
      }),
      { headers: { 'Content-Type': 'application/json' }, tags: { type: 'write', endpoint: '/api/incidents (POST)' } },
    );
  }

  writeLatency.add(Date.now() - start);
  const ok = check(res, {
    'Write request no 5xx': (r) => r.status < 500,
  });
  writeRate.add(ok);
}

// --- Main -------------------------------------------------------------------
export default function () {
  const roll = Math.random();

  if (roll < 0.60) {
    doPublicRead();
  } else if (roll < 0.90) {
    doProtectedRead();
  } else {
    doWrite();
  }

  sleep(Math.random() * 0.5 + 0.1);
}
