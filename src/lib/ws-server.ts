/**
 * OmniVote Real-Time WebSocket Server
 * 
 * Runs as a sidecar process on a separate port (3003).
 * Authenticates via JWT token passed during WebSocket handshake.
 * Broadcasts real-time events to tenants via rooms.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { jwtVerify } from 'jose';

// Types
interface WsClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  userRole: string;
  tenantId: string;
  isAlive: boolean;
  joinedAt: number;
}

interface BroadcastEvent {
  type: 'incident' | 'alert' | 'pvt' | 'chat' | 'agent' | 'osint' | 'dashboard' | 'geofence' | 'honeypot' | 'security' | 'presence';
  action: string;
  data: unknown;
  tenantId: string;
  timestamp: string;
}

// JWT secret from env
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');
if (!JWT_SECRET.length) {
  console.error('[WS] FATAL: JWT_SECRET not set. WebSocket server cannot start.');
  process.exit(1);
}

const PORT = parseInt(process.env.WS_PORT || '3003', 10);

// Room-based broadcasting: tenantId -> Set<WsClient>
const rooms = new Map<string, Set<WsClient>>();
const clients = new Map<string, WsClient>(); // socket id -> client info

function getRoom(tenantId: string): Set<WsClient> {
  if (!rooms.has(tenantId)) rooms.set(tenantId, new Set());
  return rooms.get(tenantId)!;
}

function joinRoom(client: WsClient) {
  const room = getRoom(client.tenantId);
  room.add(client);
}

function leaveRoom(client: WsClient) {
  const room = getRoom(client.tenantId);
  room.delete(client);
  if (room.size === 0) rooms.delete(client.tenantId);
}

function broadcastToTenant(tenantId: string, event: Omit<BroadcastEvent, 'tenantId' | 'timestamp'>) {
  const room = getRoom(tenantId);
  const payload: BroadcastEvent = {
    ...event,
    tenantId,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// Broadcast to ALL tenants (SUPER_ADMIN)
function broadcastToAll(event: Omit<BroadcastEvent, 'tenantId' | 'timestamp'>) {
  for (const [tenantId] of rooms) {
    broadcastToTenant(tenantId, event);
  }
}

// Authenticate WebSocket connection via token in query string
async function authenticate(req: IncomingMessage): Promise<{ valid: boolean; payload?: { userId: string; role: string; tenantId: string; name: string } }> {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  if (!token) return { valid: false };

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as unknown as { userId?: string; role?: string; tenantId?: string; name?: string };
    if (!p.userId || !p.tenantId) return { valid: false };
    return { valid: true, payload: { userId: p.userId, role: p.role || '', tenantId: p.tenantId, name: p.name || '' } };
  } catch {
    return { valid: false };
  }
}

// ─── Server Setup ──────────────────────────────────────────────────────

const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connections: clients.size,
      rooms: Object.fromEntries([...rooms.entries()].map(([k, v]) => [k, v.size])),
      uptime: process.uptime(),
    }));
    return;
  }

  // Internal broadcast endpoint (called by API routes)
  if (req.url === '/broadcast' && req.method === 'POST') {
    // Verify internal request via shared secret
    const authHeader = req.headers['x-internal-secret'];
    if (authHeader !== process.env.JWT_SECRET) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.tenantId && payload.type && payload.action) {
          broadcastToTenant(payload.tenantId, {
            type: payload.type,
            action: payload.action,
            data: payload.data,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, sent: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields' }));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  const auth = await authenticate(req);
  if (!auth.valid || !auth.payload) {
    ws.close(4001, 'Authentication failed');
    return;
  }

  const client: WsClient = {
    ws,
    userId: auth.payload.userId,
    userName: auth.payload.name,
    userRole: auth.payload.role,
    tenantId: auth.payload.tenantId,
    isAlive: true,
    joinedAt: Date.now(),
  };

  clients.set(ws.toString(), client);
  joinRoom(client);

  // Send welcome
  ws.send(JSON.stringify({
    type: 'system',
    action: 'connected',
    data: { userId: client.userId, tenantId: client.tenantId },
    timestamp: new Date().toISOString(),
  }));

  // Broadcast presence to room
  broadcastToTenant(client.tenantId, {
    type: 'presence',
    action: 'user_joined',
    data: {
      userId: client.userId,
      userName: client.userName,
      userRole: client.userRole,
      onlineCount: getRoom(client.tenantId).size,
    },
  });

  ws.on('pong', () => { client.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Handle chat messages
      if (msg.type === 'chat' && msg.action === 'send' && msg.data?.body) {
        broadcastToTenant(client.tenantId, {
          type: 'chat',
          action: 'new_message',
          data: {
            id: msg.data.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            senderId: client.userId,
            senderName: client.userName,
            senderRole: client.userRole,
            body: msg.data.body,
            createdAt: new Date().toISOString(),
            isSystem: false,
          },
        });
      }

      // Handle typing indicators
      if (msg.type === 'chat' && msg.action === 'typing') {
        broadcastToTenant(client.tenantId, {
          type: 'chat',
          action: 'typing',
          data: {
            userId: client.userId,
            userName: client.userName,
          },
        });
      }

      // Handle subscribe to additional rooms (SUPER_ADMIN)
      if (msg.type === 'system' && msg.action === 'subscribe_tenant' && client.userRole === 'SUPER_ADMIN') {
        const targetTenant = msg.data?.tenantId as string;
        if (targetTenant && targetTenant !== client.tenantId) {
          // Add to additional room
          const room = getRoom(targetTenant);
          // Create a virtual client for the additional room
          const virtualClient = { ...client, tenantId: targetTenant };
          room.add(virtualClient as WsClient);
          ws.send(JSON.stringify({
            type: 'system', action: 'subscribed',
            data: { tenantId: targetTenant },
            timestamp: new Date().toISOString(),
          }));
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    leaveRoom(client);
    clients.delete(ws.toString());

    // Broadcast departure
    broadcastToTenant(client.tenantId, {
      type: 'presence',
      action: 'user_left',
      data: {
        userId: client.userId,
        userName: client.userName,
        onlineCount: getRoom(client.tenantId).size,
      },
    });
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error (${client.userName}):`, err.message);
  });
});

// Heartbeat: detect dead connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clients.get(ws.toString());
    if (client && !client.isAlive) {
      leaveRoom(client);
      clients.delete(ws.toString());
      return ws.terminate();
    }
    client && (client.isAlive = false);
    ws.ping();
  });
}, 30_000);

server.listen(PORT, () => {
  console.log(`[WS] OmniVote WebSocket server running on ws://localhost:${PORT}/ws`);
  console.log(`[WS] Health check: http://localhost:${PORT}/health`);
});

// ─── DB Watcher (Polling Bridge) ──────────────────────────────────────
// 
// Watches the database for new events and broadcasts them to connected
// WebSocket clients. This replaces the SSE polling approach with push.
// The watcher polls at 3s intervals (faster than SSE's 5s).

async function startDbWatcher() {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();

  let lastAlertTs = new Date(Date.now() - 60_000); // Look back 1 min on start
  let lastIncidentTs = new Date(Date.now() - 60_000);
  let lastPvtTs = new Date(Date.now() - 60_000);
  let lastOsintTs = new Date(Date.now() - 60_000);
  let lastChatTs = new Date(Date.now() - 60_000);

  console.log('[WS] Database watcher started (3s poll interval)');

  const poll = async () => {
    try {
      // Get all active tenant IDs from rooms
      const activeTenants = [...rooms.keys()];
      if (activeTenants.length === 0) return;

      // Check for new incidents per tenant
      for (const tenantId of activeTenants) {
        try {
          // New incidents
          const newIncidents = await db.incident.findMany({
            where: { tenantId, submittedAt: { gt: lastIncidentTs } },
            orderBy: { submittedAt: 'asc' },
            take: 20,
            include: {
              reporter: { select: { id: true, name: true, role: true } },
              pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true } },
            },
          });
          if (newIncidents.length > 0) {
            lastIncidentTs = newIncidents[newIncidents.length - 1].submittedAt;
            broadcastToTenant(tenantId, {
              type: 'incident',
              action: 'new',
              data: { incidents: newIncidents, count: newIncidents.length },
            });
          }

          // New alerts
          const newAlerts = await db.alert.findMany({
            where: { tenantId, createdAt: { gt: lastAlertTs } },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });
          if (newAlerts.length > 0) {
            lastAlertTs = newAlerts[newAlerts.length - 1].createdAt;
            broadcastToTenant(tenantId, {
              type: 'alert',
              action: 'new',
              data: { alerts: newAlerts, count: newAlerts.length },
            });
          }

          // New PVT submissions
          const newPvt = await db.pvtSubmission.findMany({
            where: { tenantId, submittedAt: { gt: lastPvtTs } },
            orderBy: { submittedAt: 'asc' },
            take: 10,
          });
          if (newPvt.length > 0) {
            lastPvtTs = newPvt[newPvt.length - 1].submittedAt;
            broadcastToTenant(tenantId, {
              type: 'pvt',
              action: 'new',
              data: { results: newPvt, count: newPvt.length },
            });
          }

          // New OSINT posts
          const newOsint = await db.osintPost.findMany({
            where: { tenantId, ingestedAt: { gt: lastOsintTs } },
            orderBy: { ingestedAt: 'asc' },
            take: 10,
          });
          if (newOsint.length > 0) {
            lastOsintTs = newOsint[newOsint.length - 1].ingestedAt;
            broadcastToTenant(tenantId, {
              type: 'osint',
              action: 'new',
              data: { posts: newOsint, count: newOsint.length },
            });
          }

          // New chat messages
          const newChat = await db.chatMessage.findMany({
            where: { tenantId, createdAt: { gt: lastChatTs } },
            orderBy: { createdAt: 'asc' },
            take: 10,
          });
          if (newChat.length > 0) {
            lastChatTs = newChat[newChat.length - 1].createdAt;
            for (const msg of newChat) {
              broadcastToTenant(tenantId, {
                type: 'chat',
                action: 'new_message',
                data: msg,
              });
            }
          }

          // Dashboard KPI snapshot (every 10th poll = ~30s)
          if (Math.random() < 0.1) {
            const [totalIncidents, pendingIncidents, criticalIncidents, securityAlerts, totalAgents] = await Promise.all([
              db.incident.count({ where: { tenantId } }),
              db.incident.count({ where: { tenantId, status: 'PENDING' } }),
              db.incident.count({ where: { tenantId, severity: 'CRITICAL' } }),
              db.alert.count({ where: { tenantId, type: 'SECURITY' } }),
              db.user.count({ where: { tenantId, role: 'FIELD_AGENT' } }),
            ]);
            broadcastToTenant(tenantId, {
              type: 'dashboard',
              action: 'kpi_update',
              data: {
                totalIncidents, pendingIncidents, criticalIncidents, securityAlerts, totalAgents,
              },
            });
          }
        } catch (tenantErr) {
          // Continue with other tenants on error
          console.error(`[WS] Poll error for tenant ${tenantId}:`, tenantErr);
        }
      }
    } catch (err) {
      console.error('[WS] Poll error:', err);
    }
  };

  // Poll every 3 seconds
  setInterval(poll, 3000);
  // Initial poll after short delay
  setTimeout(poll, 2000);
}

startDbWatcher().catch((err) => {
  console.error('[WS] Failed to start DB watcher:', err);
});

// Graceful shutdown
function shutdown() {
  console.log('[WS] Shutting down...');
  clearInterval(heartbeatInterval);
  for (const client of clients.values()) {
    try { client.ws.close(1001, 'Server shutting down'); } catch { /* ignore */ }
  }
  wss.close(() => {
    server.close(() => {
      console.log('[WS] Server closed');
      process.exit(0);
    });
  });
  // Force exit after 5s
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Export broadcast function for use by API routes (cross-process via HTTP)
// API routes can POST to ws-server to trigger immediate broadcasts
export { broadcastToTenant, broadcastToAll, type BroadcastEvent };
