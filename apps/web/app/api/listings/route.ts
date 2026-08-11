import { count, eq, getTableColumns, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { listingImages, listings, type ListingSize } from '@/db/schema';
import {
  handleRouteError,
  jsonError,
  jsonOk,
  requireApprovedRealtor,
} from '@/lib/auth';
import { andWhere, buildListingWhere, listingOrderBy, ratingColumns } from '@/lib/query';
import { listingCreateSchema, listingQuerySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/listings — public browse feed with filters, sort + pagination. */
export async function GET(request: NextRequest) {
  try {
    const parsed = listingQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return jsonError('Invalid query parameters.', 422);
    }
    const q = parsed.data;
    const amenities = q.amenities
      ? q.amenities.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const where = andWhere([
      ...buildListingWhere({
        size: q.size as ListingSize | undefined,
        neighborhood: q.neighborhood,
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
        amenities,
      }),
      eq(listings.status, 'approved'),
    ]);

    const db = getDb();
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const [rows, totals] = await Promise.all([
      db
        .select({ ...getTableColumns(listings), ...ratingColumns })
        .from(listings)
        .where(where)
        .orderBy(...listingOrderBy(q.sort ?? 'newest'))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(listings).where(where),
    ]);

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

    return jsonOk({ listings: result, total: totals[0]?.total ?? 0, page, pageSize });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** POST /api/listings — approved realtor publishes (starts as `pending`). */
export async function POST(request: NextRequest) {
  try {
    const authed = await requireApprovedRealtor();
    if (!authed.ok) return authed.response;

    const body = await request.json().catch(() => null);
    const parsed = listingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(`Invalid listing data: ${parsed.error.issues[0]?.message}`, 422);
    }
    const data = parsed.data;

    const db = getDb();
    const [listing] = await db
      .insert(listings)
      .values({
        realtorId: authed.user.id,
        title: data.title,
        description: data.description,
        price: data.price,
        size: data.size,
        neighborhood: data.neighborhood,
        addressText: data.addressText,
        lat: data.lat,
        lng: data.lng,
        unitAmenities: data.unitAmenities,
        houseRules: data.houseRules,
      })
      .returning();

    if (data.images.length > 0) {
      await db.insert(listingImages).values(
        data.images.map((url, i) => ({
          listingId: listing.id,
          url,
          sortOrder: i,
          isCover: i === 0,
        })),
      );
    }

    return jsonOk({ listing }, 201);
  } catch (e) {
    return handleRouteError(e);
  }
}
