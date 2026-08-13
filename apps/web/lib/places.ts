/**
 * Google Maps integration (PLAN decision #18) — Places API (New) for the
 * "nearby facilities" section (schools, churches, supermarkets, malls) and the
 * Static Maps API for the listing map pin.
 *
 * Contract verified against Google's docs (Aug 2026):
 * - Nearby Search (New): POST https://places.googleapis.com/v1/places:searchNearby
 *   headers: Content-Type, X-Goog-Api-Key, X-Goog-FieldMask (required)
 *   body:    { includedTypes, maxResultCount, rankPreference: "DISTANCE",
 *              locationRestriction: { circle: { center: {latitude, longitude}, radius } } }
 * - Static Maps: GET https://maps.googleapis.com/maps/api/staticmap?…&markers=…
 *
 * Caching (PLAN §4-2, assumption #5): results are cached per rounded
 * lat/lng grid cell in Neon, so repeated listing views near the same spot
 * don't re-hit the (billed) Places API. TTL is 7 days.
 *
 * Graceful degradation: every function checks the API key first, so the
 * endpoint answers `configured: false` and the app shows a clear state
 * instead of breaking without keys.
 */

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';

export const NEARBY_RADIUS_METERS = 2000;
export const NEARBY_RESULT_COUNT = 5;
/** How long a cached cell is considered fresh (7 days). */
export const NEARBY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The categories we surface, in display order. Types are Places API Table A. */
export const NEARBY_CATEGORIES = [
  { type: 'school', label: 'Schools', icon: '🏫' },
  { type: 'church', label: 'Churches', icon: '⛪' },
  { type: 'supermarket', label: 'Supermarkets', icon: '🛒' },
  { type: 'shopping_mall', label: 'Malls', icon: '🛍️' },
] as const;

export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number]['type'];

/** A normalized nearby place as returned by the API. */
export interface NearbyPlace {
  name: string;
  /** One of the categories we searched for (used for the icon + label). */
  category: NearbyCategory;
  vicinity: string;
  rating: number | null;
  userRatingCount: number | null;
  /** Straight-line distance from the listing, km (1 decimal). */
  distanceKm: number;
  lat: number;
  lng: number;
}

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

/** Round lat/lng to 2 decimals (~1.1 km cell) — the cache key. */
export function cacheKeyFor(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function isNearbyCacheFresh(fetchedAt: Date, now: Date): boolean {
  return now.getTime() - fetchedAt.getTime() < NEARBY_CACHE_TTL_MS;
}

/** Haversine distance between two coordinates in km. */
export function haversineKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Server-built Static Maps URL with the listing pin (key stays server-side). */
export function buildStaticMapUrl(lat: number, lng: number): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '15',
    size: '600x300',
    scale: '2',
    maptype: 'roadmap',
    markers: `color:red|${lat},${lng}`,
    key,
  });
  return `${STATIC_MAP_URL}?${params.toString()}`;
}

/** Raw single-category response shape from Places API (New). */
interface RawPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
}

interface RawNearbyResponse {
  places?: RawPlace[];
  error?: { message?: string; status?: string };
}

/** One Nearby Search (New) call for a single category, normalized. */
async function searchCategory(
  category: NearbyCategory,
  lat: number,
  lng: number,
  radiusM: number,
  key: string,
): Promise<NearbyPlace[]> {
  const res = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types',
    },
    body: JSON.stringify({
      includedTypes: [category],
      maxResultCount: NEARBY_RESULT_COUNT,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusM,
        },
      },
    }),
  });

  const body = (await res.json().catch(() => null)) as RawNearbyResponse | null;
  if (!res.ok) {
    const message = body?.error?.message ?? `Places API returned HTTP ${res.status}.`;
    throw new Error(message);
  }

  return (body?.places ?? [])
    .filter((p) => p.location?.latitude !== undefined && p.location?.longitude !== undefined)
    .map((p) => {
      const placeLat = p.location!.latitude!;
      const placeLng = p.location!.longitude!;
      return {
        name: p.displayName?.text ?? 'Unnamed place',
        category,
        vicinity: p.formattedAddress ?? '',
        rating: p.rating ?? null,
        userRatingCount: p.userRatingCount ?? null,
        distanceKm: Math.round(haversineKm(lat, lng, placeLat, placeLng) * 10) / 10,
        lat: placeLat,
        lng: placeLng,
      };
    });
}

/**
 * Fetch nearby places for all four categories, sorted by distance. Throws on
 * provider errors — the caller decides how to degrade.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusM = NEARBY_RADIUS_METERS,
): Promise<NearbyPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not configured.');

  const results = await Promise.all(
    NEARBY_CATEGORIES.map((c) => searchCategory(c.type, lat, lng, radiusM, key)),
  );
  return results
    .flat()
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 12);
}
