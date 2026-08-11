import { useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppleLogo, GoogleLogo } from '@/components/brand-logos';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type OAuthStrategy = 'oauth_google' | 'oauth_apple';

/** Pulls a human-readable message out of a Clerk error. */
function clerkError(e: unknown): string | null {
  if (typeof e === 'object' && e !== null) {
    const anyE = e as { errors?: Array<{ message?: string }>; message?: string };
    if (Array.isArray(anyE.errors) && anyE.errors[0]?.message) return anyE.errors[0].message;
    if (anyE.message) return anyE.message;
  }
  return null;
}

export function SignInScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  const { startSSOFlow } = useSSO();

  const [busy, setBusy] = useState<OAuthStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Warm up the browser session on native for a snappier OAuth handoff.
  // (warmUpAsync/coolDownAsync are native-only — the docs' pattern throws on web.)
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const handleOAuth = async (strategy: OAuthStrategy) => {
    setError(null);
    setBusy(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (e) {
      setError(
        clerkError(e) ??
          'Sign-in didn’t complete. Allow pop-ups for this site (or open the app in a normal browser tab) and try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.brandMark, { backgroundColor: Brand.primary }]}>
        <ThemedText style={styles.brandGlyph}>🏠</ThemedText>
      </View>

      <ThemedText style={styles.title}>Welcome to Nairobi Rentals</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        Sign in to save homes, review apartments, and publish listings as a realtor.
      </ThemedText>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => handleOAuth('oauth_google')}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.socialButton,
            { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google">
          {busy === 'oauth_google' ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <GoogleLogo size={20} />
              <ThemedText style={[styles.socialButtonText, { color: theme.text }]}>
                Continue with Google
              </ThemedText>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleOAuth('oauth_apple')}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.socialButton,
            { backgroundColor: '#000000' },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple">
          {busy === 'oauth_apple' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <AppleLogo size={20} />
              <ThemedText style={styles.socialButtonTextWhite}>Continue with Apple</ThemedText>
            </>
          )}
        </Pressable>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </View>

      {/* Required for sign-up flows on Expo web (CAPTCHA slot). */}
      <View nativeID="clerk-captcha" />

      <ThemedText type="small" themeColor="textSecondary" style={styles.privacy}>
        We'll only use your account to save your homes, reviews, and listings — never to post on
        your behalf.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  brandGlyph: {
    fontSize: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 300,
  },
  buttons: {
    width: '100%',
    maxWidth: 340,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: 600,
  },
  socialButtonTextWhite: {
    fontSize: 15,
    fontWeight: 600,
    color: '#ffffff',
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  privacy: {
    textAlign: 'center',
    maxWidth: 320,
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
