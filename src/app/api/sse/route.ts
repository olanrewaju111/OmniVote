import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url || "http://localhost");
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
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      // Send initial connection event
      send('connected', { message: 'SSE connected', timestamp: new Date().toISOString() });

      // Poll for new data every 3 seconds (was 5s, now faster for real-time feel)
      const { db } = await import('@/lib/db');
      const cursors: Record<string, Date> = {
        alerts: new Date(),
        incidents: new Date(),
        pvt: new Date(),
        osint: new Date(),
        security: new Date(),
        chat: new Date(),
        checkIns: new Date(),
        honeypot: new Date(),
        results: new Date(),
      };

      const where: Record<string, unknown> = payload.role === 'SUPER_ADMIN' ? {} : { tenantId };

      const poll = async () => {
        try {
          // 1. Alerts
          const newAlerts = await db.alert.findMany({
            where: { ...where, createdAt: { gt: cursors.alerts } },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });
          if (newAlerts.length > 0) {
            cursors.alerts = newAlerts[newAlerts.length - 1].createdAt;
            send('alerts', { alerts: newAlerts, count: newAlerts.length });
          }

          // 2. Incidents
          const newIncidents = await db.incident.findMany({
            where: { ...where, submittedAt: { gt: cursors.incidents } },
            orderBy: { submittedAt: 'asc' },
            take: 20,
          });
          if (newIncidents.length > 0) {
            cursors.incidents = newIncidents[newIncidents.length - 1].submittedAt;
            send('incidents', { incidents: newIncidents, count: newIncidents.length });
          }

          // 3. PVT Submissions
          const newPvt = await db.pvtSubmission.findMany({
            where: { ...where, submittedAt: { gt: cursors.pvt } },
            orderBy: { submittedAt: 'asc' },
            take: 10,
          });
          if (newPvt.length > 0) {
            cursors.pvt = newPvt[newPvt.length - 1].submittedAt;
            send('pvt', { results: newPvt, count: newPvt.length });
          }

          // 4. OSINT Posts (new ingested posts)
          const newOsint = await db.osintPost.findMany({
            where: { ...where, ingestedAt: { gt: cursors.osint } },
            orderBy: { ingestedAt: 'asc' },
            take: 10,
          });
          if (newOsint.length > 0) {
            cursors.osint = newOsint[newOsint.length - 1].ingestedAt;
            send('osint', { posts: newOsint, count: newOsint.length });
          }

          // 5. Security Events
          const newSecurity = await db.securityEvent.findMany({
            where: { ...where, createdAt: { gt: cursors.security } },
            orderBy: { createdAt: 'asc' },
            take: 10,
          });
          if (newSecurity.length > 0) {
            cursors.security = newSecurity[newSecurity.length - 1].createdAt;
            send('security', { events: newSecurity, count: newSecurity.length });
          }

          // 6. Chat Messages
          const newChat = await db.chatMessage.findMany({
            where: { ...where, createdAt: { gt: cursors.chat } },
            orderBy: { createdAt: 'asc' },
            take: 20,
            include: { sender: { select: { id: true, name: true, role: true } } },
          });
          if (newChat.length > 0) {
            cursors.chat = newChat[newChat.length - 1].createdAt;
            send('chat', { messages: newChat, count: newChat.length });
          }

          // 7. Agent Check-Ins
          const newCheckIns = await db.agentCheckIn.findMany({
            where: { ...where, checkedInAt: { gt: cursors.checkIns } },
            orderBy: { checkedInAt: 'asc' },
            take: 10,
          });
          if (newCheckIns.length > 0) {
            cursors.checkIns = newCheckIns[newCheckIns.length - 1].checkedInAt;
            send('checkins', { checkIns: newCheckIns, count: newCheckIns.length });
          }

          // 8. Honeypot Alerts
          const newHoneypot = await db.honeypotUnit.findMany({
            where: { ...where, updatedAt: { gt: cursors.honeypot }, alertTriggered: true },
            orderBy: { updatedAt: 'asc' },
            take: 5,
          });
          if (newHoneypot.length > 0) {
            cursors.honeypot = newHoneypot[newHoneypot.length - 1].updatedAt;
            send('honeypot', { alerts: newHoneypot, count: newHoneypot.length });
          }

          // 9. New Election Results
          const newResults = await db.electionResult.findMany({
            where: { ...where, submittedAt: { gt: cursors.results } },
            orderBy: { submittedAt: 'asc' },
            take: 10,
          });
          if (newResults.length > 0) {
            cursors.results = newResults[newResults.length - 1].submittedAt;
            send('results', { results: newResults, count: newResults.length });
          }

          // 10. Periodic KPI snapshot (every 6th poll = ~18s)
          // This drives the Situational Awareness widget
          if (Math.random() < 0.17) {
            const [alertCount, incidentCount, pvtCount, onlineAgents, totalAgents] =
              await Promise.all([
                db.alert.count({ where: { ...where, isRead: false } }),
                db.incident.count({ where: { ...where, status: { in: ['PENDING', 'ESCALATED'] } } }),
                db.pvtSubmission.count({ where: { ...where, isVerified: true } }),
                db.user.count({ where: { ...where, isOnline: true, role: 'FIELD_AGENT' } }),
                db.user.count({ where: { ...where, role: 'FIELD_AGENT' } }),
              ]);
            send('kpi', {
              unreadAlerts: alertCount,
              activeIncidents: incidentCount,
              verifiedPvt: pvtCount,
              onlineAgents,
              totalAgents,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // Continue polling on error
        }
      };

      // Initial poll
      await poll();
      const pollInterval = setInterval(poll, 3000);
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