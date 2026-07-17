import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET /api/tenants — list all tenants (SUPER_ADMIN only in practice)
// GET /api/tenants?slug=xxx — public tenant lookup for branded login pages
export async function GET(req: NextRequest) {
  try {
    // Public slug lookup (no auth required) — used by /t/[slug] login pages
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (slug) {
      const tenant = await db.tenant.findFirst({
        where: { slug, isActive: true },
        select: { id: true, name: true, slug: true, primaryColor: true },
      });
      if (!tenant) {
        return NextResponse.json({ tenant: null }, { status: 200 });
      }
      return NextResponse.json({ tenant });
    }

    const authUser = await getAuthUser(new Request(''));
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenants = await db.tenant.findMany({
      select: {
        id: true, name: true, slug: true, primaryColor: true,
        isActive: true, createdAt: true, updatedAt: true, mapBounds: true,
        _count: { select: { users: true, elections: true, incidents: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Parse mapBounds for each tenant
    const parsed = tenants.map(t => {
      let mapBounds = null;
      if (t.mapBounds && t.mapBounds !== 'null') {
        try { mapBounds = JSON.parse(t.mapBounds); } catch { /* ignore */ }
      }
      return { ...t, mapBounds };
    });

    return NextResponse.json({ tenants: parsed });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

// POST /api/tenants — create a new tenant
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, primaryColor, adminName, adminEmail } = body;

    if (!name || !slug || !adminName || !adminEmail) {
      return NextResponse.json({ error: 'name, slug, adminName, adminEmail are required' }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await db.tenant.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `Tenant with slug "${slug}" already exists` }, { status: 409 });
    }

    // Check admin email uniqueness across all tenants
    const existingUser = await db.user.findFirst({ where: { email: adminEmail } });
    if (existingUser) {
      return NextResponse.json({ error: `A user with email "${adminEmail}" already exists in another tenant` }, { status: 409 });
    }

    // Create tenant + SUPER_ADMIN user in a transaction
    const tenant = await db.tenant.create({
      data: {
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
        primaryColor: primaryColor || '#10b981',
        users: {
          create: {
            email: adminEmail,
            name: adminName,
            role: 'SUPER_ADMIN',
          },
        },
      },
      include: {
        users: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        primaryColor: tenant.primaryColor,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        _count: { users: 1, elections: 0, incidents: 0 },
      },
      admin: tenant.users[0],
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create tenant';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/tenants — update a tenant (name, color, active status)
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, primaryColor, isActive } = body;

    if (!id) return NextResponse.json({ error: 'Tenant id is required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const tenant = await db.tenant.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, slug: true, primaryColor: true, isActive: true },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update tenant';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/tenants?id=X — delete a tenant and all its data
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Tenant id is required' }, { status: 400 });

    // Count users to prevent accidental deletion of large tenants
    const userCount = await db.user.count({ where: { tenantId: id } });
    if (userCount > 1) {
      return NextResponse.json(
        { error: `Cannot delete tenant with ${userCount} users. Remove all users except the admin first, or use force delete.` },
        { status: 400 },
      );
    }

    await db.$transaction(async (tx) => {
      // Tier 1: Leaf / child records (reference other tenant-scoped tables via FK)
      await tx.campaignMessage.deleteMany({ where: { tenantId: id } });     // → Campaign
      await tx.stegoScanResult.deleteMany({ where: { tenantId: id } });     // → EvidenceDossier
      await tx.agentCheckIn.deleteMany({ where: { tenantId: id } });        // → GeofenceZone, User
      await tx.pvtSubmission.deleteMany({ where: { tenantId: id } });       // → PollingUnit
      await tx.resultComparison.deleteMany({ where: { tenantId: id } });    // → PollingUnit
      await tx.honeypotUnit.deleteMany({ where: { tenantId: id } });        // → PollingUnit
      await tx.accessibilityReport.deleteMany({ where: { tenantId: id } }); // → PollingUnit
      await tx.deadMansSwitch.deleteMany({ where: { tenantId: id } });      // → User

      // Tier 2: Direct tenantId models (children already deleted above)
      await tx.agentMessage.deleteMany({ where: { tenantId: id } });
      await tx.electionResult.deleteMany({ where: { tenantId: id } });
      await tx.alert.deleteMany({ where: { tenantId: id } });
      await tx.incident.deleteMany({ where: { tenantId: id } });
      await tx.securityEvent.deleteMany({ where: { tenantId: id } });       // → User (deleted in Tier 4)
      await tx.auditLog.deleteMany({ where: { user: { tenantId: id } } });   // → User (deleted in Tier 4)
      await tx.evidenceDossier.deleteMany({ where: { tenantId: id } });     // child StegoScanResult gone
      await tx.geofenceZone.deleteMany({ where: { tenantId: id } });        // child AgentCheckIn gone
      await tx.campaignEvent.deleteMany({ where: { tenantId: id } });
      await tx.voterSuppressionReport.deleteMany({ where: { tenantId: id } });
      await tx.osintPost.deleteMany({ where: { tenantId: id } });
      await tx.flashpointForecast.deleteMany({ where: { tenantId: id } });
      await tx.wargameScenario.deleteMany({ where: { tenantId: id } });
      await tx.campaign.deleteMany({ where: { tenantId: id } });            // child CampaignMessage gone
      await tx.contactList.deleteMany({ where: { tenantId: id } });         // referenced by Campaign (gone)

      // Tier 3: Mid-level parents (children already deleted)
      await tx.pollingUnit.deleteMany({ where: { election: { tenantId: id } } });
      await tx.election.deleteMany({ where: { tenantId: id } });

      // Tier 4: User (all FK references from above tiers already deleted)
      await tx.user.deleteMany({ where: { tenantId: id } });

      // Tier 5: Tenant itself
      await tx.tenant.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete tenant';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}