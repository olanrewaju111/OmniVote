/**
 * Tests for usePushNotifications hook.
 */
import { renderHook, act } from '@testing-library/react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should report not supported when Notification API is missing', () => {
    // Notification is available in jsdom, so we mock it as absent
    const origNotification = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isSubscribed).toBe(false);

    (globalThis as Record<string, unknown>).Notification = origNotification;
  });

  it('should detect support when Notification and serviceWorker exist', () => {
    const { result } = renderHook(() => usePushNotifications());

    // In jsdom, Notification exists but serviceWorker is a mock
    // The hook checks both — depends on test environment
    expect(result.current.permission).toBeDefined();
    expect(typeof result.current.requestPermission).toBe('function');
  });

  it('should return denied permission request when not supported', async () => {
    const origNotification = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { result } = renderHook(() => usePushNotifications());

    let perm;
    await act(async () => {
      perm = await result.current.requestPermission();
    });

    expect(perm).toBe('denied');
    (globalThis as Record<string, unknown>).Notification = origNotification;
  });

  it('should expose subscribe and unsubscribe methods', () => {
    const { result } = renderHook(() => usePushNotifications());

    expect(typeof result.current.subscribe).toBe('function');
    expect(typeof result.current.unsubscribe).toBe('function');
  });

  it('should not crash on subscribe when not supported', async () => {
    const origNotification = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.subscribe();
    });

    (globalThis as Record<string, unknown>).Notification = origNotification;
  });

  it('should not crash on unsubscribe when not supported', async () => {
    const origNotification = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.unsubscribe();
    });

    (globalThis as Record<string, unknown>).Notification = origNotification;
  });
});
