/**
 * Brute-force login protection with escalating lockouts.
 *
 * In-memory tracker that locks accounts after repeated failed login attempts.
 * Lockout durations escalate: 5 failures → 15 min, 10 → 30 min, 15 → 60 min.
 * Stale entries are auto-cleaned every 10 minutes.
 *
 * In production, replace the Map with Redis for multi-instance persistence.
 */

// ─── Types ───────────────────────────────────────────────────────────────

interface AttemptRecord {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}

export interface LoginCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil: number | null;
  retryAfterMs: number;
}

// ─── Configuration ────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/** Escalating lockout tiers: [threshold, lockoutMs] */
const LOCKOUT_TIERS: Array<[number, number]> = [
  [5, 15 * 60 * 1000],   // 5 attempts → 15 minutes
  [10, 30 * 60 * 1000],  // 10 attempts → 30 minutes
  [15, 60 * 60 * 1000],  // 15 attempts → 60 minutes
];

function getLockoutDuration(attempts: number): number {
  let duration = LOCKOUT_TIERS[0][1]; // default 15 min
  for (const [threshold, lockoutMs] of LOCKOUT_TIERS) {
    if (attempts >= threshold) {
      duration = lockoutMs;
    }
  }
  return duration;
}

// ─── In-memory store ─────────────────────────────────────────────────────

const store = new Map<string, AttemptRecord>();
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of store) {
    // Remove entries that are not locked and haven't been used recently (past 30 min)
    const staleThreshold = 30 * 60 * 1000;
    if (record.lockedUntil <= now && now - record.lastAttempt > staleThreshold) {
      store.delete(key);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Check whether a login attempt is allowed for the given identifier.
 */
export function checkLoginAttempt(identifier: string): LoginCheckResult {
  cleanup();

  const key = identifier.toLowerCase();
  const record = store.get(key);
  const now = Date.now();

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null, retryAfterMs: 0 };
  }

  // Check if currently locked
  if (record.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
      retryAfterMs: record.lockedUntil - now,
    };
  }

  // Lock period has expired — reset attempts
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    store.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null, retryAfterMs: 0 };
  }

  // Not locked — calculate remaining attempts
  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return {
    allowed: true,
    remainingAttempts: remaining,
    lockedUntil: null,
    retryAfterMs: 0,
  };
}

/**
 * Record a failed login attempt. Increments the counter and locks if threshold reached.
 */
export function recordFailedAttempt(identifier: string): void {
  cleanup();

  const key = identifier.toLowerCase();
  const existing = store.get(key);
  const now = Date.now();
  const newAttempts = (existing?.attempts ?? 0) + 1;

  // Determine if we should lock/escalate
  let lockedUntil = existing?.lockedUntil ?? 0;
  if (newAttempts >= MAX_ATTEMPTS) {
    const newLockEnd = now + getLockoutDuration(newAttempts);
 // Always take the maximum: extend lockout if escalated tier is longer
    lockedUntil = Math.max(lockedUntil, newLockEnd);
  }

  store.set(key, {
    attempts: newAttempts,
    lockedUntil,
    lastAttempt: now,
  });
}

/**
 * Record a successful login — clears the failure counter.
 */
export function recordSuccessfulLogin(identifier: string): void {
  const key = identifier.toLowerCase();
  store.delete(key);
}

/**
 * Check if an account is currently locked.
 */
export function isAccountLocked(identifier: string): boolean {
  const key = identifier.toLowerCase();
  const record = store.get(key);
  if (!record) return false;
  return record.lockedUntil > Date.now();
}

// ─── Testing helpers (exported for test cleanup) ─────────────────────────

/**
 * Clear all entries. Only intended for use in tests.
 */
export function _clearStore(): void {
  store.clear();
}

/**
 * Get the raw store entry. Only intended for use in tests.
 */
export function _getStore(): Map<string, AttemptRecord> {
  return store;
}
