import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { favorites, listingImages, listings } from '@/db/schema';
import { handleRouteError, jsonOk, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/favorites — signed-in user's saved listings (approved ones). */
export async function GET(_request: NextRequest) {
  try {
    const authed = await requireUser();
    if (!authed.ok) return authed.response;

    const db = getDb();
    const rows = await db
      .select({ listing: listings })
      .from(favorites)
      .innerJoin(listings, eq(favorites.listingId, listings.id))
      .where(and(eq(favorites.userId, authed.user.id), eq(listings.status, 'approved')))
      .orderBy(favorites.createdAt);

    const ids = rows.map((r) => r.listing.id);
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

    return jsonOk({
      favorites: rows.map(({ listing }) => ({
        ...listing,
        images: imagesByListing.get(listing.id) ?? [],
      })),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
