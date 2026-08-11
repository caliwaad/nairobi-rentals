import { and, eq, getTableColumns } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { listingImages, listings } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk } from '@/lib/auth';
import { ratingColumns } from '@/lib/query';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/listings/:id — public detail with average rating + images. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError('Listing not found.', 404);

    const db = getDb();
    const rows = await db
      .select({ ...getTableColumns(listings), ...ratingColumns })
      .from(listings)
      .where(and(eq(listings.id, id), eq(listings.status, 'approved')));

    const listing = rows[0];
    if (!listing) return jsonError('Listing not found.', 404);

    const images = await db
      .select()
      .from(listingImages)
      .where(eq(listingImages.listingId, id))
      .orderBy(listingImages.sortOrder);

    return jsonOk({
      listing: {
        ...listing,
        images: images.map((img) => img.url),
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
