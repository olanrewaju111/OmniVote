/**
 * Server-Sent Events (SSE) endpoint for real-time dashboard updates.
 *
 * Clients connect via GET /api/sse?tenantId=X and receive JSON events
 * whenever relevant data changes. The server polls the database at a
 * configurable interval and pushes updates.
 *
 * Event types:
 *   - connected:   connection confirmation
 *   - dashboard:   KPI counts + trends (always sent)
 *   - incidents:   new/updated incidents
 *   - alerts:      new/updated alerts
 *   - agents:      agent status changes (online/offline)
 *   - results:     new election result submissions
 *   - pvt:         new PVT submissions or verifications
 *   - evidence:    evidence dossier or stego scan changes
 *   - geofence:    check-in or dead-man's switch changes
 *   - honeypot:    honeypot deviation detections
 *   - engagement:  new/updated messages
 *   - campaigns:   campaign event or status changes
 *   - reports:     new field reports
 *   - heartbeat:   keep-alive ping
 */

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { db } from '@/lib/db';

// How often to poll DB and push updates (ms). 5s is a good balance
// between responsiveness and DB load.
const POLL_INTERVAL_MS = 5000;

// Maximum concurrent SSE connections per server process
const MAX_CONNECTIONS = 50;
let activeConnections = 0;

function sseLine(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export async function GET(req: NextRequest) {
  // ─── Auth ────────────────────────────────────────────────────────
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return new Response('Unauthorized', { status: 401 });
  }

  const tenantId = new URL(req.url).searchParams.get('tenantId');
  if (!tenantId) {
    return new Response('tenantId is required', { status: 400 });
  }
  const tenantErr = requireTenantMatch(authUser, tenantId);
  if (tenantErr) return tenantErr;

  // ─── Connection limit ─────────────────────────────────────────────
  if (activeConnections >= MAX_CONNECTIONS) {
    return new Response('Too many SSE connections', { status: 429 });
  }
  activeConnections++;

  // ─── SSE stream ────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Confirm connection
      controller.enqueue(
        encoder.encode(sseLine('connected', JSON.stringify({ tenantId, userId: authUser.sub }))),
      );

      // Periodic DB poll → push events
      const timer = setInterval(async () => {
        try {
          const events = await gatherUpdates(tenantId);
          for (const ev of events) {
            controller.enqueue(encoder.encode(sseLine(ev.type, JSON.stringify(ev.data))));
          }
        } catch (err) {
          // DB error — keep connection alive with heartbeat
          console.error('[SSE] gatherUpdates error:', err instanceof Error ? err.message : err);
        }
        controller.enqueue(
          encoder.encode(sseLine('heartbeat', JSON.stringify({ ts: Date.now() }))),
        );
      }, POLL_INTERVAL_MS);

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(timer);
        activeConnections = Math.max(0, activeConnections - 1);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      activeConnections = Math.max(0, activeConnections - 1);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ─── Data gathering ────────────────────────────────────────────────────

interface SseEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Checks if any records in a table were updated since `since`.
 * Uses a lightweight COUNT query with an updatedAt filter to avoid
 * transferring full rows when nothing changed.
 */
async function hasRecentUpdates(
  model: 'incident' | 'alert' | 'electionResult' | 'pvtSubmission' | 'evidenceDossier'
       | 'stegoScanResult' | 'agentCheckIn' | 'deadMansSwitch' | 'honeypotUnit'
       | 'campaignMessage' | 'campaignEvent' | 'report',
  tenantId: string,
  since: Date,
): Promise<number> {
  return db[model].count({
    where: { tenantId, updatedAt: { gte: since } } as never,
  });
}

async function gatherUpdates(tenantId: string): Promise<SseEvent[]> {
  const now = Date.now();
  const since = new Date(now - (POLL_INTERVAL_MS + 2000));
  const events: SseEvent[] = [];

  // ── 1. Dashboard KPIs (always sent for counter updates) ──
  const [totalAgents, onlineAgents, totalIncidents, unresolvedIncidents, unreadAlerts] = await Promise.all([
    db.user.count({ where: { tenantId, role: 'FIELD_AGENT' } }),
    db.user.count({ where: { tenantId, role: 'FIELD_AGENT', isOnline: true } }),
    db.incident.count({ where: { tenantId } }),
    db.incident.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    db.alert.count({ where: { tenantId, isRead: false } }),
  ]);

  events.push({
    type: 'dashboard',
    data: {
      totalAgents,
      onlineAgents,
      totalIncidents,
      unresolvedIncidents,
      unreadAlerts,
      agentCoverage: totalAgents > 0 ? Math.round((onlineAgents / totalAgents) * 100) : 0,
    },
  });

  // ── 2. Domain-specific change detection (parallel lightweight counts) ──
  const [
    incidentCount,
    alertCount,
    agentUpdateCount,
    resultCount,
    pvtCount,
    evidenceCount,
    checkInCount,
    switchCount,
    honeypotCount,
    messageCount,
    campaignEventCount,
    reportCount,
  ] = await Promise.all([
    hasRecentUpdates('incident', tenantId, since),
    hasRecentUpdates('alert', tenantId, since),
    db.user.count({ where: { tenantId, lastSeenAt: { gte: since }, role: 'FIELD_AGENT' } }),
    hasRecentUpdates('electionResult', tenantId, since),
    hasRecentUpdates('pvtSubmission', tenantId, since),
    hasRecentUpdates('evidenceDossier', tenantId, since),
    hasRecentUpdates('agentCheckIn', tenantId, since),
    hasRecentUpdates('deadMansSwitch', tenantId, since),
    db.honeypotUnit.count({ where: { tenantId, updatedAt: { gte: since }, deviationDetected: true } }),
    hasRecentUpdates('campaignMessage', tenantId, since),
    hasRecentUpdates('campaignEvent', tenantId, since),
    hasRecentUpdates('report', tenantId, since),
  ]);

  // Only push domain events when there are actual changes
  if (incidentCount > 0) {
    events.push({ type: 'incidents', data: { count: incidentCount } });
  }
  if (alertCount > 0) {
    events.push({ type: 'alerts', data: { count: alertCount } });
  }
  if (agentUpdateCount > 0) {
    events.push({ type: 'agents', data: { count: agentUpdateCount } });
  }
  if (resultCount > 0) {
    events.push({ type: 'results', data: { count: resultCount } });
  }
  if (pvtCount > 0) {
    events.push({ type: 'pvt', data: { count: pvtCount } });
  }
  if (evidenceCount > 0) {
    events.push({ type: 'evidence', data: { count: evidenceCount } });
  }
  if (checkInCount > 0 || switchCount > 0) {
    events.push({ type: 'geofence', data: { checkIns: checkInCount, switches: switchCount } });
  }
  if (honeypotCount > 0) {
    events.push({ type: 'honeypot', data: { count: honeypotCount } });
  }
  if (messageCount > 0) {
    events.push({ type: 'engagement', data: { count: messageCount } });
  }
  if (campaignEventCount > 0) {
    events.push({ type: 'campaigns', data: { count: campaignEventCount } });
  }
  if (reportCount > 0) {
    events.push({ type: 'reports', data: { count: reportCount } });
  }

  return events;
}