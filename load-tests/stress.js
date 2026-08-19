// --- OmniVote Stress Test -----------------------------------------------------
//
// Pushes the system to find the breaking point.
// Gradually increases load from 100 to 500 VUs.
//
// Run:  k6 run load-tests/stress.js
//

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  PUBLIC_ENDPOINTS,
  PROTECTED_ENDPOINTS,
  THRESHOLDS,
  randomItem,
  randomEmail,
  fakeIncidentPayload,
} from './config.js';

// --- Custom Metrics --------------------------------------------------------
const stressSuccessRate = new Rate('stress_request_success');
const stressErrorRate = new Rate('stress_5xx_rate');
const stressLatency = new Trend('stress_request_duration');
const stressRequests = new Counter('stress_total_requests');

// --- Test Options ----------------------------------------------------------
export const options = {
  stages: [
    { duration: '1m', target: 100 },  // ramp to 100 VUs
    { duration: '5m', target: 100 },  // hold at 100
    { duration: '1m', target: 500 },  // ramp to 500 VUs
    { duration: '3m', target: 500 },  // hold at 500
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    ...THRESHOLDS.stress,
    stress_request_success: ['rate>0.80'],
    stress_5xx_rate:       ['rate<0.20'],
  },
};

// --- Endpoint pools --------------------------------------------------------
const allEndpoints = [
  ...Object.values(PUBLIC_ENDPOINTS),
  ...Object.values(PROTECTED_ENDPOINTS),
];

const allMethods = [
  // GETs (75%)
  ...allEndpoints.map(p => ({ method: 'GET', path: p })),
  ...allEndpoints.map(p => ({ method: 'GET', path: p })),
  ...allEndpoints.map(p => ({ method: 'GET', path: p })),
  // POSTs (25%)
  { method: 'POST', path: '/api/auth' },
  { method: 'POST', path: '/api/auth' },
  { method: 'POST', path: '/api/auth' },
  { method: 'POST', path: '/api/incidents' },
  { method: 'POST', path: '/api/metrics' },
];

// --- Main -------------------------------------------------------------------
export default function () {
  const endpoint = randomItem(allMethods);
  const start = Date.now();

  let res;

  if (endpoint.method === 'GET') {
    res = http.get(`${BASE_URL}${endpoint.path}`, {
      tags: { type: 'stress', method: 'GET', endpoint: endpoint.path },
    });
  } else if (endpoint.path === '/api/auth') {
    res = http.post(
      `${BASE_URL}/api/auth`,
      JSON.stringify({
        email: randomEmail(),
        password: 'wrongpassword',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'stress', method: 'POST', endpoint: '/api/auth (POST)' },
      },
    );
  } else if (endpoint.path === '/api/incidents') {
    res = http.post(
      `${BASE_URL}/api/incidents`,
      fakeIncidentPayload(),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'stress', method: 'POST', endpoint: '/api/incidents (POST)' },
      },
    );
  } else {
    // metrics POST
    res = http.post(
      `${BASE_URL}/api/metrics`,
      JSON.stringify({
        type: 'web-vital',
        name: 'LCP',
        value: Math.random() * 3000 + 500,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'stress', method: 'POST', endpoint: '/api/metrics (POST)' },
      },
    );
  }

  const duration = Date.now() - start;
  stressLatency.add(duration);
  stressRequests.add(1);

  const is5xx = res.status >= 500;
  const isSuccess = !is5xx;

  check(res, {
    'Stress: no 5xx': (r) => r.status < 500,
    'Stress: got a response': (r) => r.status > 0,
  });

  stressSuccessRate.add(isSuccess);
  stressErrorRate.add(is5xx);

  // Minimal think time during stress
  sleep(Math.random() * 0.1);
}
