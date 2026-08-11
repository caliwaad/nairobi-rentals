import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';

import { listings, reviews, type ListingSize } from '@/db/schema';

/**
 * Pure query-building helpers — no DB access, so they're unit-testable and
 * shared by the listings routes.
 */

export interface ListingQueryInput {
  size?: ListingSize | null;
  neighborhood?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  amenities?: string[] | null;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'rating';
}

export type ListingSort = NonNullable<ListingQueryInput['sort']>;

/** WHERE clauses for the listing filters. Empty array = no filtering. */
export function buildListingWhere(input: ListingQueryInput): SQL[] {
  const conditions: SQL[] = [];
  if (input.size) conditions.push(eq(listings.size, input.size));
  if (input.neighborhood) conditions.push(eq(listings.neighborhood, input.neighborhood));
  if (input.minPrice !== null && input.minPrice !== undefined) {
    conditions.push(gte(listings.price, input.minPrice));
  }
  if (input.maxPrice !== null && input.maxPrice !== undefined) {
    conditions.push(lte(listings.price, input.maxPrice));
  }
  if (input.amenities && input.amenities.length > 0) {
    // Listing must include every requested amenity.
    for (const amenity of input.amenities) {
      conditions.push(sql`${listings.unitAmenities} @> ARRAY[${amenity}]::text[]`);
    }
  }
  return conditions;
}

/** ORDER BY for the supported sort modes. */
export function listingOrderBy(sort: ListingSort) {
  switch (sort) {
    case 'price-asc':
      return [asc(listings.price)];
    case 'price-desc':
      return [desc(listings.price)];
    case 'rating':
      return [
        // `${listings}.id` (not `${listings.id}`) — inside the subquery scope a
        // bare `id` resolves to the inner `reviews` table, silently zeroing ratings.
        sql`(select coalesce(avg(r.stars)::float, 0) from ${reviews} r where r.listing_id = ${listings}.id) desc nulls last`,
        desc(listings.createdAt),
      ];
    case 'newest':
    default:
      return [desc(listings.createdAt)];
  }
}

/**
 * Inline subquery columns: average rating (1dp) + review count per listing.
 * Note the qualified `${listings}.id` — a bare column ref would resolve to the
 * inner `reviews` table inside the subquery scope (see listingOrderBy 'rating').
 */
export const ratingColumns = {
  rating: sql<number>`coalesce(round((select avg(r.stars)::float from ${reviews} r where r.listing_id = ${listings}.id)::numeric, 1)::float, 0)`,
  reviewCount: sql<number>`(select count(*) from ${reviews} r where r.listing_id = ${listings}.id)`,
};

export const andWhere = (conditions: SQL[]) =>
  conditions.length > 0 ? and(...conditions) : undefined;

/**
 * Aggregate helper for the detail route — pure given the same rows the SQL
 * view would produce, so the review math stays testable without a DB.
 */
export function computeRating(reviewsForListing: Array<{ stars: number }>): {
  rating: number;
  reviewCount: number;
} {
  const reviewCount = reviewsForListing.length;
  if (reviewCount === 0) return { rating: 0, reviewCount: 0 };
  const total = reviewsForListing.reduce((sum, r) => sum + r.stars, 0);
  return { rating: Math.round((total / reviewCount) * 10) / 10, reviewCount };
}
