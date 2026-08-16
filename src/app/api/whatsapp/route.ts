import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:9090';

// Check if the Go bridge is reachable
async function isBridgeAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/whatsapp/tenants`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Proxy helper — only used when bridge is confirmed alive
async function proxyToBridge(path: string, init?: RequestInit) {
  const url = `${BRIDGE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

// ─── Mock state (active when WHATSAPP_BRIDGE_URL is unreachable) ─────
// In production, deploy the Go WhatsApp bridge service and set WHATSAPP_BRIDGE_URL
// to enable real WhatsApp messaging. Without the bridge, all messages use
// in-app delivery and the mock QR/session state below.
//
// NOTE: This in-memory state is lost on server restart and does not persist
// across multiple server instances. For production, the Go bridge handles
// all WhatsApp state. This mock exists only for development/demo purposes.
const mockClients = new Map<string, {
  phone: string;
  jid: string;
  status: string;
  qrCode: string;
  connectedAt: string | null;
  messageCount: number;
}>();

// Helper: convert phone to JID
function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? '234' + digits.slice(1) : digits;
  return `${normalized}@s.whatsapp.net`;
}

// ─── GET: Status ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    // Try bridge first
    const bridgeAlive = await isBridgeAlive();
    if (bridgeAlive) {
      return proxyToBridge(`/api/whatsapp/status/${tenantId}`);
    }

    // Built-in mock mode — read from DB
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappPhone: true, whatsappJid: true, whatsappStatus: true, whatsappConnectedAt: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Check in-memory state for richer info (e.g., QR code)
    const memClient = mockClients.get(tenantId);
    const status = memClient?.status || tenant.whatsappStatus || 'DISCONNECTED';

    return NextResponse.json({
      tenantId,
      phone: tenant.whatsappPhone || memClient?.phone || '',
      jid: tenant.whatsappJid || memClient?.jid || '',
      status,
      qrCode: memClient?.qrCode || '',
      connectedAt: tenant.whatsappConnectedAt?.toISOString() || memClient?.connectedAt || null,
      messageCount: memClient?.messageCount || 0,
      mode: 'MOCK',
    });
  } catch (error) {
    console.error('WhatsApp GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch WhatsApp status' }, { status: 500 });
  }
}

// ─── POST: Link / Start linking ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, phone } = body;

    if (!tenantId || !phone) {
      return NextResponse.json({ error: 'tenantId and phone are required' }, { status: 400 });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    // Validate tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Try bridge first
    const bridgeAlive = await isBridgeAlive();
    if (bridgeAlive) {
      return proxyToBridge('/api/whatsapp/link', {
        method: 'POST',
        body: JSON.stringify({ tenantId, phone }),
      });
    }

    // Built-in mock mode
    const jid = phoneToJid(phone);
    const mockQR = `MOCK_QR_${crypto.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

    // Store in memory
    mockClients.set(tenantId, {
      phone,
      jid,
      status: 'QR_READY',
      qrCode: mockQR,
      connectedAt: null,
      messageCount: 0,
    });

    // Update DB to QR_READY
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhone: phone,
        whatsappStatus: 'QR_READY',
      },
    });

    // Simulate auto-scan after 3 seconds
    setTimeout(async () => {
      const client = mockClients.get(tenantId);
      if (client && client.status === 'QR_READY') {
        client.status = 'CONNECTED';
        client.qrCode = '';
        client.connectedAt = new Date().toISOString();

        await db.tenant.update({
          where: { id: tenantId },
          data: {
            whatsappStatus: 'CONNECTED',
            whatsappJid: jid,
            whatsappConnectedAt: new Date(),
          },
        }).catch(console.error);

        console.debug(`[WA-MOCK] Tenant ${tenantId} auto-connected as ${jid}`);
      }
    }, 3000);

    return NextResponse.json({
      tenantId,
      phone,
      jid,
      status: 'QR_READY',
      qrCode: mockQR,
      connectedAt: null,
      messageCount: 0,
      mode: 'MOCK',
    });
  } catch (error) {
    console.error('WhatsApp POST error:', error);
    return NextResponse.json({ error: 'Failed to initiate WhatsApp linking' }, { status: 500 });
  }
}

// ─── PUT: Disconnect / Send ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const action = searchParams.get('action');

    if (action === 'disconnect') {
      const tenantId = searchParams.get('tenantId');
      if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
      }

      const authUser = await getAuthUser(req);
      if (!authUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;

      // Try bridge first
      const bridgeAlive = await isBridgeAlive();
      if (bridgeAlive) {
        return proxyToBridge(`/api/whatsapp/disconnect/${tenantId}`, { method: 'POST' });
      }

      // Built-in mock mode
      mockClients.delete(tenantId);
      await db.tenant.update({
        where: { id: tenantId },
        data: {
          whatsappStatus: 'DISCONNECTED',
          whatsappJid: null,
          whatsappConnectedAt: null,
        },
      });

      return NextResponse.json({ success: true, status: 'DISCONNECTED', mode: 'MOCK' });
    }

    if (action === 'send') {
      const body = await req.json();
      const { tenantId, messageId, toPhone, subject, body: msgBody } = body;

      const authUser = await getAuthUser(req);
      if (authUser && tenantId) {
        const tenantErr = requireTenantMatch(authUser, tenantId);
        if (tenantErr) return tenantErr;
      }

      // Try bridge first
      const bridgeAlive = await isBridgeAlive();
      if (bridgeAlive) {
        return proxyToBridge('/api/whatsapp/send', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      // Built-in mock mode — simulate successful send
      const client = mockClients.get(tenantId || '');
      if (client) {
        client.messageCount = (client.messageCount || 0) + 1;
      }

      return NextResponse.json({
        success: true,
        whatsappMessageId: `mock_wamid_${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: 'MOCK',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('WhatsApp PUT error:', error);
    return NextResponse.json({ error: 'WhatsApp operation failed' }, { status: 500 });
  }
}