import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkLoginAttempt,
  recordFailedAttempt,
  recordSuccessfulLogin,
  isAccountLocked,
  _clearStore,
  _getStore,
} from '../brute-force';

beforeEach(() => {
  _clearStore();
});

describe('Brute-force login protection', () => {
  describe('checkLoginAttempt', () => {
    it('should allow first attempt', () => {
      const result = checkLoginAttempt('user@test.com');
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
      expect(result.lockedUntil).toBeNull();
      expect(result.retryAfterMs).toBe(0);
    });

    it('should be case-insensitive', () => {
      recordFailedAttempt('User@Test.com');
      const result = checkLoginAttempt('user@test.com');
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(4);
    });
  });

  describe('lockout after 5 attempts', () => {
    it('should lock after 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt('test@example.com');
      }
      const result = checkLoginAttempt('test@example.com');
      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(result.lockedUntil).not.toBeNull();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should have remaining attempts decrease from 5 to 0', () => {
      const email = 'counter@example.com';
      expect(checkLoginAttempt(email).remainingAttempts).toBe(5);

      recordFailedAttempt(email);
      expect(checkLoginAttempt(email).remainingAttempts).toBe(4);

      recordFailedAttempt(email);
      expect(checkLoginAttempt(email).remainingAttempts).toBe(3);

      recordFailedAttempt(email);
      expect(checkLoginAttempt(email).remainingAttempts).toBe(2);

      recordFailedAttempt(email);
      expect(checkLoginAttempt(email).remainingAttempts).toBe(1);
    });
  });

  describe('escalation', () => {
    it('should escalate lockout: 5 attempts = 15 min', () => {
      const email = 'escalate@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(email);
      }
      const result = checkLoginAttempt(email);
      expect(result.retryAfterMs).toBeGreaterThan(14 * 60 * 1000);
      expect(result.retryAfterMs).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('should escalate lockout: 10 attempts = 30 min', () => {
      const email = 'escalate2@example.com';
      for (let i = 0; i < 10; i++) {
        recordFailedAttempt(email);
      }
      const result = checkLoginAttempt(email);
      expect(result.retryAfterMs).toBeGreaterThan(29 * 60 * 1000);
      expect(result.retryAfterMs).toBeLessThanOrEqual(30 * 60 * 1000);
    });

    it('should escalate lockout: 15 attempts = 60 min', () => {
      const email = 'escalate3@example.com';
      for (let i = 0; i < 15; i++) {
        recordFailedAttempt(email);
      }
      const result = checkLoginAttempt(email);
      expect(result.retryAfterMs).toBeGreaterThan(59 * 60 * 1000);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('should clear the counter on successful login', () => {
      const email = 'success@example.com';
      for (let i = 0; i < 4; i++) {
        recordFailedAttempt(email);
      }
      expect(checkLoginAttempt(email).remainingAttempts).toBe(1);

      recordSuccessfulLogin(email);
      expect(checkLoginAttempt(email).remainingAttempts).toBe(5);
    });

    it('should unlock a locked account on successful login', () => {
      const email = 'unlock@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(email);
      }
      expect(isAccountLocked(email)).toBe(true);

      recordSuccessfulLogin(email);
      expect(isAccountLocked(email)).toBe(false);
      expect(checkLoginAttempt(email).allowed).toBe(true);
    });
  });

  describe('isAccountLocked', () => {
    it('should return false for unknown identifier', () => {
      expect(isAccountLocked('unknown@example.com')).toBe(false);
    });

    it('should return true after 5 failures', () => {
      const email = 'locked@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(email);
      }
      expect(isAccountLocked(email)).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should auto-cleanup stale entries', () => {
      vi.useFakeTimers();

      const email = 'stale@example.com';
      recordFailedAttempt(email);
      expect(_getStore().has(email)).toBe(true);

      // Advance past 30 min stale threshold (cleanup runs every 10 min)
      vi.advanceTimersByTime(31 * 60 * 1000);

      // Trigger a check to run cleanup
      checkLoginAttempt('trigger@example.com');
      expect(_getStore().has(email)).toBe(false);

      vi.useRealTimers();
    });

    it('should not cleanup locked accounts that are still locked', () => {
      vi.useFakeTimers();

      const email = 'locked-stale@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(email);
      }

      // Advance 10 min (cleanup interval) but still within 15 min lockout
      vi.advanceTimersByTime(11 * 60 * 1000);
      checkLoginAttempt('trigger@example.com');
      expect(isAccountLocked(email)).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('lock expiry', () => {
    it('should reset attempts after lockout expires', () => {
      vi.useFakeTimers();

      const email = 'expire@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(email);
      }
      expect(checkLoginAttempt(email).allowed).toBe(false);

      // Advance past the 15 min lockout
      vi.advanceTimersByTime(16 * 60 * 1000);

      const result = checkLoginAttempt(email);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);

      vi.useRealTimers();
    });
  });
});
