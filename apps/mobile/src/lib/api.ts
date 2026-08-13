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
  /** Approval state — pending/rejected rows only show via /mine. */
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
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

/** GET /api/listings/mine — the signed-in user's own listings (all statuses). */
export async function fetchMyListings(token: string): Promise<ApiListing[]> {
  const data = await fetchJson<{ listings: ApiListing[] }>('/api/listings/mine', token);
  return data.listings;
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

/** Payload for POST /api/listings (mirrors listingCreateSchema on the web). */
export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  size: Listing['size'];
  neighborhood: string;
  addressText: string;
  lat: number;
  lng: number;
  unitAmenities: string[];
  houseRules: string[];
  images: string[];
}

/**
 * POST /api/listings — approved realtor publishes; the listing starts as
 * `pending` and only reaches the feed after admin approval.
 */
export async function createListing(
  input: CreateListingInput,
  token: string | null,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t publish the listing. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { listing?: { id: string } };
  const id = data.listing?.id;
  if (!id) throw new Error('The server didn’t return a listing id.');
  return id;
}

/** Raw shape of GET /api/me — the signed-in user's profile row. */
export interface ApiMe {
  id: string;
  clerkId: string;
  username: string | null;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: 'user' | 'realtor' | 'admin';
  realtorStatus: 'pending' | 'approved' | 'rejected' | null;
  /** Why a realtor application was declined (admin-set). */
  rejectionReason: string | null;
}

/** GET /api/me — the signed-in user's profile (realtor status lives here). */
export async function fetchMe(token: string | null): Promise<ApiMe> {
  const data = await fetchJson<{ user: ApiMe }>('/api/me', token);
  return data.user;
}

/**
 * PATCH /api/me — update profile fields (username, phone, avatarUrl).
 * Returns the updated user so callers can hydrate their local store.
 */
export async function updateProfile(
  input: { username?: string; phone?: string; avatarUrl?: string },
  token: string | null,
): Promise<ApiMe> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t save your profile. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { user: ApiMe };
  return data.user;
}

/** POST /api/realtor/apply — apply to become a realtor (persists as pending). */
export async function applyAsRealtor(token: string | null): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/realtor/apply`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t submit your application. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
}

/** A realtor application as seen by an admin (GET /api/admin/realtors). */
export interface AdminApplication {
  id: string;
  clerkId: string;
  username: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

/** A pending listing as seen by an admin (GET /api/admin/listings). */
export interface AdminListing {
  id: string;
  title: string;
  price: number;
  size: Listing['size'];
  neighborhood: string;
  images: string[];
  realtorUsername: string | null;
  createdAt: string;
}

/** GET /api/admin/listings — pending listings awaiting approval. */
export async function fetchPendingListings(token: string): Promise<AdminListing[]> {
  const data = await fetchJson<{ listings: AdminListing[] }>('/api/admin/listings', token);
  return data.listings;
}

/** POST /api/admin/listings/:id/approve — make a listing live. */
export async function approveListing(id: string, token: string): Promise<void> {
  await mutateJson(`/api/admin/listings/${id}/approve`, 'POST', token);
}

/** POST /api/admin/listings/:id/reject — decline with an optional reason. */
export async function rejectListing(
  id: string,
  reason: string | null,
  token: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/admin/listings/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t update the listing. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
}

/** GET /api/admin/realtors — pending applications awaiting review. */
export async function fetchPendingRealtors(token: string): Promise<AdminApplication[]> {
  const data = await fetchJson<{ applications: AdminApplication[] }>(
    '/api/admin/realtors',
    token,
  );
  return data.applications;
}

/** POST /api/admin/realtors/:userId/approve — grant realtor access. */
export async function approveRealtor(userId: string, token: string): Promise<void> {
  await mutateJson(`/api/admin/realtors/${userId}/approve`, 'POST', token);
}

/** POST /api/admin/realtors/:userId/reject — decline an application. */
export async function rejectRealtor(
  userId: string,
  reason: string | null,
  token: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/admin/realtors/${userId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t update the application. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
}

/** Shape of GET /api/subscription/status (Phase 5 — realtor paywall). */
export interface SubscriptionStatus {
  configured: boolean;
  /** KES listed price (what the realtor sees). */
  price: number;
  subscription: {
    status: 'pending' | 'active' | 'expired' | 'failed';
    amount: number;
    currentPeriodEnd: string | null;
    lastPaymentAt: string | null;
  } | null;
}

/** GET /api/subscription/status — the approved realtor's subscription state. */
export async function fetchSubscriptionStatus(token: string | null): Promise<SubscriptionStatus> {
  return fetchJson<SubscriptionStatus>('/api/subscription/status', token);
}

/** Shape of POST /api/subscribe — an M-Pesa STK push was initiated. */
export interface SubscribeResult {
  alreadyActive?: boolean;
  subscription: {
    id: string;
    status: 'pending' | 'active' | 'expired' | 'failed';
    amount: number;
    invoiceId: string | null;
  };
  pushed?: {
    invoiceId: string | null;
    apiRef: string | null;
    state: string | null;
  } | null;
}

/** POST /api/subscribe — trigger an M-Pesa STK push for the monthly subscription. */
export async function subscribe(token: string | null): Promise<SubscribeResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/subscribe`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error('Can’t reach the server — check your connection and try again.');
  }
  if (!res.ok) {
    let message = 'Couldn’t start the payment. Try again in a moment.';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
  return (await res.json()) as SubscribeResult;
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
