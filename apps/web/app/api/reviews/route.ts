import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { listings, reviews } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireUser } from '@/lib/auth';
import { reviewUpsertSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reviews — signed-in users rate a listing 1–5.
 * One review per user per listing (upsert), no self-reviews (decision #12).
 */
export async function POST(request: NextRequest) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;

    const body = await request.json().catch(() => null);
    const parsed = reviewUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(`Invalid review: ${parsed.error.issues[0]?.message}`, 422);
    }
    const { listingId, stars, comment } = parsed.data;

    const db = getDb();
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    if (!listing || listing.status !== 'approved') {
      return jsonError('Listing not found.', 404);
    }
    if (listing.realtorId === authed.user.id) {
      return jsonError('You cannot review your own listing.', 403);
    }

    const [review] = await db
      .insert(reviews)
      .values({
        listingId,
        userId: authed.user.id,
        stars,
        comment: comment || null,
      })
      .onConflictDoUpdate({
        target: [reviews.listingId, reviews.userId],
        set: { stars, comment: comment || null, updatedAt: sql`now()` },
      })
      .returning();

    return jsonOk({ review });
  } catch (e) {
    return handleRouteError(e);
  }
}
