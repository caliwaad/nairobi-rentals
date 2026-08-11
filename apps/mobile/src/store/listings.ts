import { useMemo } from 'react';
import { create } from 'zustand';

import { SAMPLE_LISTINGS, type Listing } from '@/data/sample-listings';

/**
 * User-published listings (in-memory for now).
 * Phase 3 swaps this for the Listings API backed by Neon — the store stays as
 * the single client-side source so screens don't need to change.
 */
interface ListingsState {
  userListings: Listing[];
  addListing: (listing: Listing) => void;
}

export const useListingsStore = create<ListingsState>()((set) => ({
  userListings: [],
  addListing: (listing) => set((state) => ({ userListings: [listing, ...state.userListings] })),
}));

/**
 * Every listing the app shows: user-published first (newest on top), then the
 * sample seed. Returns a stable reference that only changes when userListings
 * changes, so screens can safely use it in useMemo deps.
 */
export function useAllListings(): Listing[] {
  const userListings = useListingsStore((s) => s.userListings);
  return useMemo(() => [...userListings, ...SAMPLE_LISTINGS], [userListings]);
}
