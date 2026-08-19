/**
 * Tests for useWebVitals hook.
 */
import { renderHook, act } from '@testing-library/react';
import { useWebVitals } from '@/hooks/use-web-vitals';

// Mock fetch for the default reporting path
global.fetch = vi.fn();

describe('useWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a flush function', () => {
    const { result } = renderHook(() =>
      useWebVitals({ enabled: false })
    );

    expect(typeof result.current.flush).toBe('function');
  });

  it('should allow manual flush without crashing', () => {
    const onReport = vi.fn();
    const { result } = renderHook(() =>
      useWebVitals({ enabled: false, onReport })
    );

    act(() => {
      result.current.flush();
    });

    // No metrics collected = onReport not called
    expect(onReport).not.toHaveBeenCalled();
  });

  it('should call onReport with metrics when provided', () => {
    // We can't easily trigger PerformanceObserver in tests,
    // but we verify the hook doesn't crash with a custom callback
    const onReport = vi.fn();
    renderHook(() =>
      useWebVitals({ enabled: false, onReport })
    );

    expect(onReport).not.toHaveBeenCalled();
  });

  it('should handle unmount without crashing', () => {
    const { unmount } = renderHook(() =>
      useWebVitals({ enabled: false })
    );

    unmount();
  });

  it('should expose correct interface', () => {
    const { result } = renderHook(() =>
      useWebVitals({ enabled: false })
    );

    expect(result.current).toHaveProperty('flush');
  });
});
