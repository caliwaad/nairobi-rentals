import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { listingImages, listings, users } from '@/db/schema';
import { handleRouteError, jsonOk, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/listings — admin-only queue of listings awaiting approval
 * (pending), oldest first, with the realtor's name and photos attached.
 */
export async function GET(_request: NextRequest) {
  try {
    const authed = await requireAdmin();
    if (!authed.ok) return authed.response;

    const db = getDb();
    const rows = await db
      .select({
        ...getTableColumns(listings),
        realtorUsername: users.username,
        realtorPhone: users.phone,
      })
      .from(listings)
      .innerJoin(users, eq(listings.realtorId, users.id))
      .where(and(eq(listings.status, 'pending')))
      .orderBy(asc(listings.createdAt));

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
