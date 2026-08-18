/**
 * useMemoizedCallback — stable callback reference that always calls the latest fn.
 * Combines useRef + useCallback to avoid re-creating child components
 * when callbacks are passed as props, without sacrificing freshness.
 */

'use client';

import { useCallback, useRef, useEffect } from 'react';

type AnyFunction = (...args: any[]) => any;

export function useMemoizedCallback<T extends AnyFunction>(fn: T): T {
  const fnRef = useRef(fn);

  // Always keep the ref up to date without triggering re-renders
  useEffect(() => {
    fnRef.current = fn;
  });

  return useCallback(((...args: any[]) => fnRef.current(...args)) as T, []);
}
