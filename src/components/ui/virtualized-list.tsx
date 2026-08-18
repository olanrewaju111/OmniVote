/**
 * VirtualizedList — A reusable virtualized list component.
 * Renders only visible items (+ overscan) in a fixed-height scroll container,
 * drastically reducing DOM nodes for lists of 100+ items.
 *
 * Usage:
 * ```tsx
 * <VirtualizedList
 *   items={myLargeArray}
 *   itemHeight={56}
 *   containerHeight={400}
 *   getKey={(item) => item.id}
 *   renderItem={({ item, index }) => <div>{item.name}</div>}
 * />
 * ```
 */

'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  /** Full array of data items */
  items: T[];
  /** Fixed height of each row in px */
  itemHeight: number;
  /** Height of the scroll container in px */
  containerHeight?: number;
  /** Number of extra items rendered above/below the viewport */
  overscan?: number;
  /** Extract a unique key from each item */
  getKey: (item: T, index: number) => string;
  /** Render function for each visible item */
  renderItem: (props: { item: T; index: number; style: React.CSSProperties }) => React.ReactNode;
  /** Optional className for the outer container */
  className?: string;
  /** Optional className for each item row */
  itemClassName?: string;
  /** Empty state when items.length === 0 */
  emptyContent?: React.ReactNode;
  /** Header content rendered above the scroll area (not virtualized) */
  header?: React.ReactNode;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight: externalHeight,
  overscan = 5,
  getKey,
  renderItem,
  className,
  itemClassName,
  emptyContent,
  header,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const containerHeight = externalHeight || measuredHeight;
  const totalHeight = items.length * itemHeight;

  const { startIndex, endIndex } = useMemo(() => {
    if (containerHeight <= 0) return { startIndex: 0, endIndex: 0 };
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    return {
      startIndex: Math.max(0, start - overscan),
      endIndex: Math.min(items.length - 1, start + visibleCount + overscan),
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const result: Array<{ item: T; index: number; key: string; offsetTop: number }> = [];
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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Auto-measure container height
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (node && !externalHeight) {
      setMeasuredHeight(node.clientHeight);
    }
  }, [externalHeight]);

  // Reset scroll when list shrinks (e.g. filter change)
  const prevLengthRef = useRef(items.length);
  if (items.length < prevLengthRef.current) {
    // We intentionally check and reset in render to avoid stale closures
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      setScrollTop(0);
    });
  }
  prevLengthRef.current = items.length;

  if (items.length === 0) {
    return <div className={className}>{emptyContent}</div>;
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {header}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-auto relative"
        style={{ height: containerHeight || '100%', minHeight: 200 }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map(({ item, index, key, offsetTop }) => (
            <div
              key={key}
              className={itemClassName}
              style={{
                position: 'absolute',
                top: offsetTop,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem({ item, index, style: { height: itemHeight } })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized virtual list item wrapper.
 * Use this to wrap individual items when they are complex.
 */
export const MemoizedVirtualItem = React.memo(function MemoizedVirtualItem({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
});
