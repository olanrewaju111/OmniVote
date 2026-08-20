/**
 * useMemoizedCallback hook — unit tests
 * Phase 20: Hook test suite
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoizedCallback } from '@/hooks/use-memoized-callback';

describe('useMemoizedCallback', () => {
  it('returns a stable function reference across re-renders', () => {
    const callback = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useMemoizedCallback(cb),
      { initialProps: { cb: callback } }
    );

    const firstRef = result.current;
    rerender({ cb: callback });
    const secondRef = result.current;
    rerender({ cb: callback });
    const thirdRef = result.current;

    // Reference should be stable
    expect(firstRef).toBe(secondRef);
    expect(secondRef).toBe(thirdRef);
  });

  it('always calls the latest version of the function', () => {
    const fn1 = vi.fn(() => 'first');
    const fn2 = vi.fn(() => 'second');
    const fn3 = vi.fn(() => 'third');

    const { result, rerender } = renderHook(
      ({ cb }) => useMemoizedCallback(cb),
      { initialProps: { cb: fn1 } }
    );

    act(() => { result.current(); });
    expect(fn1).toHaveBeenCalledTimes(1);

    rerender({ cb: fn2 });
    act(() => { result.current(); });
    expect(fn2).toHaveBeenCalledTimes(1);

    rerender({ cb: fn3 });
    act(() => { result.current(); });
    expect(fn3).toHaveBeenCalledTimes(1);
  });

  it('passes arguments through to the latest function', () => {
    const callback = vi.fn((a: number, b: string) => `${a}-${b}`);
    const { result } = renderHook(() => useMemoizedCallback(callback));

    let returnValue: string;
    act(() => {
      returnValue = result.current(42, 'hello');
    });

    expect(callback).toHaveBeenCalledWith(42, 'hello');
    expect(returnValue).toBe('42-hello');
  });

  it('handles function that returns undefined', () => {
    const callback = vi.fn(() => undefined);
    const { result } = renderHook(() => useMemoizedCallback(callback));

    let returnValue: unknown;
    act(() => {
      returnValue = result.current();
    });

    expect(returnValue).toBeUndefined();
  });
});
