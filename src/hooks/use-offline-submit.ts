'use client';

import { useCallback, useState } from 'react';
import { enqueue, getQueueSize, type QueuedSubmission } from '@/lib/offline-queue';

interface UseOfflineSubmitOptions {
  url: string;
  method?: string;
  contentType?: string;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook that wraps form submissions with offline queue support.
 * When online, submits directly. When offline, queues in IndexedDB
 * and registers a background sync event for when connectivity returns.
 */
export function useOfflineSubmit<T = unknown>(options: UseOfflineSubmitOptions) {
  const { url, method = 'POST', contentType = 'application/json', onSuccess, onError } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  const submit = useCallback(async (data: T): Promise<{ ok: boolean; queued: boolean; data?: unknown; error?: string }> => {
    setIsSubmitting(true);
    setIsQueued(false);

    const body = JSON.stringify(data);

    if (!navigator.onLine) {
      // Offline: queue for later
      try {
        await enqueue({ url, method, body, contentType });
        const size = await getQueueSize();
        setQueueSize(size);
        setIsQueued(true);
        return { ok: true, queued: true };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to queue submission');
        onError?.(error);
        return { ok: false, queued: false, error: error.message };
      } finally {
        setIsSubmitting(false);
      }
    }

    // Online: submit directly
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.ok) {
        const responseData = await res.json().catch(() => null);
        onSuccess?.(responseData);
        return { ok: true, queued: false, data: responseData };
      } else {
        const errorData = await res.json().catch(() => null);
        const error = new Error(errorData?.error || `Request failed with status ${res.status}`);
        onError?.(error);
        return { ok: false, queued: false, error: error.message };
      }
    } catch (err) {
      // Network error — try to queue
      if (err instanceof TypeError && err.message.includes('fetch')) {
        try {
          await enqueue({ url, method, body, contentType });
          const size = await getQueueSize();
          setQueueSize(size);
          setIsQueued(true);
          return { ok: true, queued: true };
        } catch {
          // Queue also failed
        }
      }
      const error = err instanceof Error ? err : new Error('Submission failed');
      onError?.(error);
      return { ok: false, queued: false, error: error.message };
    } finally {
      setIsSubmitting(false);
    }
  }, [url, method, contentType, onSuccess, onError]);

  const refreshQueueSize = useCallback(async () => {
    try {
      const size = await getQueueSize();
      setQueueSize(size);
    } catch {
      // IndexedDB not available
    }
  }, []);

  return {
    submit,
    isSubmitting,
    isQueued,
    queueSize,
    refreshQueueSize,
  };
}
