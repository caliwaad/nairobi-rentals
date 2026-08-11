import { eq } from 'drizzle-orm';
import { Webhook } from 'svix';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk } from '@/lib/auth';
import { clerkWebhookSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const raw = (v: string | null) => v || undefined;
const firstEmail = (data: {
  email_addresses?: Array<{ email_address: string }>;
}) => data.email_addresses?.[0]?.email_address;

/**
 * POST /api/clerk/webhook — Clerk user.created/updated/deleted → Neon `users`.
 * Signed with Svix (CLERK_WEBHOOK_SECRET from the dashboard); unknown or
 * malformed events are acknowledged without touching the DB.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) return jsonError('Webhook secret is not configured.', 500);

    const payload = await request.text();
    const headers = request.headers;
    const svixId = headers.get('svix-id');
    const svixTimestamp = headers.get('svix-timestamp');
    const svixSignature = headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return jsonError('Missing Svix signature headers.', 400);
    }

    let event: unknown;
    try {
      event = new Webhook(secret).verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      return jsonError('Invalid webhook signature.', 400);
    }

    const parsed = clerkWebhookSchema.safeParse(event);
    if (!parsed.success) {
      // Not a user event we care about (or malformed) — acknowledge and move on.
      return jsonOk({ received: true, ignored: true });
    }

    const { type, data } = parsed.data;
    const db = getDb();

    if (type === 'user.deleted') {
      await db.delete(users).where(eq(users.clerkId, data.id));
      return jsonOk({ received: true, action: 'deleted' });
    }

    const email = firstEmail(data);
    const name =
      [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || undefined;
    const avatarUrl = data.image_url || undefined;

    await db
      .insert(users)
      .values({
        clerkId: data.id,
        username: data.username || undefined,
        name,
        email,
        avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          username: data.username || undefined,
          name,
          email,
          avatarUrl,
          updatedAt: new Date(),
        },
      });

    return jsonOk({ received: true, action: type === 'user.created' ? 'created' : 'updated' });
  } catch (e) {
    return handleRouteError(e);
  }
}
