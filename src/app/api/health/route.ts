import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sloTracker, activeConnections } from '@/lib/sre';

// ─── Types ─────────────────────────────────────────────────────────────

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: { milliseconds: number; human: string };
  database: {
    status: 'ok' | 'error';
    latencyMs: number;
    engine: string;
    poolConnections?: number;
  };
  runtime: { name: string; platform: string };
  memory: {
    rss: string; heapUsed: string; heapTotal: string; external: string;
    rssBytes: number; heapUsedBytes: number;
  };
  websocket: { activeConnections: number };
  slo: {
    deploymentFrozen: boolean;
    freezeReasons: string[];
  };
  checks: { name: string; status: 'pass' | 'fail'; durationMs: number; error?: string }[];
  responseTimeMs: number;
}

const VERSION = process.env.npm_package_version || '0.2.0';

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
    return { name: 'database_query', status: 'pass', durationMs: Date.now() - start };
  } catch (err) {
    return { name: 'database_query', status: 'fail', durationMs: Date.now() - start, error: String(err) };
  }
}

async function checkDatabaseWrite(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Test a lightweight write (COUNT is a read, use a temp approach)
    await db.$queryRaw`SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'`;
    return { name: 'database_schema_read', status: 'pass', durationMs: Date.now() - start };
  } catch (err) {
    return { name: 'database_schema_read', status: 'fail', durationMs: Date.now() - start, error: String(err) };
  }
}

// ─── GET Handler ───────────────────────────────────────────────────────

// GET /api/health — Enhanced health check with deep probes and SLI data
export async function GET() {
  const start = Date.now();

  // Run deep checks in parallel
  const [dbCheck, dbWriteCheck] = await Promise.all([
    checkDatabase(),
    checkDatabaseWrite(),
  ]);

  const dbLatencyMs = dbCheck.durationMs;
  const dbStatus = dbCheck.status === 'pass' ? 'ok' : 'error';

  // Determine overall status
  const allChecks = [dbCheck, dbWriteCheck];
  const hasFailure = allChecks.some(c => c.status === 'fail');
  const overallStatus: HealthResponse['status'] = hasFailure ? 'degraded' : 'healthy';

  const uptimeMs = process.uptime() * 1000;
  const memUsage = process.memoryUsage();

  // SLO deployment freeze check
  const freezeStatus = sloTracker.isDeploymentFrozen();

  // WebSocket active connections
  const wsConnections = activeConnections.getValue();

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: {
      milliseconds: Math.round(uptimeMs),
      human: formatDuration(uptimeMs),
    },
    database: {
      status: dbStatus as 'ok' | 'error',
      latencyMs: dbLatencyMs,
      engine: 'sqlite',
    },
    runtime: {
      name: process.version,
      platform: process.platform,
    },
    memory: {
      rss: formatBytes(memUsage.rss),
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      external: formatBytes(memUsage.external),
      rssBytes: memUsage.rss,
      heapUsedBytes: memUsage.heapUsed,
    },
    websocket: {
      activeConnections: wsConnections,
    },
    slo: {
      deploymentFrozen: freezeStatus.frozen,
      freezeReasons: freezeStatus.reasons,
    },
    checks: allChecks,
    responseTimeMs: Date.now() - start,
  };

  // Return 503 if unhealthy
  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
