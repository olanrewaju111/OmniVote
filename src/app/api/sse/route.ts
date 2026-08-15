import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  const token = searchParams.get('token');

  if (!tenantId || !token) {
    return new Response('tenantId and token required', { status: 400 });
  }

  // Verify token is valid JWT (basic check)
  const { jwtVerify } = await import('@/lib/auth');
  let payload;
  try {
    payload = await jwtVerify(token);
  } catch {
    return new Response('Invalid token', { status: 401 });
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
      let lastPollTimestamp = new Date();

      const poll = async () => {
        try {
          const now = new Date();
          const where: Record<string, unknown> = payload.role === 'SUPER_ADMIN' ? {} : { tenantId };

          // Check for new alerts (cursor by createdAt, not CUID)
          const newAlerts = await db.alert.findMany({
            where: { ...where, createdAt: { gt: lastPollTimestamp } },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });
          if (newAlerts.length > 0) {
            lastPollTimestamp = newAlerts[newAlerts.length - 1].createdAt;
            send('alerts', { alerts: newAlerts, count: newAlerts.length });
          }

          // Check for new incidents (cursor by submittedAt, not CUID)
          const newIncidents = await db.incident.findMany({
            where: { ...where, submittedAt: { gt: lastPollTimestamp } },
            orderBy: { submittedAt: 'asc' },
            take: 20,
          });
          if (newIncidents.length > 0) {
            lastPollTimestamp = newIncidents[newIncidents.length - 1].submittedAt;
            send('incidents', { incidents: newIncidents, count: newIncidents.length });
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