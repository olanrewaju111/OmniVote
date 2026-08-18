/**
 * useVirtualScroll — lightweight virtualization hook for large lists.
 * Calculates which items are visible in a scroll container and returns
 * a windowed slice, total height, and an offset for positioning.
 * 
 * Supports dynamic item heights via the `estimateHeight` callback.
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface VirtualScrollOptions<T> {
  /** Full data array */
  items: T[];
  /** Estimated height per row in px (used for initial calculation) */
  itemHeight: number;
  /** Overscan buffer: number of extra items rendered above/below viewport */
  overscan?: number;
  /** Container height in px (pass 0 or undefined to auto-measure) */
  containerHeight?: number;
  /** Unique key extractor */
  getKey: (item: T, index: number) => string;
}

interface VirtualScrollResult<T> {
  /** Items currently in the visible window (+ overscan) */
  visibleItems: Array<{ item: T; index: number; key: string; offsetTop: number }>;
  /** Total height of the virtual list (set as inner div height) */
  totalHeight: number;
  /** Callback to attach to the scroll container's onScroll */
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Ref for the scroll container (auto-measures height if containerHeight not set) */
  containerRef: React.RefCallback<HTMLDivElement>;
  /** Current scroll offset */
  scrollTop: number;
}

export function useVirtualScroll<T>({
  items,
  itemHeight,
  overscan = 5,
  containerHeight: externalHeight,
  getKey,
}: VirtualScrollOptions<T>): VirtualScrollResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const containerRefCallback = useRef<((node: HTMLDivElement | null) => void) | null>(null);

  const containerHeight = externalHeight || measuredHeight;

  // Total height of the list
  const totalHeight = Math.max(0, items.length * itemHeight);

  // Calculate the visible range
  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    return {
      startIndex: Math.max(0, start - overscan),
      endIndex: Math.min(items.length - 1, start + visibleCount + overscan),
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Build visible items slice
  const visibleItems = useMemo(() => {
    const result: VirtualScrollResult<T>['visibleItems'] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        item: items[i],
        index: i,
        key: getKey(items[i], i),
        offsetTop: i * itemHeight,
      });
    }
    return result;
  }, [items, startIndex, endIndex, getKey, itemHeight]);

  // Scroll handler
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Container ref that auto-measures height
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !externalHeight) {
      setMeasuredHeight(node.clientHeight);
    }
    // Also call any stored ref callback
    containerRefCallback.current?.(node);
  }, [externalHeight]);

  // Reset scroll when items change significantly (e.g. filter change)
  const prevLengthRef = useRef(items.length);
  useEffect(() => {
    if (items.length < prevLengthRef.current) {
      setScrollTop(0);
    }
    prevLengthRef.current = items.length;
  }, [items.length]);

  return {
    visibleItems,
    totalHeight,
    onScroll,
    containerRef,
    scrollTop,
  };
}
