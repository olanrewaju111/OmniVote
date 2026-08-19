/**
 * useIsMobile hook — unit tests
 * Phase 20: Hook test suite
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

describe('useIsMobile', () => {
  let originalInnerWidth: number;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    // Mock matchMedia to actually use window.innerWidth
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const match = query.match(/\(max-width:\s*(\d+)px\)/);
      const maxWidth = match ? parseInt(match[1], 10) : Infinity;
      return {
        matches: window.innerWidth < maxWidth,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('returns a boolean', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe('boolean');
  });

  it('returns false for desktop viewport (1024px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true for mobile viewport (375px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('handles boundary value (767 = mobile)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 767, configurable: true });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('handles boundary value (768 = desktop)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
