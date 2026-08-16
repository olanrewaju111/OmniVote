import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url || "", "http://localhost");
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return new Response('tenantId required', { status: 400 });
  }

  // Authenticate via httpOnly cookie (no token in query string)
  const payload = await getSession();
  if (!payload) {
    return new Response('Authentication required', { status: 401 });
  }

  if (payload.tenantId !== tenantId && payload.role !== 'SUPER_ADMIN') {
    return new Response('Tenant mismatch', { status: 403 });
  }

  const encoder = new TextEncoder();
  const heartbeat = ': omnivote-sse-heartbeat\n\n';

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial connection event
      send('connected', { message: 'SSE connected', timestamp: new Date().toISOString() });

      // Poll for new data every 5 seconds
      const { db } = await import('@/lib/db');
      let lastAlertTs = new Date();
      let lastIncidentTs = new Date();
      let lastPvtTs = new Date();

      const poll = async () => {
        try {
          const where: Record<string, unknown> = payload.role === 'SUPER_ADMIN' ? {} : { tenantId };

          // Check for new alerts
          const newAlerts = await db.alert.findMany({
            where: { ...where, createdAt: { gt: lastAlertTs } },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });
          if (newAlerts.length > 0) {
            lastAlertTs = newAlerts[newAlerts.length - 1].createdAt;
            send('alerts', { alerts: newAlerts, count: newAlerts.length });
          }

          // Check for new incidents (independent cursor)
          const newIncidents = await db.incident.findMany({
            where: { ...where, submittedAt: { gt: lastIncidentTs } },
            orderBy: { submittedAt: 'asc' },
            take: 20,
          });
          if (newIncidents.length > 0) {
            lastIncidentTs = newIncidents[newIncidents.length - 1].submittedAt;
            send('incidents', { incidents: newIncidents, count: newIncidents.length });
          }

          // Check for new PVT submissions
          const newPvt = await db.pvtSubmission.findMany({
            where: { ...where, submittedAt: { gt: lastPvtTs } },
            orderBy: { submittedAt: 'asc' },
            take: 10,
          });
          if (newPvt.length > 0) {
            lastPvtTs = newPvt[newPvt.length - 1].submittedAt;
            send('pvt', { results: newPvt, count: newPvt.length });
          }
        } catch {
          // Continue polling on error
        }
      };

      // Initial poll
      await poll();
      const pollInterval = setInterval(poll, 5000);
      const heartbeatInterval = setInterval(() => {
        try { controller.enqueue(encoder.encode(heartbeat)); } catch { /* stream closed */ }
      }, 15000);

      // Clean up on close
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      }, { once: true });
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