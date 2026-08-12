import { useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';

import { fetchListings } from '@/lib/api';
import type { Listing } from '@/data/sample-listings';

export type ListingsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * API-backed listings state (Phase 4). Home fetches on mount; the store stays
 * the single client-side source so Favourites and Detail read the same data.
 * Locally published listings (realtor form) still prepend until publish is
 * wired to POST /api/listings.
 */
interface ListingsState {
  listings: Listing[];
  userListings: Listing[];
  status: ListingsStatus;
  error: string | null;
  fetchListings: () => Promise<void>;
  addListing: (listing: Listing) => void;
  /** Replaces a listing in place (e.g. refreshed rating after a review). */
  updateListing: (listing: Listing) => void;
}

export const useListingsStore = create<ListingsState>()((set, get) => ({
  listings: [],
  userListings: [],
  status: 'idle',
  error: null,
  fetchListings: async () => {
    // Don't clobber a successful load with a duplicate in-flight request.
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const listings = await fetchListings();
      set({ listings, status: 'ready' });
    } catch (e) {
      set({
        status: 'error',
        error:
          e instanceof Error
            ? e.message
            : 'Couldn’t load homes. Is the API server running?',
      });
    }
  },
  addListing: (listing) =>
    set((state) => ({ userListings: [listing, ...state.userListings] })),
  updateListing: (updated) =>
    set((state) => ({
      listings: state.listings.map((l) => (l.id === updated.id ? updated : l)),
      userListings: state.userListings.map((l) => (l.id === updated.id ? updated : l)),
    })),
}));

/**
 * Every listing the app shows: locally published first (newest on top), then
 * the API feed. Stable reference that only changes when inputs change.
 */
export function useAllListings(): Listing[] {
  const listings = useListingsStore((s) => s.listings);
  const userListings = useListingsStore((s) => s.userListings);
  return useMemo(() => [...userListings, ...listings], [listings, userListings]);
}

/**
 * Fetches the browse feed once on mount. Idempotent per status, so screens
 * that share the store don't each trigger a request.
 */
export function useFetchListingsOnMount() {
  const status = useListingsStore((s) => s.status);
  const fetchListings = useListingsStore((s) => s.fetchListings);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void fetchListings();
  }, [fetchListings]);

  return status;
}
