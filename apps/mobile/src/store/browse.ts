import { create } from 'zustand';

import type { ListingFilters } from '@/data/sample-listings';

/**
 * Carries a browse request from the Explore tab to the Home tab.
 * Explore sets `pending` (e.g. "show me Kilimani") and navigates to Home;
 * Home applies it as its active filters and calls `consume()` to clear it.
 */
interface BrowseState {
  pending: ListingFilters | null;
  request: (filters: ListingFilters) => void;
  consume: () => void;
}

export const useBrowseStore = create<BrowseState>()((set) => ({
  pending: null,
  request: (filters) => set({ pending: filters }),
  consume: () => set({ pending: null }),
}));
