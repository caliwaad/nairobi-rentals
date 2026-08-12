import { useAuth, ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { createContext, useContext, type ReactNode } from 'react';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const ClerkConfigContext = createContext(Boolean(publishableKey));

/** True when EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is set and Clerk is active. */
export function useClerkConfigured() {
  return useContext(ClerkConfigContext);
}

type GetToken = () => Promise<string | null>;

/** No-op default so non-Clerk builds never crash on a missing provider. */
const GetTokenContext = createContext<GetToken>(async () => null);

/**
 * Returns the Clerk session token getter, or a no-op when Clerk isn't
 * configured. Safe to call anywhere — even outside ClerkProvider.
 */
export function useGetToken(): GetToken {
  return useContext(GetTokenContext);
}

/** Bridges the real useAuth().getToken into the context. Rendered inside ClerkProvider. */
function ClerkTokenBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  return <GetTokenContext.Provider value={getToken}>{children}</GetTokenContext.Provider>;
}

/**
 * Wraps the app with ClerkProvider only when a publishable key is configured.
 * Without a key (e.g. before the Clerk account is set up), the app renders
 * normally and auth-gated screens show a setup notice instead of crashing.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return <ClerkConfigContext.Provider value={false}>{children}</ClerkConfigContext.Provider>;
  }
  return (
    <ClerkConfigContext.Provider value={true}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkTokenBridge>{children}</ClerkTokenBridge>
      </ClerkProvider>
    </ClerkConfigContext.Provider>
  );
}
