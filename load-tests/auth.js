// --- OmniVote Auth-Specific Load Test ---------------------------------------
//
// Focuses on authentication endpoints:
// - 90% invalid login attempts (brute force simulation)
// - 10% valid-pattern attempts
// - Tracks rate limiting (429 responses)
// - Monitors lockout behavior
//
// Run:  k6 run load-tests/auth.js
//

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, randomString } from './config.js';

// --- Custom Metrics --------------------------------------------------------
const authSuccessRate = new Rate('auth_success');
const auth401Rate = new Rate('auth_401');
const auth429Rate = new Rate('auth_429');
const auth5xxRate = new Rate('auth_5xx');
const authLatency = new Trend('auth_request_duration');
const lockoutCounter = new Counter('auth_lockouts');
const totalLoginAttempts = new Counter('auth_total_attempts');

// --- Test Options ----------------------------------------------------------
export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    ...THRESHOLDS.auth,
    auth_5xx_rate: ['rate<0.05'],
  },
};

// --- Email pool for testing -------------------------------------------------
// Generates a small pool of emails so rate limiting kicks in
const EMAIL_POOL_SIZE = 10;
const emailPool = Array.from({ length: EMAIL_POOL_SIZE }, (_, i) =>
  `bruteforce-victim-${i + 1}@omnivote.test`,
);

// Valid-looking patterns (10%)
const validPatterns = [
  'admin@omnivote.test',
  'analyst@omnivote.test',
  'field-agent@omnivote.test',
];

// Common weak passwords to try
const weakPasswords = [
  'password',
  '123456',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'qwerty',
  'abc123',
  'login',
  'princess',
  'shadow',
  'sunshine',
  'trustno1',
];

// --- Main -------------------------------------------------------------------
export default function () {
  const start = Date.now();
  totalLoginAttempts.add(1);

  let email;
  let password;

  if (Math.random() < 0.90) {
    // 90% invalid attempts — targeted at a small pool to trigger rate limiting
    email = emailPool[Math.floor(Math.random() * EMAIL_POOL_SIZE)];
    password = randomItem(weakPasswords) + randomString(2);
  } else {
    // 10% valid-pattern attempts
    email = randomItem(validPatterns);
    password = randomItem(weakPasswords);
  }

  const res = http.post(
    `${BASE_URL}/api/auth`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth_test', endpoint: '/api/auth (POST)' },
    },
  );

  const duration = Date.now() - start;
  authLatency.add(duration);

  // Track response categories
  if (res.status === 429) {
    auth429Rate.add(true);
    authSuccessRate.add(true); // 429 is expected behavior, not a failure
    lockoutCounter.add(1);
    check(res, {
      'Auth: rate limited (429)': (r) => r.status === 429,
      'Auth: 429 has Retry-After header': (r) => r.headers['Retry-After'] !== undefined,
    });
  } else if (res.status === 401) {
    auth401Rate.add(true);
    authSuccessRate.add(true);
    check(res, {
      'Auth: invalid credentials (401)': (r) => r.status === 401,
      'Auth: 401 has error message': (r) => {
        try { const body = r.json(); return 'error' in body; } catch { return false; }
      },
    });
  } else if (res.status === 200) {
    authSuccessRate.add(true);
    check(res, {
      'Auth: successful login (200)': (r) => r.status === 200,
    });
  } else if (res.status >= 500) {
    auth5xxRate.add(true);
    authSuccessRate.add(false);
    check(res, {
      'Auth: NO 5xx errors': (r) => r.status < 500,
    });
  }

  // Note: login endpoint has deliberate random delay (500-2000ms) on
  // failed attempts to prevent timing attacks. Think time is minimal.
  sleep(0.1);
}

// --- Helper -----------------------------------------------------------------
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
