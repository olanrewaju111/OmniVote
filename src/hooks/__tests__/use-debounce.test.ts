/**
 * useDebounce hook — unit tests
 * Phase 20: Hook test suite
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('returns the same value until delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    // Update value
    rerender({ value: 'updated', delay: 500 });

    // Before delay: still old value
    expect(result.current).toBe('initial');

    // Advance past delay
    act(() => { vi.advanceTimersByTime(500); });

    // After delay: new value
    expect(result.current).toBe('updated');
  });

  it('resets timer when value changes before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } }
    );

    // Update to 'b' after 200ms
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: 'b', delay: 500 });

    // Only 300ms more isn't enough (need 500ms from 'b')
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('a');

    // After 200ms more (500ms total from 'b')
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('b');
  });

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    rerender({ value: 42, delay: 300 });
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current).toBe(42);
  });

  it('works with object values', () => {
    const obj = { filter: 'test', page: 1 };
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj, delay: 100 } }
    );

    const newObj = { filter: 'updated', page: 2 };
    rerender({ value: newObj, delay: 100 });
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current).toEqual(newObj);
  });

  it('handles delay of 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'start', delay: 0 } }
    );

    rerender({ value: 'instant', delay: 0 });
    // With delay 0, should update on next tick
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe('instant');
  });
});
