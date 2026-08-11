import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireUser } from '@/lib/auth';
import { mePatchSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/me — signed-in user's profile. */
export async function GET(_request: NextRequest) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;
    return jsonOk({ user: authed.user });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** PATCH /api/me — edit username / phone / avatar (email edits live in Clerk). */
export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;

    const body = await request.json().catch(() => null);
    const parsed = mePatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(`Invalid profile data: ${parsed.error.issues[0]?.message}`, 422);
    }

    const [updated] = await getDb()
      .update(users)
      .set(parsed.data)
      .where(eq(users.id, authed.user.id))
      .returning();

    return jsonOk({ user: updated });
  } catch (e) {
    return handleRouteError(e);
  }
}
