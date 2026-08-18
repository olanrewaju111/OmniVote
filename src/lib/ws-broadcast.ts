/**
 * ws-broadcast.ts — HTTP bridge for API routes to broadcast WebSocket events.
 * 
 * API routes call `broadcastEvent()` to push real-time events to connected
 * WebSocket clients. This communicates with the WS server via HTTP POST.
 */

const WS_INTERNAL_URL = process.env.WS_INTERNAL_URL || 'http://localhost:3003';
const JWT_SECRET = process.env.JWT_SECRET || '';

interface BroadcastPayload {
  type: 'incident' | 'alert' | 'pvt' | 'chat' | 'agent' | 'osint' | 'dashboard' | 'geofence' | 'honeypot' | 'security' | 'presence';
  action: string;
  data: unknown;
  tenantId: string;
}

/**
 * Broadcast a real-time event to all WebSocket clients in a tenant.
 * This is fire-and-forget — errors are silently logged.
 * Called from API routes after database mutations.
 */
export async function broadcastEvent(payload: BroadcastPayload): Promise<void> {
  try {
    // Set a short timeout (1s) to avoid blocking API responses
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    await fetch(`${WS_INTERNAL_URL}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': JWT_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // WebSocket server may not be running — that's OK, SSE fallback handles it
  }
}

/**
 * Broadcast an incident event to a tenant.
 */
export function broadcastIncident(tenantId: string, action: string, data: unknown) {
  return broadcastEvent({ type: 'incident', action, data, tenantId });
}

/**
 * Broadcast an alert event to a tenant.
 */
export function broadcastAlert(tenantId: string, action: string, data: unknown) {
  return broadcastEvent({ type: 'alert', action, data, tenantId });
}

/**
 * Broadcast a PVT event to a tenant.
 */
export function broadcastPvt(tenantId: string, action: string, data: unknown) {
  return broadcastEvent({ type: 'pvt', action, data, tenantId });
}

/**
 * Broadcast a chat event to a tenant.
 */
export function broadcastChat(tenantId: string, action: string, data: unknown) {
  return broadcastEvent({ type: 'chat', action, data, tenantId });
}

/**
 * Broadcast a dashboard KPI update to a tenant.
 */
export function broadcastDashboard(tenantId: string, data: unknown) {
  return broadcastEvent({ type: 'dashboard', action: 'kpi_update', data, tenantId });
}