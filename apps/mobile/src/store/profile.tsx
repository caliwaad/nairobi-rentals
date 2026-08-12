import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import { useClerkConfigured } from '@/components/auth-provider';
import { fetchMe } from '@/lib/api';

/**
 * Matches PLAN.md `users` model: username (self-chosen, shown on reviews),
 * contact fields, and realtor application status. The API (`/api/me`) is the
 * source of truth for everything except email, which lives in Clerk.
 */
export type RealtorStatus = 'pending' | 'approved' | 'rejected' | null;

export type UserRole = 'user' | 'realtor' | 'admin';

/** Values to merge into the store from the API (undefined = leave as-is). */
export interface ProfilePatch {
  userId?: string;
  username?: string;
  phone?: string;
  /** undefined = keep current; string/null = set or clear. */
  avatarUri?: string | null;
  realtorStatus?: RealtorStatus;
  role?: UserRole;
}

type ProfileState = {
  /** Clerk user id this profile belongs to (null until first sync). */
  userId: string | null;
  username: string;
  email: string;
  phone: string;
  /** Local URI of the chosen profile photo (uploaded to Cloudinary in Phase 3). */
  avatarUri: string | null;
  realtorStatus: RealtorStatus;
  /** 'admin' unlocks the admin console; 'realtor' the publish form. */
  role: UserRole;
  setUserId: (userId: string) => void;
  setUsername: (username: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setAvatarUri: (uri: string | null) => void;
  applyRealtor: () => void;
  /** Merges API profile values in (authoritative over local state). */
  hydrate: (patch: ProfilePatch) => void;
  /** Clears account-bound fields (used on sign-out). */
  reset: () => void;
};

export const useProfileStore = create<ProfileState>()((set) => ({
  userId: null,
  username: '',
  email: '',
  phone: '',
  avatarUri: null,
  realtorStatus: null,
  role: 'user',
  setUserId: (userId) => set({ userId }),
  setUsername: (username) => set({ username }),
  setEmail: (email) => set({ email }),
  setPhone: (phone) => set({ phone }),
  setAvatarUri: (avatarUri) => set({ avatarUri }),
  applyRealtor: () => set({ realtorStatus: 'pending' }),
  hydrate: (patch) =>
    set((state) => ({
      userId: patch.userId ?? state.userId,
      username: patch.username ?? state.username,
      phone: patch.phone ?? state.phone,
      avatarUri: patch.avatarUri === undefined ? state.avatarUri : patch.avatarUri,
      realtorStatus: patch.realtorStatus ?? state.realtorStatus,
      role: patch.role ?? state.role,
    })),
  reset: () =>
    set({
      userId: null,
      username: '',
      email: '',
      phone: '',
      avatarUri: null,
      realtorStatus: null,
      role: 'user',
    }),
}));

/** Pulls the server profile into the store once, when a session appears. */
function ProfileSyncInner() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || syncedRef.current) return;
    syncedRef.current = true;
    void getToken().then((token) => {
      if (!token) return;
      void fetchMe(token)
        .then((me) => {
          useProfileStore.getState().hydrate({
            userId: me.clerkId,
            username: me.username ?? '',
            phone: me.phone ?? '',
            avatarUri: me.avatarUrl ?? undefined,
            realtorStatus: me.realtorStatus,
            role: me.role,
          });
        })
        .catch(() => {
          // Keep whatever we have locally; the profile screen stays usable.
        });
    });
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

/**
 * Mount once (e.g. in the root layout) inside the auth tree. Renders nothing.
 * When Clerk isn't configured it renders nothing and skips the auth hooks.
 */
export function ProfileSync() {
  const configured = useClerkConfigured();
  if (!configured) return null;
  return <ProfileSyncInner />;
}
