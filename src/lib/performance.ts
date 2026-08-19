/**
 * Phase 10: Performance Optimization Utilities
 *
 * Shared utility functions for React render optimization,
 * debounce/throttle, LRU caching, and memoization helpers.
 */

// ─── Shallow Equality ──────────────────────────────────────────────────────

/**
 * Performs a shallow comparison of two objects.
 * Returns true if all own enumerable properties are referentially equal.
 */
export function shallowEqual<T extends Record<string, unknown>>(
  a: T | null | undefined,
  b: T | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

// ─── Props Comparator Factory ──────────────────────────────────────────────

/**
 * Creates a custom areEqual comparator for React.memo that only compares
 * the specified prop keys. Props not listed are ignored (treated as equal).
 *
 * Usage:
 *   const MyCompMemo = React.memo(MyComp, createPropsComparator(['data', 'onSelect']));
 */
export function createPropsComparator<T extends Record<string, unknown>>(
  keys: (keyof T)[]
): (prev: T, next: T) => boolean {
  const keySet = new Set(keys as string[]);
  return (prev: T, next: T) => {
    for (const key of keySet) {
      if (prev[key] !== next[key]) return false;
    }
    return true;
  };
}

// ─── Debounce ───────────────────────────────────────────────────────────────

/**
 * Creates a debounced version of `fn` that delays invocation by `delayMs`.
 * The timer resets on every call. Returns a function with a `.cancel()` method.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced;
}

// ─── Throttle ───────────────────────────────────────────────────────────────

/**
 * Creates a throttled version of `fn` that invokes at most once per `limitMs`.
 * Uses leading-edge invocation (fires immediately on first call).
 * Returns a function with a `.cancel()` method.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastCall = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = limitMs - (now - lastCall);

    if (remaining <= 0) {
      // Leading edge: call immediately
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (timerId === null) {
      // Schedule trailing edge call
      timerId = setTimeout(() => {
        timerId = null;
        lastCall = Date.now();
        fn(...args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return throttled;
}

// ─── LRU Cache ──────────────────────────────────────────────────────────────

/**
 * A lightweight generic LRU (Least Recently Used) cache.
 *
 * Usage:
 *   const cache = new LRUCache<string, User>(100);
 *   cache.set('user-1', userObj);
 *   const user = cache.get('user-1');
 */
export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly cache = new Map<K, V>();

  constructor(maxSize: number) {
    if (maxSize < 1) throw new Error('LRUCache maxSize must be >= 1');
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /**
 * Get or compute. If the key is missing, calls `fn` to produce the value,
 * caches it, and returns it.
   */
  getOrCompute(key: K, fn: () => V): V {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = fn();
    this.set(key, value);
    return value;
  }
}

// ─── Format Bytes ───────────────────────────────────────────────────────────

/**
 * Formats a byte count into a human-readable string.
 * e.g. 1024 → '1.0 KB', 1048576 → '1.0 MB'
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  return `${(bytes / Math.pow(k, safeIndex)).toFixed(decimals)} ${sizes[safeIndex]}`;
}
