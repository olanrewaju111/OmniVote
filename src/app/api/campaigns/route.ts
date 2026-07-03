import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/campaigns?tenantId=X — list campaigns with contact lists, stats, and contact list info
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const campaigns = await db.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        contactList: {
          select: { id: true, name: true, segment: true, contactCount: true },
        },
      },
    });

    // Fetch contact lists separately
    const contactLists = await db.contactList.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate stats
    const totalCampaigns = campaigns.length;
    const activeSending = campaigns.filter(c => c.status === 'SENDING').length;
    const totalDelivered = campaigns.reduce((sum, c) => sum + c.deliveredCount, 0);
    const totalOptOuts = campaigns.reduce((sum, c) => sum + c.optOutCount, 0);
    const totalContacts = contactLists.reduce((sum, cl) => sum + cl.contactCount, 0);

    const result = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      templateName: c.templateName,
      templateBody: c.templateBody,
      templateStatus: c.templateStatus,
      contactListId: c.contactListId,
      contactList: c.contactList
        ? { id: c.contactList.id, name: c.contactList.name, segment: c.contactList.segment, contactCount: c.contactList.contactCount }
        : null,
      segment: c.segment,
      status: c.status,
      channel: c.channel,
      scheduledAt: c.scheduledAt,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      rateLimitPerMin: c.rateLimitPerMin,
      totalRecipients: c.totalRecipients,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      readCount: c.readCount,
      failedCount: c.failedCount,
      optOutCount: c.optOutCount,
      consentEnforced: c.consentEnforced,
      wabaCompliant: c.wabaCompliant,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json({
      campaigns: result,
      contactLists,
      stats: { totalCampaigns, activeSending, totalDelivered, totalOptOuts, totalContacts },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST /api/campaigns — create a new campaign
export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const {
      name,
      templateName,
      templateBody,
      contactListId,
      segment,
      scheduledAt,
      channel,
      rateLimitPerMin,
      createdBy,
    } = body;

    if (!name || !templateBody) {
      return NextResponse.json(
        { error: 'name and templateBody are required' },
        { status: 400 },
      );
    }

    const campaign = await db.campaign.create({
      data: {
        tenantId,
        name,
        templateName: templateName || name,
        templateBody,
        contactListId: contactListId || null,
        segment: segment === 'ALL' ? null : (segment || null),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        channel: channel || 'WHATSAPP',
        rateLimitPerMin: parseInt(String(rateLimitPerMin || '1000'), 10),
        createdBy: createdBy || 'system',
        consentEnforced: true,
        wabaCompliant: true,
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

// PUT /api/campaigns — update campaign status
export async function PUT(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['SCHEDULED', 'PAUSED', 'FAILED', 'SENDING'],
      SCHEDULED: ['SENDING', 'PAUSED', 'FAILED', 'DRAFT'],
      SENDING: ['COMPLETED', 'PAUSED', 'FAILED'],
      PAUSED: ['SENDING', 'SCHEDULED', 'FAILED', 'DRAFT'],
      FAILED: ['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED'],
      COMPLETED: ['DRAFT'],
    };

    const targetStatus = status.toUpperCase();
    const allowed = validTransitions[targetStatus];
    if (!allowed) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Verify campaign belongs to tenant
    const existing = await db.campaign.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Validate transition
    if (!allowed.includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${existing.status} to ${status}` },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = { status: targetStatus };
    const now = new Date();
    if (targetStatus === 'SCHEDULED' && !existing.scheduledAt) updateData.scheduledAt = now;
    if (targetStatus === 'SENDING') updateData.startedAt = now;
    if (targetStatus === 'COMPLETED') {
      updateData.completedAt = now;
      // Simulate completion stats if sending
      if (existing.totalRecipients > 0 && existing.sentCount === 0) {
        const total = existing.totalRecipients;
        updateData.sentCount = total;
        updateData.deliveredCount = Math.floor(total * 0.94);
        updateData.readCount = Math.floor(total * 0.68);
        updateData.failedCount = Math.floor(total * 0.03);
      }
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

// DELETE /api/campaigns?id=X — delete campaign and its messages
export async function DELETE(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    // Verify campaign belongs to tenant
    const existing = await db.campaign.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Delete messages first, then campaign
    await db.campaignMessage.deleteMany({ where: { campaignId: id } });
    await db.campaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}