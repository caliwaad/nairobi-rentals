import { create } from 'zustand';

/**
 * Shared favourites state (in-memory for now).
 * Phase 4 swaps persistence to the Favorites API backed by Neon.
 */
interface FavoritesState {
  favoriteIds: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favoriteIds: [],
  toggle: (id) =>
    set((state) => ({
      favoriteIds: state.favoriteIds.includes(id)
        ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
        : [...state.favoriteIds, id],
    })),
  clear: () => set({ favoriteIds: [] }),
}));

/** Selector hook — re-renders only when this id's membership changes. */
export const useIsFavorite = (id: string) =>
  useFavoritesStore((state) => state.favoriteIds.includes(id));
