import { Platform } from 'react-native';

import type { Listing, Review } from '@/data/sample-listings';

/**
 * API base URL.
 * - Web dev: the Next.js API (port 3000) next to Metro (8081).
 * - Native: `EXPO_PUBLIC_API_URL` should point at your machine's LAN IP —
 *   localhost on a phone is the phone itself.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web' ? 'http://localhost:3000' : 'http://localhost:3000');

/** Raw shape returned by the Next.js listings endpoints. */
export interface ApiListing {
  id: string;
  title: string;
  description: string;
  /** KES per month. */
  price: number;
  size: Listing['size'];
  neighborhood: string;
  addressText: string | null;
  lat: number;
  lng: number;
  unitAmenities: string[];
  houseRules: string[];
  /** 0–5, one decimal. */
  rating: number;
  reviewCount: number;
  images: string[];
  realtorUsername: string | null;
  realtorPhone: string | null;
}

interface ApiListResponse {
  listings: ApiListing[];
  total: number;
  page: number;
  pageSize: number;
}

interface ApiReviewsResponse {
  reviews: Array<{
    id: string;
    stars: number;
    comment: string | null;
    createdAt: string;
    username: string | null;
  }>;
}

/** `0712 345 678` → `254712345678` (local format → international digits). */
function phoneToWhatsapp(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  return digits;
}

/** ISO timestamp → 'Jul 2026' style label (matches the sample review dates). */
function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Maps an API listing to the app's Listing shape (what screens render). */
export function apiListingToListing(api: ApiListing): Listing {
  return {
    id: api.id,
    title: api.title,
    price: api.price,
    size: api.size,
    neighborhood: api.neighborhood,
    address: api.addressText ?? '',
    lat: api.lat,
    lng: api.lng,
    rating: api.rating,
    reviewCount: api.reviewCount,
    amenities: api.unitAmenities ?? [],
    houseRules: api.houseRules ?? [],
    phone: api.realtorPhone ?? '',
    whatsapp: phoneToWhatsapp(api.realtorPhone),
    images: api.images,
    description: api.description,
    reviews: [],
  };
}

async function fetchJson<T>(path: string, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    throw new Error('The server returned an error — try again in a moment.');
  }
  return (await res.json()) as T;
}

async function mutateJson<T>(
  path: string,
  method: 'POST' | 'DELETE',
  token: string | null,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    throw new Error('The server returned an error — try again in a moment.');
  }
  return (await res.json()) as T;
}

/** GET /api/listings — the browse feed (approved listings, newest first). */
export async function fetchListings(): Promise<Listing[]> {
  const data = await fetchJson<ApiListResponse>('/api/listings');
  return data.listings.map(apiListingToListing);
}

/** GET /api/listings/:id — a single listing (for the detail screen). */
export async function fetchListing(id: string): Promise<Listing | null> {
  try {
    const data = await fetchJson<{ listing: ApiListing }>(`/api/listings/${id}`);
    return apiListingToListing(data.listing);
  } catch {
    return null;
  }
}

/** GET /api/listings/:id/reviews — newest first, usernames only. */
export async function fetchListingReviews(listingId: string): Promise<Review[]> {
  const data = await fetchJson<ApiReviewsResponse>(`/api/listings/${listingId}/reviews`);
  return data.reviews.map((r) => ({
    username: r.username ?? 'Tenant',
    stars: r.stars,
    comment: r.comment ?? '',
    date: formatReviewDate(r.createdAt),
  }));
}

/** GET /api/favorites — the signed-in user's saved listing ids. */
export async function fetchFavoriteIds(token: string): Promise<string[]> {
  const data = await fetchJson<{ favorites: Array<{ id: string }> }>('/api/favorites', token);
  return data.favorites.map((f) => f.id);
}

/** POST /api/favorites/:listingId — save (idempotent). */
export async function addFavorite(listingId: string, token: string | null): Promise<void> {
  await mutateJson<{ favorited: boolean }>(`/api/favorites/${listingId}`, 'POST', token);
}

/** DELETE /api/favorites/:listingId — remove (idempotent). */
export async function removeFavorite(listingId: string, token: string | null): Promise<void> {
  await mutateJson<{ favorited: boolean }>(`/api/favorites/${listingId}`, 'DELETE', token);
}

/** POST /api/reviews — create/update the signed-in user's review (1–5, upsert). */
export async function submitReview(
  listingId: string,
  stars: number,
  comment: string,
  token: string | null,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ listingId, stars, comment }),
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t save your review. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
}
