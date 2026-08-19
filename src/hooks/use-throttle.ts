/**
 * useThrottledCallback — returns a throttled version of a callback.
 *
 * The callback fires immediately on the first call, then at most once
 * per `limitMs` thereafter. Useful for scroll handlers, resize observers,
 * and high-frequency WebSocket event processing.
 *
 * Returns `[throttledFn, cancel]` tuple.
 */

'use client';

import { useRef, useCallback, useMemo } from 'react';

export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limitMs: number,
): [(...args: Parameters<T>) => void, () => void] {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const lastCallRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const throttled = useMemo(() => {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = limitMs - (now - lastCallRef.current);

      if (remaining <= 0) {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else if (timerRef.current === null) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          lastCallRef.current = Date.now();
          callbackRef.current(...args);
        }, remaining);
      }
    };
  }, [limitMs]);

  return [throttled, cancel];
}
