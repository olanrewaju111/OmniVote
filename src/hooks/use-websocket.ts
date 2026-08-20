/**
 * useWebSocket — React hook for real-time WebSocket connection.
 * 
 * Manages the WebSocket lifecycle: connect, authenticate, reconnect.
 * Falls back to SSE if WebSocket is unavailable.
 * Provides typed event handlers for all real-time event types.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api';

export interface WsEvent {
  type: string;
  action: string;
  data: unknown;
  tenantId: string;
  timestamp: string;
}

type WsEventHandler = (event: WsEvent) => void;

interface UseWebSocketOptions {
  /** Event handlers keyed by "type:action" or just "type" */
  handlers: Record<string, WsEventHandler>;
  /** Enable WebSocket connection (default: true) */
  enabled?: boolean;
  /** Called when connection state changes */
  onConnectionChange?: (connected: boolean, transport: 'ws' | 'sse' | 'none') => void;
}

interface UseWebSocketReturn {
  connected: boolean;
  transport: 'ws' | 'sse' | 'none';
  send: (data: Record<string, unknown>) => void;
  onlineCount: number;
}

export function useWebSocket(tenantId: string | null, options: UseWebSocketOptions): UseWebSocketReturn {
  const { handlers, enabled = true, onConnectionChange } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<'ws' | 'sse' | 'none'>('none');
  const [onlineCount, setOnlineCount] = useState(0);

  // Keep refs current (avoids re-creating connections when callbacks change)
  useEffect(() => {
    handlersRef.current = handlers;
    onConnectionChangeRef.current = onConnectionChange;
  }, [handlers, onConnectionChange]);

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChangeRef.current?.(connected, transport);
  }, [connected, transport]);

  // Dispatch event to matching handlers
  const dispatch = useCallback((event: WsEvent) => {
    const { type, action } = event;
    // Try specific handler: "type:action"
    const specificKey = `${type}:${action}`;
    const genericKey = type;

    if (handlersRef.current[specificKey]) {
      handlersRef.current[specificKey](event);
    } else if (handlersRef.current[genericKey]) {
      handlersRef.current[genericKey](event);
    }

    // Update online count from presence events
    if (type === 'presence' && event.data) {
      const data = event.data as { onlineCount?: number };
      if (typeof data.onlineCount === 'number') {
        setOnlineCount(data.onlineCount);
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!tenantId || !enabled) return;

    // Close existing connection
    wsRef.current?.close();
    reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);

    try {
      // Step 1: Get auth token from Next.js API
      const { token, wsUrl } = await fetchJson<{ token: string; wsUrl: string }>('/api/ws-token');

      // Step 2: Connect to WebSocket server
      const wsProto = wsUrl.startsWith('wss://') ? 'wss:' : 'ws:';
      const wsHost = wsUrl.replace(/^wss?:\/\//, '');
      const url = `${wsProto}//${wsHost}/ws?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setTransport('ws');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsEvent;
          dispatch(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        setConnected(false);

        if (event.code !== 4001) {
          // Auto-reconnect with exponential backoff (unless auth failure)
          const backoff = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 15000);
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, backoff);
        } else {
          // Auth failure — get new token and retry once
          setTransport('none');
          const backoff = 2000;
          reconnectTimerRef.current = setTimeout(connect, backoff);
        }
      };

      ws.onerror = () => {
        // Error is followed by onclose, handled there
      };
    } catch {
      // Token fetch failed — fall back to SSE
      setTransport('sse');
    }
  }, [tenantId, enabled, dispatch]);

  // Connect on mount
  useEffect(() => {
    if (enabled && tenantId) {
      connect();
    }

    return () => {
      wsRef.current?.close();
      reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);
    };
  }, [connect, enabled, tenantId]);

  // Pause WebSocket when tab is hidden
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        wsRef.current?.close();
        wsRef.current = null;
        setConnected(false);
      } else {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, connect]);

  // Send method
  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, transport, send, onlineCount };
}
