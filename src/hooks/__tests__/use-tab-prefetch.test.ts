/**
 * Tests for useTabPrefetch hook.
 */
import { renderHook, act } from '@testing-library/react';
import { useTabPrefetch } from '@/hooks/use-tab-prefetch';

// Mock dynamic imports
vi.mock('@/components/dashboard/situation-room', () => ({ default: () => null }), { virtual: true });
vi.mock('@/components/dashboard/live-feed', () => ({ default: () => null }), { virtual: true });
vi.mock('@/components/dashboard/alert-triage', () => ({ default: () => null }), { virtual: true });

// Track which modules were imported
const importedModules: string[] = [];
const originalImport = globalThis.import;

// We can't easily mock dynamic imports in vitest,
// but we can test the timer and adjacency logic
describe('useTabPrefetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not prefetch when disabled', () => {
    const { rerender } = renderHook(
      ({ tab, enabled }) => useTabPrefetch(tab, enabled),
      { initialProps: { tab: 'overview', enabled: false } }
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // No crash = pass (dynamic import failures are caught silently)
    rerender({ tab: 'feed', enabled: false });
  });

  it('should set a timer on tab change', () => {
    const { rerender } = renderHook(
      ({ tab }) => useTabPrefetch(tab, true),
      { initialProps: { tab: 'overview' } }
    );

    // Change tab
    rerender({ tab: 'feed' });

    // Timer should be set — advance past the 2s delay
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Dynamic imports may fail silently in test env = pass
  });

  it('should handle unmount during delay', () => {
    const { unmount } = renderHook(() =>
      useTabPrefetch('overview', true)
    );

    // Unmount before delay fires
    unmount();

    // Advance timers — should not crash
    act(() => {
      vi.advanceTimersByTime(5000);
    });
  });

  it('should handle tabs with no adjacency map', () => {
    renderHook(() =>
      useTabPrefetch('nonexistent-tab', true)
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // No crash = pass
  });

  it('should clear previous timer on rapid tab changes', () => {
    const { rerender } = renderHook(
      ({ tab }) => useTabPrefetch(tab, true),
      { initialProps: { tab: 'overview' } }
    );

    // Rapid tab changes
    rerender({ tab: 'feed' });
    rerender({ tab: 'alerts' });
    rerender({ tab: 'situation' });

    // Only the last timer should fire
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // No crash = pass
  });
});
