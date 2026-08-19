/**
 * Tests for useOfflineSubmit hook.
 */
import { renderHook, act } from '@testing-library/react';
import { useOfflineSubmit } from '@/hooks/use-offline-submit';

// Mock the offline-queue module
vi.mock('@/lib/offline-queue', () => ({
  enqueue: vi.fn().mockResolvedValue(1),
  getQueueSize: vi.fn().mockResolvedValue(3),
}));

import { enqueue, getQueueSize } from '@/lib/offline-queue';

const mockedEnqueue = vi.mocked(enqueue);
const mockedGetQueueSize = vi.mocked(getQueueSize);

describe('useOfflineSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should submit directly when online', async () => {
    const successFn = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    const { result } = renderHook(() =>
      useOfflineSubmit({
        url: '/api/test',
        onSuccess: successFn,
      })
    );

    let response;
    await act(async () => {
      response = await result.current.submit({ name: 'test' });
    });

    expect(response).toEqual({ ok: true, queued: false, data: { id: 1 } });
    expect(successFn).toHaveBeenCalledWith({ id: 1 });
    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });
  });

  it('should queue when offline (navigator.onLine = false)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    const { result } = renderHook(() =>
      useOfflineSubmit({ url: '/api/test' })
    );

    let response;
    await act(async () => {
      response = await result.current.submit({ name: 'test' });
    });

    expect(response).toEqual({ ok: true, queued: true });
    expect(mockedEnqueue).toHaveBeenCalledWith({
      url: '/api/test',
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
      contentType: 'application/json',
    });
    expect(result.current.isQueued).toBe(true);
    expect(result.current.queueSize).toBe(3); // from mock

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('should call onError on fetch failure', async () => {
    const errorFn = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Bad Request' }),
      status: 400,
    });

    const { result } = renderHook(() =>
      useOfflineSubmit({
        url: '/api/test',
        onError: errorFn,
      })
    );

    let response;
    await act(async () => {
      response = await result.current.submit({ name: 'test' });
    });

    expect(response.ok).toBe(false);
    expect(errorFn).toHaveBeenCalled();
  });

  it('should handle custom method and content type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() =>
      useOfflineSubmit({
        url: '/api/test',
        method: 'PUT',
        contentType: 'application/xml',
      })
    );

    await act(async () => {
      await result.current.submit('<data/>');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('<data/>'),
    });
  });

  it('should refresh queue size', async () => {
    const { result } = renderHook(() =>
      useOfflineSubmit({ url: '/api/test' })
    );

    await act(async () => {
      await result.current.refreshQueueSize();
    });

    expect(mockedGetQueueSize).toHaveBeenCalled();
  });

  it('should set isSubmitting to false after completion', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() =>
      useOfflineSubmit({ url: '/api/test' })
    );

    await act(async () => {
      await result.current.submit({});
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
