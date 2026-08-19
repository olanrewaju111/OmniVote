/**
 * useThrottledCallback hook — unit tests
 * Phase 20: Hook test suite
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThrottledCallback } from '@/hooks/use-throttle';

describe('useThrottledCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the callback immediately on first invocation', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current[0]('arg1');
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  it('does not call again within the throttle window', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current[0]('first');
      result.current[0]('second');
      result.current[0]('third');
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls again after throttle window expires', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current[0]('first');
    });

    act(() => { vi.advanceTimersByTime(1000); });

    act(() => {
      result.current[0]('second');
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('trailing call fires after remaining time', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current[0]('immediate'); // fires immediately
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Call again at 500ms (within window)
    act(() => { vi.advanceTimersByTime(500); });
    act(() => {
      result.current[0]('trailing'); // should be scheduled for 500ms later
    });
    expect(callback).toHaveBeenCalledTimes(1); // still 1

    // After remaining 500ms, trailing fires
    act(() => { vi.advanceTimersByTime(500); });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('trailing');
  });

  it('cancel prevents pending trailing call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current[0]('immediate');
    });

    // Queue a trailing call
    act(() => { vi.advanceTimersByTime(500); });
    act(() => {
      result.current[0]('trailing');
    });

    // Cancel
    act(() => {
      result.current[1](); // cancel
    });

    // Advance past the trailing time
    act(() => { vi.advanceTimersByTime(1000); });

    expect(callback).toHaveBeenCalledTimes(1); // trailing was cancelled
  });

  it('always uses the latest callback version', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useThrottledCallback(cb, 1000),
      { initialProps: { cb: callback1 } }
    );

    // First call with callback1
    act(() => { result.current[0](); });
    expect(callback1).toHaveBeenCalledTimes(1);

    // Re-render with new callback
    rerender({ cb: callback2 });

    // Wait for throttle window
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current[0](); });

    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('handles multiple arguments', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current[0](1, 'two', { three: 3 });
    });

    expect(callback).toHaveBeenCalledWith(1, 'two', { three: 3 });
  });
});
