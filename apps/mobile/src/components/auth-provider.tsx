import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { createContext, useContext, type ReactNode } from 'react';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const ClerkConfigContext = createContext(Boolean(publishableKey));

/** True when EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is set and Clerk is active. */
export function useClerkConfigured() {
  return useContext(ClerkConfigContext);
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
        {children}
      </ClerkProvider>
    </ClerkConfigContext.Provider>
  );
}
