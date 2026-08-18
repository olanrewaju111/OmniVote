'use client';

import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';
import { Wifi, WifiOff, Zap, Radio, Users } from 'lucide-react';

/**
 * Real-time connection indicator shown in the app header.
 * Displays WebSocket/SSE connection status and online user count.
 */
export function ConnectionIndicator() {
  const { wsConnected, wsTransport, wsOnlineCount, sseConnected } = useDashboardStore();

  const isConnected = wsConnected || sseConnected;
  const transport = wsTransport === 'ws' ? 'WebSocket' : wsTransport === 'sse' ? 'SSE' : 'Connecting...';

  if (!isConnected && !sseConnected) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-amber/70">
        <WifiOff className="h-3 w-3" />
        <span className="hidden sm:inline">Reconnecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'flex items-center gap-1.5 text-[10px] rounded-full px-2 py-0.5 border transition-all',
        wsConnected && wsTransport === 'ws'
          ? 'bg-emerald/10 text-emerald border-emerald/20'
          : 'bg-amber/10 text-amber border-amber/20'
      )}>
        {wsConnected && wsTransport === 'ws' ? (
          <Zap className="h-3 w-3" />
        ) : (
          <Radio className="h-3 w-3" />
        )}
        <span className="hidden sm:inline font-medium">{transport}</span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot bg-current" />
      </div>
      {wsOnlineCount > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{wsOnlineCount}</span>
        </div>
      )}
    </div>
  );
}
