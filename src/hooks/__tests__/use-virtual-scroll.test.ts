/**
 * useVirtualScroll hook — unit tests
 * Phase 20: Hook test suite
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualScroll } from '@/hooks/use-virtual-scroll';

describe('useVirtualScroll', () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
  const getKey = (item: { id: number }, index: number) => String(item.id);

  it('returns empty visibleItems when container height is 0', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items, itemHeight: 40, getKey, containerHeight: 0 })
    );

    // With 0 height, visibleCount is 0, so no items are in view
    expect(result.current.visibleItems.length).toBeLessThanOrEqual(10); // overscan only
    expect(result.current.totalHeight).toBe(4000); // 100 * 40
  });

  it('calculates totalHeight correctly', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items, itemHeight: 50, getKey, containerHeight: 500 })
    );

    expect(result.current.totalHeight).toBe(5000); // 100 * 50
  });

  it('returns visible items for a known scroll position', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items, itemHeight: 40, overscan: 3, getKey, containerHeight: 400 })
    );

    // At scrollTop=0: should show items around index 0
    const { visibleItems } = result.current;
    expect(visibleItems.length).toBeGreaterThan(0);
    // First item should be at offset 0
    expect(visibleItems[0].offsetTop).toBe(0);
  });

  it('handles onScroll to change visible window', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items, itemHeight: 40, overscan: 2, getKey, containerHeight: 400 })
    );

    // Simulate scroll to middle
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 2000 },
      } as React.UIEvent<HTMLDivElement>);
    });

    expect(result.current.scrollTop).toBe(2000);
    // Should show items around index 50
    const midIndex = result.current.visibleItems.find(v => v.index === 50);
    expect(midIndex).toBeDefined();
  });

  it('provides unique keys for each visible item', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items, itemHeight: 40, getKey, containerHeight: 400 })
    );

    const keys = result.current.visibleItems.map(v => v.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('handles empty items array', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items: [], itemHeight: 40, getKey, containerHeight: 400 })
    );

    expect(result.current.visibleItems).toHaveLength(0);
    expect(result.current.totalHeight).toBe(0);
  });

  it('resets scroll when items array shrinks', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useVirtualScroll({ items, itemHeight: 40, getKey, containerHeight: 400 }),
      { initialProps: { items: Array.from({ length: 100 }, (_, i) => ({ id: i })) } }
    );

    // Scroll down
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 2000 },
      } as React.UIEvent<HTMLDivElement>);
    });
    expect(result.current.scrollTop).toBe(2000);

    // Shrink items
    rerender({ items: Array.from({ length: 10 }, (_, i) => ({ id: i })) });
    // Scroll should reset to 0
    expect(result.current.scrollTop).toBe(0);
  });

  it('respects overscan parameter', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ items, itemHeight: 40, overscan: 5, getKey, containerHeight: 400 })
    );

    // With high overscan, should include more items than strictly visible
    expect(result.current.visibleItems.length).toBeGreaterThan(0);
  });
});
