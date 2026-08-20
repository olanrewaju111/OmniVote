/**
 * useDashboardWebSocket — Dashboard-specific WebSocket + SSE hook.
 *
 * Wraps the base useWebSocket and useSSE hooks with all the
 * dashboard event handlers (incident:new, alert:new, pvt:new, etc.)
 * and manages liveIncidents / livePvtCount state.
 *
 * Extracted from page.tsx.
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWebSocket, type WsEvent } from '@/hooks/use-websocket';
import { useSSE } from '@/hooks/use-sse';
import { useDashboardStore } from '@/store/dashboard';
import type { Incident } from '@/types/dashboard';

interface UseDashboardWebSocketOptions {
  tenantId: string;
  enabled: boolean;
  userId?: string;
}

interface UseDashboardWebSocketReturn {
  liveIncidents: Incident[];
  livePvtCount: number;
  wsConnected: boolean;
  wsTransport: 'ws' | 'sse' | 'none';
  onlineCount: number;
}

export function useDashboardWebSocket({
  tenantId,
  enabled,
  userId,
}: UseDashboardWebSocketOptions): UseDashboardWebSocketReturn {
  const queryClient = useQueryClient();
  const { setSelectedTab, setWsConnected, setSseConnected, setWsOnlineCount } = useDashboardStore();

  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [livePvtCount, setLivePvtCount] = useState(0);

  // Track last toast time per severity to avoid toast spam
  const lastToastRef = useRef<Record<string, number>>({});

  // Stable references for handlers (avoid recreating on every render)
  const queryClientRef = useRef(queryClient);
  const setSelectedTabRef = useRef(setSelectedTab);
  useEffect(() => {
    queryClientRef.current = queryClient;
    setSelectedTabRef.current = setSelectedTab;
  });

  // ── SSE handlers (fallback) ──
  const sseHandlers = useMemo(() => ({
    incidents: (data: Record<string, unknown>) => {
      const { incidents } = data as { incidents: unknown[]; count: number };
      if (incidents && incidents.length > 0) {
        queryClientRef.current.invalidateQueries({ queryKey: ['incidents'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['dashboard'] });
        const now = Date.now();
        for (const inc of incidents as Array<{ severity?: string; type?: string; description?: string }>) {
          if (inc.severity === 'CRITICAL' || inc.severity === 'HIGH') {
            const key = `${inc.severity}-${inc.type}`;
            if (!lastToastRef.current[key] || now - lastToastRef.current[key] > 5000) {
              lastToastRef.current[key] = now;
              toast.warning(`${inc.severity}: ${inc.type?.replace(/_/g, ' ') || 'Incident'}`, {
                description: inc.description?.slice(0, 120) || 'New incident reported',
                duration: 8000,
                action: {
                  label: 'View',
                  onClick: () => setSelectedTabRef.current('feed'),
                },
              });
            }
          }
        }
      }
    },
    alerts: (data: Record<string, unknown>) => {
      const { alerts } = data as { alerts: unknown[]; count: number };
      if (alerts && alerts.length > 0) {
        queryClientRef.current.invalidateQueries({ queryKey: ['alerts'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['dashboard'] });
        const now = Date.now();
        for (const alert of alerts as Array<{ category?: string; title?: string; type?: string }>) {
          if (alert.category === 'CRITICAL') {
            const key = `alert-${alert.type}`;
            if (!lastToastRef.current[key] || now - lastToastRef.current[key] > 8000) {
              lastToastRef.current[key] = now;
              toast.error(`Critical ${alert.type?.replace(/_/g, ' ') || 'Alert'}`, {
                description: alert.title?.slice(0, 120) || 'New critical alert',
                duration: 10000,
                action: {
                  label: 'View Alerts',
                  onClick: () => setSelectedTabRef.current('alerts'),
                },
              });
            }
          }
        }
      }
    },
    pvt: () => {
      queryClientRef.current.invalidateQueries({ queryKey: ['pvt'] });
    },
  }), []);

  // Keep userId ref current for wsHandlers
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  });

  // ── WebSocket handlers ──
  const wsHandlers = useMemo(() => ({
    'incident:new': (event: WsEvent) => {
      const { incidents } = event.data as { incidents: Incident[]; count: number };
      if (incidents && incidents.length > 0) {
        setLiveIncidents(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newOnes = incidents.filter(i => !existingIds.has(i.id));
          return [...newOnes, ...prev].slice(0, 100);
        });
        queryClientRef.current.invalidateQueries({ queryKey: ['incidents'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['dashboard'] });
        const now = Date.now();
        for (const inc of incidents) {
          if (inc.severity === 'CRITICAL' || inc.severity === 'HIGH') {
            const key = `ws-${inc.severity}-${inc.type}`;
            if (!lastToastRef.current[key] || now - lastToastRef.current[key] > 5000) {
              lastToastRef.current[key] = now;
              toast.warning(`${inc.severity}: ${inc.type?.replace(/_/g, ' ') || 'Incident'}`, {
                description: inc.description?.slice(0, 120) || 'New incident reported via live feed',
                duration: 8000,
                action: { label: 'View', onClick: () => setSelectedTabRef.current('feed') },
              });
            }
          }
        }
      }
    },
    'alert:new': (event: WsEvent) => {
      const { alerts } = event.data as { alerts: unknown[]; count: number };
      if (alerts && alerts.length > 0) {
        queryClientRef.current.invalidateQueries({ queryKey: ['alerts'] });
        queryClientRef.current.invalidateQueries({ queryKey: ['dashboard'] });
        const now = Date.now();
        for (const alert of alerts as Array<{ category?: string; title?: string; type?: string }>) {
          if (alert.category === 'CRITICAL') {
            const key = `ws-alert-${alert.type}`;
            if (!lastToastRef.current[key] || now - lastToastRef.current[key] > 8000) {
              lastToastRef.current[key] = now;
              toast.error(`Critical ${alert.type?.replace(/_/g, ' ') || 'Alert'}`, {
                description: alert.title?.slice(0, 120) || 'New critical alert',
                duration: 10000,
                action: { label: 'View Alerts', onClick: () => setSelectedTabRef.current('alerts') },
              });
            }
          }
        }
      }
    },
    'pvt:new': (event: WsEvent) => {
      const { results } = event.data as { results: unknown[]; count: number };
      if (results) {
        setLivePvtCount(prev => prev + results.length);
        queryClientRef.current.invalidateQueries({ queryKey: ['pvt'] });
      }
    },
    'chat:new_message': (event: WsEvent) => {
      const msg = event.data as { id: string; senderId: string; senderName: string; body: string };
      if (msg && msg.senderId !== userIdRef.current) {
        queryClientRef.current.invalidateQueries({ queryKey: ['chat'] });
      }
    },
    'osint:new': (_event: WsEvent) => {
      queryClientRef.current.invalidateQueries({ queryKey: ['osint'] });
    },
    'dashboard:kpi_update': (_event: WsEvent) => {
      queryClientRef.current.invalidateQueries({ queryKey: ['dashboard'] });
    },
    'presence': (_event: WsEvent) => {
      // Online count is handled by the hook internally
    },
  }), [userId]);

  // ── WebSocket connection ──
  // Stable ref for onConnectionChange to prevent infinite re-render loop
  // (Zustand setWsConnected triggers re-render → new callback ref → useEffect re-fires)
  const onConnectionChangeRef = useRef<(connected: boolean, transport: 'ws' | 'sse' | 'none') => void>();
  onConnectionChangeRef.current = (connected, transport) => {
    setWsConnected(connected, transport);
  };
  const stableOnConnectionChange = useRef<(connected: boolean, transport: 'ws' | 'sse' | 'none') => void>(
    (connected, transport) => onConnectionChangeRef.current?.(connected, transport)
  ).current;

  const { connected: wsConnected, transport: wsTransport, onlineCount } = useWebSocket(tenantId || null, {
    handlers: wsHandlers,
    enabled,
    onConnectionChange: stableOnConnectionChange,
  });

  // Sync online count to store
  useEffect(() => {
    setWsOnlineCount(onlineCount);
  }, [onlineCount, setWsOnlineCount]);

  // ── SSE fallback (when WS is not connected) ──
  // Stable ref for SSE onConnectionChange (avoids stale wsTransport closure)
  const wsTransportRef = useRef(wsTransport);
  wsTransportRef.current = wsTransport;
  const sseOnConnectionChangeRef = useRef<(connected: boolean) => void>();
  sseOnConnectionChangeRef.current = (connected) => {
    if (connected && wsTransportRef.current !== 'ws') {
      setWsConnected(true, 'sse');
    }
    setSseConnected(connected);
  };
  const stableSseOnConnectionChange = useRef<(connected: boolean) => void>(
    (connected) => sseOnConnectionChangeRef.current?.(connected)
  ).current;

  useSSE(tenantId || null, {
    handlers: sseHandlers,
    enabled: enabled && wsTransport !== 'ws',
    onConnectionChange: stableSseOnConnectionChange,
  });

  return { liveIncidents, livePvtCount, wsConnected, wsTransport, onlineCount };
}
