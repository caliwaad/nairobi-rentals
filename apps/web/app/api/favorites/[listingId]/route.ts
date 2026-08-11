import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { favorites, listings } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findApprovedListing(listingId: string) {
  if (!UUID_RE.test(listingId)) return null;
  const db = getDb();
  return db.query.listings.findFirst({
    where: and(eq(listings.id, listingId), eq(listings.status, 'approved')),
  });
}

/** POST /api/favorites/:listingId — save (idempotent). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;
    const { listingId } = await params;

    const listing = await findApprovedListing(listingId);
    if (!listing) return jsonError('Listing not found.', 404);

    await getDb()
      .insert(favorites)
      .values({ userId: authed.user.id, listingId })
      .onConflictDoNothing();
    return jsonOk({ favorited: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** DELETE /api/favorites/:listingId — remove (idempotent). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;
    const { listingId } = await params;

    await getDb()
      .delete(favorites)
      .where(
        and(eq(favorites.userId, authed.user.id), eq(favorites.listingId, listingId)),
      );
    return jsonOk({ favorited: false });
  } catch (e) {
    return handleRouteError(e);
  }
}
