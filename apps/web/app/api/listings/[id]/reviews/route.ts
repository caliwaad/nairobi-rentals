import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { reviews, users } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/listings/:id/reviews — public, newest first, usernames only (no PII). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError('Listing not found.', 404);

    const db = getDb();
    const rows = await db
      .select({
        id: reviews.id,
        stars: reviews.stars,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        username: users.username,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.listingId, id))
      .orderBy(desc(reviews.createdAt));

    return jsonOk({ reviews: rows });
  } catch (e) {
    return handleRouteError(e);
  }
}
