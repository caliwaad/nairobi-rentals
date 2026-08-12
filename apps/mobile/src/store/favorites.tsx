import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import { useClerkConfigured } from '@/components/auth-provider';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/lib/api';

/**
 * Shared favourites state, synced to the Favorites API (Neon) when signed in.
 * - Signed in: optimistic toggle → server call → rollback on failure.
 * - Signed out: in-memory only (still works for browsing a session).
 */
interface FavoritesState {
  favoriteIds: string[];
  status: 'idle' | 'syncing' | 'ready' | 'error';
  syncFromApi: (token: string) => Promise<void>;
  toggle: (id: string, token: string | null) => Promise<void>;
  clear: (token: string | null) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favoriteIds: [],
  status: 'idle',
  syncFromApi: async (token) => {
    set({ status: 'syncing' });
    try {
      const ids = await fetchFavoriteIds(token);
      set({ favoriteIds: ids, status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },
  toggle: async (id, token) => {
    const currentlySaved = get().favoriteIds.includes(id);
    // Optimistic flip.
    set((state) => ({
      favoriteIds: currentlySaved
        ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
        : [...state.favoriteIds, id],
    }));
    if (!token) return; // Signed out — local only.
    try {
      if (currentlySaved) {
        await removeFavorite(id, token);
      } else {
        await addFavorite(id, token);
      }
    } catch {
      // Roll back on failure so the UI matches the server.
      set((state) => ({
        favoriteIds: currentlySaved
          ? [...state.favoriteIds, id]
          : state.favoriteIds.filter((favoriteId) => favoriteId !== id),
      }));
    }
  },
  clear: async (token) => {
    const ids = get().favoriteIds;
    set({ favoriteIds: [] });
    if (!token || ids.length === 0) return;
    await Promise.allSettled(ids.map((id) => removeFavorite(id, token)));
  },
}));

/** Selector hook — re-renders only when this id's membership changes. */
export const useIsFavorite = (id: string) =>
  useFavoritesStore((state) => state.favoriteIds.includes(id));

/** Syncs the server's saved homes into the store once, when a session appears. */
function FavoritesSyncInner() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const syncFromApi = useFavoritesStore((s) => s.syncFromApi);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || syncedRef.current) return;
    syncedRef.current = true;
    void getToken().then((token) => {
      if (token) void syncFromApi(token);
    });
  }, [isLoaded, isSignedIn, getToken, syncFromApi]);

  return null;
}

/**
 * Mount once (e.g. in the root layout) inside the auth tree. Renders nothing.
 * When Clerk isn't configured it renders nothing and skips the auth hooks.
 */
export function FavoritesSync() {
  const configured = useClerkConfigured();
  if (!configured) return null;
  return <FavoritesSyncInner />;
}
