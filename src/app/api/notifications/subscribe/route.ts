import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { addSubscription, removeSubscription } from '@/lib/push-store';

/**
 * POST /api/notifications/subscribe
 *
 * Accepts a PushSubscription from the client and stores it
 * associated with the authenticated user and tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription' },
        { status: 400 },
      );
    }

    addSubscription(authUser.tenantId, authUser.userId, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/notifications/subscribe?endpoint=...
 *
 * Removes a push subscription by its endpoint URL.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpoint query parameter is required' },
        { status: 400 },
      );
    }

    removeSubscription(endpoint);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 },
    );
  }
}
