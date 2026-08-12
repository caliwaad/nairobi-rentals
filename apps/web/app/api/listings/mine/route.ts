import { desc, eq, getTableColumns, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { listingImages, listings } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk, requireUser } from '@/lib/auth';
import { ratingColumns } from '@/lib/query';

export const dynamic = 'force-dynamic';

/**
 * GET /api/listings/mine — the signed-in user's own listings across ALL
 * statuses (pending / approved / rejected), newest first. Unlike the public
 * feed, this shows listings awaiting admin approval so realtors can track them.
 */
export async function GET(_request: NextRequest) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;

    const db = getDb();
    const rows = await db
      .select({ ...getTableColumns(listings), ...ratingColumns })
      .from(listings)
      .where(eq(listings.realtorId, authed.user.id))
      .orderBy(desc(listings.createdAt));

    const ids = rows.map((r) => r.id);
    const images = ids.length
      ? await db
          .select()
          .from(listingImages)
          .where(inArray(listingImages.listingId, ids))
          .orderBy(listingImages.sortOrder)
      : [];
    const imagesByListing = new Map<string, string[]>();
    for (const img of images) {
      const list = imagesByListing.get(img.listingId) ?? [];
      list.push(img.url);
      imagesByListing.set(img.listingId, list);
    }

    const result = rows.map(({ ...listing }) => ({
      ...listing,
      images: imagesByListing.get(listing.id) ?? [],
    }));

    return jsonOk({ listings: result });
  } catch (e) {
    return handleRouteError(e);
  }
}
