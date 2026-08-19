// --- OmniVote Election-Day Spike Test ----------------------------------------
//
// Simulates election-day traffic surge:
//   20 VUs steady -> SPIKE to 200 VUs -> hold -> drop
// 70% reads, 20% login attempts, 10% incident submissions.
//
// Run:  k6 run load-tests/spike.js
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
const readSuccessRate = new Rate('spike_read_success');
const loginAttemptRate = new Rate('spike_login_attempt');
const incidentSubmitRate = new Rate('spike_incident_submit');
const spikeReadLatency = new Trend('spike_read_duration');
const spikeWriteLatency = new Trend('spike_write_duration');
const incidentCounter = new Counter('spike_incidents_submitted');

// --- Test Options ----------------------------------------------------------
export const options = {
  stages: [
    { duration: '1m',  target: 20 },   // ramp up to baseline
    { duration: '2m',  target: 20 },   // steady baseline
    { duration: '30s', target: 200 },  // SPIKE - election day surge
    { duration: '2m',  target: 200 },  // hold at peak
    { duration: '30s', target: 0 },    // drop to zero
  ],
  thresholds: {
    ...THRESHOLDS.spike,
    spike_read_success:      ['rate>0.90'],
    spike_login_attempt:    ['rate>0.80'],
    spike_incident_submit:  ['rate>0.70'],
  },
};

// --- Endpoint pools --------------------------------------------------------
const publicPaths = Object.values(PUBLIC_ENDPOINTS);
const protectedPaths = Object.values(PROTECTED_ENDPOINTS);

// --- Read operation (70%) ---------------------------------------------------
function doRead() {
  const start = Date.now();

  // 60% public, 40% protected
  const isPublic = Math.random() < 0.6;
  const path = isPublic
    ? randomItem(publicPaths)
    : randomItem(protectedPaths);

  const res = http.get(`${BASE_URL}${path}`, {
    tags: { type: 'spike_read', endpoint: path },
  });

  spikeReadLatency.add(Date.now() - start);

  const ok = check(res, {
    [`Spike read ${path} no 5xx`]: (r) => r.status < 500,
    [`Spike read ${path} status valid`]: (r) =>
      isPublic ? r.status === 200 : (r.status === 401 || r.status === 200),
  });
  readSuccessRate.add(ok);
}

// --- Login attempt (20%) ----------------------------------------------------
function doLogin() {
  const start = Date.now();

  // Mix of random emails with common patterns
  const emailPatterns = [
    randomEmail(),
    `admin@omnivote.test`,
    `analyst@omnivote.test`,
    `field-agent@omnivote.test`,
  ];

  const res = http.post(
    `${BASE_URL}/api/auth`,
    JSON.stringify({
      email: randomItem(emailPatterns),
      password: Math.random() > 0.5 ? 'wrongpassword' : 'password',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'spike_login', endpoint: '/api/auth (POST)' },
    },
  );

  spikeWriteLatency.add(Date.now() - start);

  const ok = check(res, {
    'Spike login no 5xx': (r) => r.status < 500,
    'Spike login expected status': (r) =>
      [200, 401, 429].includes(r.status),
  });
  loginAttemptRate.add(ok);
}

// --- Incident submission (10%) ----------------------------------------------
function doIncident() {
  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/api/incidents`,
    fakeIncidentPayload(),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'spike_incident', endpoint: '/api/incidents (POST)' },
    },
  );

  spikeWriteLatency.add(Date.now() - start);
  incidentCounter.add(1);

  const ok = check(res, {
    'Spike incident no 5xx': (r) => r.status < 500,
    'Spike incident handled': (r) =>
      [200, 201, 401, 400].includes(r.status),
  });
  incidentSubmitRate.add(ok);
}

// --- Main -------------------------------------------------------------------
export default function () {
  const roll = Math.random();

  if (roll < 0.70) {
    doRead();
  } else if (roll < 0.90) {
    doLogin();
  } else {
    doIncident();
  }

  // During spike, shorter think time to maximize pressure
  const thinkTime = __VUs > 100 ? 0.05 : (Math.random() * 0.3 + 0.1);
  sleep(thinkTime);
}
