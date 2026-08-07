import { create } from 'zustand';

/**
 * Matches PLAN.md `users` model: username (self-chosen, shown on reviews),
 * contact fields, and realtor application status.
 */
export type RealtorStatus = 'pending' | 'approved' | 'rejected' | null;

type ProfileState = {
  username: string;
  email: string;
  phone: string;
  /** Local URI of the chosen profile photo (uploaded to Cloudinary in Phase 3). */
  avatarUri: string | null;
  realtorStatus: RealtorStatus;
  setUsername: (username: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setAvatarUri: (uri: string | null) => void;
  applyRealtor: () => void;
};

export const useProfileStore = create<ProfileState>()((set) => ({
  username: '',
  email: '',
  phone: '',
  avatarUri: null,
  realtorStatus: null,
  setUsername: (username) => set({ username }),
  setEmail: (email) => set({ email }),
  setPhone: (phone) => set({ phone }),
  setAvatarUri: (avatarUri) => set({ avatarUri }),
  applyRealtor: () => set({ realtorStatus: 'pending' }),
}));
