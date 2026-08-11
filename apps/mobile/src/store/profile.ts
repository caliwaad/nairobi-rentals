import { create } from 'zustand';

/**
 * Matches PLAN.md `users` model: username (self-chosen, shown on reviews),
 * contact fields, and realtor application status.
 */
export type RealtorStatus = 'pending' | 'approved' | 'rejected' | null;

type ProfileState = {
  /** Clerk user id this profile belongs to (null until first sync). */
  userId: string | null;
  username: string;
  email: string;
  phone: string;
  /** Local URI of the chosen profile photo (uploaded to Cloudinary in Phase 3). */
  avatarUri: string | null;
  realtorStatus: RealtorStatus;
  setUserId: (userId: string) => void;
  setUsername: (username: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setAvatarUri: (uri: string | null) => void;
  applyRealtor: () => void;
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
  setUserId: (userId) => set({ userId }),
  setUsername: (username) => set({ username }),
  setEmail: (email) => set({ email }),
  setPhone: (phone) => set({ phone }),
  setAvatarUri: (avatarUri) => set({ avatarUri }),
  applyRealtor: () => set({ realtorStatus: 'pending' }),
  reset: () =>
    set({ userId: null, username: '', email: '', phone: '', avatarUri: null, realtorStatus: null }),
}));
