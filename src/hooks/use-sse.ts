/**
 * useSSE — React hook for consuming the Server-Sent Events stream.
 *
 * Replaces React Query polling for real-time data. Components subscribe
 * to specific event types and receive updates instantly via callback.
 *
 * Features:
 *   - Auto-reconnect with exponential backoff
 *   - Pauses when tab is hidden (Page Visibility API)
 *   - Cleans up on unmount
 *   - Falls back to polling if SSE fails
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

type SseHandler = (data: Record<string, unknown>) => void;

interface SseHandlers {
  dashboard?: SseHandler;
  incidents?: SseHandler;
  alerts?: SseHandler;
  agents?: SseHandler;
  results?: SseHandler;
  pvt?: SseHandler;
  evidence?: SseHandler;
  geofence?: SseHandler;
  honeypot?: SseHandler;
  engagement?: SseHandler;
  campaigns?: SseHandler;
  reports?: SseHandler;
  connected?: SseHandler;
  heartbeat?: SseHandler;
}

interface UseSSEOptions {
  /** Event handlers keyed by event type */
  handlers: SseHandlers;
  /** Fallback polling interval in ms when SSE is unavailable (default: 30000) */
  fallbackInterval?: number;
  /** Enable/disable SSE (default: true) */
  enabled?: boolean;
  /** Called when SSE connection state changes */
  onConnectionChange?: (connected: boolean) => void;
}

export function useSSE(tenantId: string | null, { handlers, fallbackInterval = 30000, enabled = true, onConnectionChange }: UseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);
  const onConnectionChangeRef = useRef(onConnectionChange);

  // Keep handlers ref current without re-creating the SSE connection
  useEffect(() => {
    handlersRef.current = handlers;
    onConnectionChangeRef.current = onConnectionChange;
  }, [handlers, onConnectionChange]);

  const connect = useCallback(() => {
    if (!tenantId || !enabled) return;

    // Close any existing connection
    eventSourceRef.current?.close();
    reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);

    const url = `/api/sse?tenantId=${encodeURIComponent(tenantId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // Wire up event listeners for each registered handler
    const eventTypes = Object.keys(handlersRef.current) as Array<keyof SseHandlers>;
    eventTypes.forEach((eventType) => {
      const handler = handlersRef.current[eventType];
      if (handler) {
        es.addEventListener(eventType, (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            handler(data);
          } catch {
            // Ignore parse errors for heartbeats
          }
        });
      }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      onConnectionChangeRef.current?.(false);

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const backoff = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current++;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, backoff);
    };

    es.onopen = () => {
      // Reset backoff on successful connection
      reconnectAttemptRef.current = 0;
      onConnectionChangeRef.current?.(true);

      // Clear fallback polling since SSE is working
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [tenantId, enabled]);

  // Fallback: if SSE hasn't connected after 10s, start polling
  useEffect(() => {
    if (!enabled || !tenantId) return;

    const fallbackTimer = setTimeout(() => {
      if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
        if (!fallbackTimerRef.current) {
          const fetchDashboard = async () => {
            try {
              const res = await fetch(`/api/dashboard?tenantId=${encodeURIComponent(tenantId!)}`);
              if (res.ok) {
                const data = await res.json();
                handlersRef.current.dashboard?.(data);
              }
            } catch {
              // Ignore fetch errors in fallback
            }
          };
          fetchDashboard();
          fallbackTimerRef.current = setInterval(fetchDashboard, fallbackInterval);
        }
      }
    }, 10000);

    return () => clearTimeout(fallbackTimer);
  }, [tenantId, enabled, fallbackInterval]);

  // Pause SSE when tab is hidden to save resources
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      } else {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, connect]);

  // Main effect: connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);
      fallbackTimerRef.current && clearInterval(fallbackTimerRef.current);
    };
  }, [connect]);
}