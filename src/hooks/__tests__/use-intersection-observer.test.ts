/**
 * useIntersectionObserver hook — unit tests
 * Phase 20: Hook test suite
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';

describe('useIntersectionObserver', () => {
  it('returns ref and isIntersecting', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(result.current).toHaveProperty('ref');
    expect(result.current).toHaveProperty('isIntersecting');
    expect(typeof result.current.isIntersecting).toBe('boolean');
  });

  it('starts with isIntersecting as false', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(result.current.isIntersecting).toBe(false);
  });

  it('ref is a function (callback ref)', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(typeof result.current.ref).toBe('function');
  });

  it('accepts custom options', () => {
    const { result } = renderHook(() =>
      useIntersectionObserver({
        rootMargin: '100px',
        threshold: 0.5,
        triggerOnce: true,
      })
    );

    expect(result.current.isIntersecting).toBe(false);
    expect(typeof result.current.ref).toBe('function');
  });

  it('does not throw when ref is set to null', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(() => {
      result.current.ref(null);
    }).not.toThrow();
  });
});
