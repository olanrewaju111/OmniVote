/**
 * useDebounce — debounces a value by the specified delay.
 * Useful for search inputs, filter controls, and resize handlers.
 */

'use client';

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
