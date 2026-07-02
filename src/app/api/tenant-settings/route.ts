import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';

// GET /api/tenant-settings — fetch current tenant settings
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        primaryColor: true,
        mapBounds: true,
      },
    });

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Parse mapBounds — "null" string means not configured
    let mapBounds = null;
    if (tenant.mapBounds && tenant.mapBounds !== 'null') {
      try {
        mapBounds = JSON.parse(tenant.mapBounds);
      } catch {
        mapBounds = null;
      }
    }

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      primaryColor: tenant.primaryColor,
      mapBounds,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/tenant-settings — update tenant settings
export async function PUT(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const body = await req.json();
    const { mapBounds } = body;

    // Validate mapBounds if provided
    if (mapBounds) {
      const { minLat, maxLat, minLng, maxLng } = mapBounds;
      if (
        typeof minLat !== 'number' || typeof maxLat !== 'number' ||
        typeof minLng !== 'number' || typeof maxLng !== 'number' ||
        minLat >= maxLat || minLng >= maxLng
      ) {
        return NextResponse.json(
          { error: 'Invalid map bounds. Need: minLat < maxLat, minLng < maxLng (all numbers).' },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (mapBounds !== undefined) {
      updateData.mapBounds = mapBounds ? JSON.stringify(mapBounds) : 'null';
    }

    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: { id: true, name: true, mapBounds: true },
    });

    let parsedBounds = null;
    if (tenant.mapBounds && tenant.mapBounds !== 'null') {
      try { parsedBounds = JSON.parse(tenant.mapBounds); } catch { /* ignore */ }
    }

    return NextResponse.json({
      success: true,
      id: tenant.id,
      name: tenant.name,
      mapBounds: parsedBounds,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}