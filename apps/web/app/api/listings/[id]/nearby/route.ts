import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { getDb } from '@/db';
import { listings, nearbyPlacesCache } from '@/db/schema';
import { handleRouteError, jsonError, jsonOk } from '@/lib/auth';
import {
  buildStaticMapUrl,
  cacheKeyFor,
  fetchNearbyPlaces,
  isNearbyCacheFresh,
  placesConfigured,
  type NearbyPlace,
} from '@/lib/places';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/listings/:id/nearby — the listing's map pin + nearby facilities
 * (schools, churches, supermarkets, malls) from the Google Places API (New).
 *
 * Cache-first: results are keyed on the listing's rounded lat/lng grid cell
 * (PLAN assumption #5 — the cost-saver), TTL 7 days. Without a Places key the
 * route answers `configured: false` so the app degrades gracefully.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError('Listing not found.', 404);

    const db = getDb();
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, id),
    });
    if (!listing) return jsonError('Listing not found.', 404);

    const configured = placesConfigured();
    const mapImageUrl = buildStaticMapUrl(listing.lat, listing.lng);

    if (!configured) {
      return jsonOk({ configured: false, mapImageUrl: null, nearby: [], source: 'unconfigured' });
    }

    const key = cacheKeyFor(listing.lat, listing.lng);
    const cached = await db.query.nearbyPlacesCache.findFirst({ where: eq(nearbyPlacesCache.key, key) });
    if (cached && isNearbyCacheFresh(cached.fetchedAt, new Date())) {
      return jsonOk({
        configured: true,
        mapImageUrl,
        nearby: cached.payload as NearbyPlace[],
        source: 'cache',
      });
    }

    try {
      const nearby = await fetchNearbyPlaces(listing.lat, listing.lng);
      await db
        .insert(nearbyPlacesCache)
        .values({ key, payload: nearby as never })
        .onConflictDoUpdate({
          target: nearbyPlacesCache.key,
          set: { payload: nearby as never, fetchedAt: new Date() },
        });
      return jsonOk({ configured: true, mapImageUrl, nearby, source: 'live' });
    } catch (e) {
      // Don't cache provider errors; fall back to a stale cached cell if one
      // exists so the section never hard-fails.
      if (cached) {
        return jsonOk({
          configured: true,
          mapImageUrl,
          nearby: cached.payload as NearbyPlace[],
          source: 'stale-cache',
        });
      }
      const message = e instanceof Error ? e.message : 'Places API request failed.';
      return jsonOk({ configured: true, mapImageUrl, nearby: [], source: 'error', error: message });
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
