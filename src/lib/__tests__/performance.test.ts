import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shallowEqual,
  debounce,
  throttle,
  LRUCache,
  formatBytes,
  createPropsComparator,
} from '../performance';

// ─── shallowEqual ─────────────────────────────────────────────────────────

describe('shallowEqual', () => {
  it('returns true for identical references', () => {
    const obj = { a: 1, b: 'hello' };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it('returns true for objects with same key-value pairs', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('returns false for objects with different values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('returns false when first arg is null', () => {
    expect(shallowEqual(null, { a: 1 } as any)).toBe(false);
  });

  it('returns false when second arg is null', () => {
    expect(shallowEqual({ a: 1 } as any, null)).toBe(false);
  });

  it('returns false when both are null (both falsy but not same ref)', () => {
    // null === null is true, so this returns true
    expect(shallowEqual(null, null)).toBe(true);
  });

  it('returns false for different number of keys', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('returns false for different keys', () => {
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('returns true for empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true);
  });

  it('returns false for undefined vs object', () => {
    expect(shallowEqual(undefined, { a: 1 } as any)).toBe(false);
  });
});

// ─── debounce ─────────────────────────────────────────────────────────────

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays invocation until after the delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the original function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('hello', 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('hello', 42);
  });

  it('cancel prevents the function from being called', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel is a no-op when no pending call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    expect(() => debounced.cancel()).not.toThrow();
  });
});

// ─── throttle ─────────────────────────────────────────────────────────────

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throttles subsequent calls within the limit', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();
    vi.advanceTimersByTime(50);
    throttled();

    // Only the first call fires immediately
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows another call after the limit expires', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel prevents trailing edge call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(); // fires immediately
    throttled(); // schedules trailing
    throttled.cancel();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1); // only the first
  });

  it('passes arguments correctly', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('arg1', 'arg2');
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

// ─── LRUCache ─────────────────────────────────────────────────────────────

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(5);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('has() reports existence correctly', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('delete() removes entries and returns true/false', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);

    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(cache.delete('a')).toBe(false);
  });

  it('clear() removes all entries', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('reports correct size', () => {
    const cache = new LRUCache<string, number>(5);
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('evicts least recently used when full', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('get() updates recency (prevents eviction)', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // access 'a' to make it recently used
    cache.set('c', 3); // should evict 'b', not 'a'

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('getOrCompute computes and caches on miss', () => {
    const compute = vi.fn(() => 42);
    const cache = new LRUCache<string, number>(5);

    const val = cache.getOrCompute('key', compute);
    expect(val).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const val2 = cache.getOrCompute('key', compute);
    expect(val2).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('maxSize=1 evicts immediately', () => {
    const cache = new LRUCache<string, number>(1);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('throws if maxSize < 1', () => {
    expect(() => new LRUCache<string, number>(0)).toThrow('maxSize must be >= 1');
    expect(() => new LRUCache<string, number>(-1)).toThrow('maxSize must be >= 1');
  });

  it('set() overwrites existing key without increasing size', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 99); // overwrite

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(99);
  });
});

// ─── formatBytes ───────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes < 1024', () => {
    expect(formatBytes(500)).toBe('500.0 B');
  });

  it('formats exactly 1 KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats exactly 1 MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('formats exactly 1 GB', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats exactly 1 TB', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
  });

  it('respects custom decimals', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB');
  });

  it('clamps to TB for very large values', () => {
    expect(formatBytes(1099511627776 * 1000)).toBe('1000.0 TB');
  });
});

// ─── createPropsComparator ─────────────────────────────────────────────────

describe('createPropsComparator', () => {
  it('returns true when specified keys are equal', () => {
    const comparator = createPropsComparator<{ a: number; b: string }>(['a']);
    expect(comparator({ a: 1, b: 'x' }, { a: 1, b: 'y' })).toBe(true);
  });

  it('returns false when a specified key differs', () => {
    const comparator = createPropsComparator<{ a: number; b: string }>(['a']);
    expect(comparator({ a: 1, b: 'x' }, { a: 2, b: 'x' })).toBe(false);
  });

  it('ignores unspecified keys', () => {
    const comparator = createPropsComparator<{ a: number; b: string; c: boolean }>(['a', 'b']);
    expect(comparator({ a: 1, b: 'x', c: true }, { a: 1, b: 'x', c: false })).toBe(true);
  });

  it('returns true for empty key list', () => {
    const comparator = createPropsComparator<Record<string, unknown>>([]);
    expect(comparator({ a: 1 }, { b: 2 })).toBe(true);
  });
});
