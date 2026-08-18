import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sloTracker, activeConnections } from '@/lib/sre';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Types ─────────────────────────────────────────────────────────────

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  database: {
    status: 'ok' | 'error';
    latencyMs: number;
  };
  websocket: {
    status: 'ok' | 'disabled' | 'error';
    activeConnections: number;
    port?: number;
  };
  checks: { name: string; status: 'pass' | 'fail'; durationMs: number; error?: string }[];
  responseTimeMs: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    // When running in standalone mode, package.json is copied to /app
    // In dev, it's at the project root
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Deep Health Checks ────────────────────────────────────────────────

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail';
  durationMs: number;
  error?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    return { name: 'database_connectivity', status: 'pass', durationMs: Date.now() - start };
  } catch (err) {
    return { name: 'database_connectivity', status: 'fail', durationMs: Date.now() - start, error: String(err) };
  }
}

// ─── GET Handler ───────────────────────────────────────────────────────

// GET /api/health — Deep health check for Docker, load balancers, and monitoring
export async function GET() {
  const start = Date.now();

  // Run database check
  const dbCheck = await checkDatabase();

  const hasFailure = dbCheck.status === 'fail';
  const overallStatus: HealthResponse['status'] = hasFailure ? 'degraded' : 'ok';

  // WebSocket status
  const wsPort = process.env.WS_PORT;
  const wsConnections = activeConnections.getValue();

  let wsStatus: HealthResponse['websocket']['status'] = 'disabled';
  if (wsPort) {
    wsStatus = wsConnections > 0 ? 'ok' : 'ok'; // WS configured = ok (may have 0 connections)
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: getVersion(),
    uptime: Math.round(process.uptime() * 1000),
    timestamp: new Date().toISOString(),
    database: {
      status: dbCheck.status === 'pass' ? 'ok' : 'error',
      latencyMs: dbCheck.durationMs,
    },
    websocket: {
      status: wsStatus,
      activeConnections: wsConnections,
      ...(wsPort ? { port: parseInt(wsPort, 10) } : {}),
    },
    checks: [dbCheck],
    responseTimeMs: Date.now() - start,
  };

  // Return 503 if degraded
  const statusCode = overallStatus === 'ok' ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
