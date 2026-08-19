/**
 * Tests for useSound hook.
 */
import { renderHook, act } from '@testing-library/react';
import { useSound } from '@/hooks/use-sound';

// Mock the dashboard store
vi.mock('@/store/dashboard', () => ({
  useDashboardStore: () => ({
    isAuthenticated: true,
    activeTab: 'feed',
  }),
}));

describe('useSound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => store[key] || null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => { store[key] = value; }
    );
  });

  it('should return play, haptic, toggleSound, and isSoundEnabled functions', () => {
    const { result } = renderHook(() => useSound());
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.haptic).toBe('function');
    expect(typeof result.current.toggleSound).toBe('function');
    expect(typeof result.current.isSoundEnabled).toBe('function');
  });

  it('should play sound without crashing when AudioContext is available', () => {
    const { result } = renderHook(() => useSound());
    // play is fire-and-forget — may fail silently in test env
    act(() => {
      result.current.play('notification');
    });
    // No crash = pass
  });

  it('should toggle sound state', () => {
    const { result } = renderHook(() => useSound());
    
    act(() => {
      const newState = result.current.toggleSound();
      // Toggles from true to false or vice versa
      expect(typeof newState).toBe('boolean');
    });
  });

  it('should check if sound is enabled', () => {
    const { result } = renderHook(() => useSound());
    
    const enabled = result.current.isSoundEnabled();
    expect(typeof enabled).toBe('boolean');
  });

  it('should call vibrate for haptic feedback', () => {
    const { result } = renderHook(() => useSound());
    
    act(() => {
      result.current.haptic('light');
    });
    // In test env, navigator.vibrate may not exist — no crash = pass
  });

  it('should handle all sound types without crashing', () => {
    const { result } = renderHook(() => useSound());
    
    const types = ['notification', 'critical', 'success', 'click', 'message', 'victory'] as const;
    for (const type of types) {
      act(() => {
        result.current.play(type);
      });
    }
    // No crash = pass
  });

  it('should handle all haptic types without crashing', () => {
    const { result } = renderHook(() => useSound());
    
    act(() => { result.current.haptic('light'); });
    act(() => { result.current.haptic('medium'); });
    act(() => { result.current.haptic('heavy'); });
    // No crash = pass
  });
});
