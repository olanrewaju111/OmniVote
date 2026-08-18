/**
 * useIntersectionObserver — observes when an element enters/exits the viewport.
 * Used for lazy-loading off-screen content and infinite scroll triggers.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIntersectionObserverOptions {
  /** Margin around the root (CSS margin syntax) */
  rootMargin?: string;
  /** Visibility threshold (0-1) */
  threshold?: number | number[];
  /** Only trigger once */
  triggerOnce?: boolean;
}

export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionObserverOptions = {}
) {
  const { rootMargin = '200px', threshold = 0, triggerOnce = false } = options;
  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (triggerOnce && triggered.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsIntersecting(visible);
        if (visible && triggerOnce) {
          triggered.current = true;
          observer.unobserve(el);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, triggerOnce]);

  const setRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  return { ref: setRef, isIntersecting };
}
