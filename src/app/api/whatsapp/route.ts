import { NextRequest, NextResponse } from 'next/server';

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:9090';

// Proxy helper
async function proxy(req: NextRequest, path: string, init?: RequestInit) {
  const url = `${BRIDGE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

// POST /api/whatsapp/link — Start WhatsApp linking (generates QR)
export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxy(req, '/api/whatsapp/link', { method: 'POST', body: JSON.stringify(body) });
}

// GET /api/whatsapp/tenants — List all tenant WhatsApp statuses
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');

  if (tenantId) {
    return proxy(req, `/api/whatsapp/status/${tenantId}`);
  }
  return proxy(req, '/api/whatsapp/tenants');
}

// Dynamic route handlers for QR, status, disconnect, send
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'disconnect') {
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    return proxy(req, `/api/whatsapp/disconnect/${tenantId}`, { method: 'POST' });
  }

  if (action === 'send') {
    const body = await req.json();
    return proxy(req, '/api/whatsapp/send', { method: 'POST', body: JSON.stringify(body) });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}