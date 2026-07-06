import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/health — public health check endpoint
export async function GET() {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = 'error';
  }

  const uptimeMs = process.uptime() * 1000;
  const memUsage = process.memoryUsage();

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: {
      milliseconds: Math.round(uptimeMs),
      human: formatDuration(uptimeMs),
    },
    database: {
      status: dbStatus,
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
    },
    responseTimeMs: Date.now() - start,
  });
}

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