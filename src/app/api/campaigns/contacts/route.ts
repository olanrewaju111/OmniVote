import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';

// POST /api/campaigns/contacts — upload a contact list
export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const body = await req.json();
    const { name, segment, contacts, consentVerified } = body;

    if (!name || !segment) {
      return NextResponse.json({ error: 'name and segment are required' }, { status: 400 });
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'contacts array is required and must not be empty' }, { status: 400 });
    }

    if (contacts.length > 100000) {
      return NextResponse.json({ error: 'Maximum 100,000 contacts per list' }, { status: 400 });
    }

    const count = contacts.length;

    // Create the contact list
    const contactList = await db.contactList.create({
      data: {
        tenantId,
        name,
        segment,
        description: `Uploaded via Mobilization Engine — ${count} contacts`,
        contactCount: count,
        totalUploaded: count,
        optedOutCount: 0,
        hashAlgorithm: 'SHA256',
        consentVerified: consentVerified === true,
        uploadedById: 'system',
      },
    });

    return NextResponse.json({ contactList, contactCount: count }, { status: 201 });
  } catch (err) {
    console.error('Contact upload error:', err);
    return NextResponse.json({ error: 'Failed to upload contacts' }, { status: 500 });
  }
}

// GET /api/campaigns/contacts?tenantId=X — list contact lists
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const contactLists = await db.contactList.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ contactLists });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch contact lists' }, { status: 500 });
  }
}

// DELETE /api/campaigns/contacts?id=X — delete a contact list
export async function DELETE(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const existing = await db.contactList.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Contact list not found' }, { status: 404 });
    }

    await db.contactList.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete contact list' }, { status: 500 });
  }
}