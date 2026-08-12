import { useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';

type Tone = 'neutral' | 'success' | 'error';

/**
 * Landing page for email sign-in links (`/sign-in/verify?__clerk_…`).
 * Clerk populates the verification object from the URL's query parameters —
 * either on the sign-in attempt (existing account) or the sign-up attempt
 * (new account, created by the Continue button on the sign-in sheet). This
 * screen reports the outcome and, when the attempt completed in this same
 * tab, finalizes it into an active session.
 */
export default function VerifyEmailLinkScreen() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const finalizedRef = useRef(false);

  const signInVerification = signIn?.emailLink?.verification ?? null;
  const signUpVerification = signUp?.verifications?.emailLinkVerification ?? null;
  const verification = signUpVerification ?? signInVerification;

  // Same-tab case: the link replaced the app page, so this tab owns the
  // completed attempt and must finalize it to activate the session.
  useEffect(() => {
    if (finalizedRef.current) return;
    if (signUpVerification?.status === 'verified' && signUp?.status === 'complete') {
      finalizedRef.current = true;
      void signUp.finalize();
    } else if (signInVerification?.status === 'verified' && signIn?.status === 'complete') {
      finalizedRef.current = true;
      void signIn.finalize();
    }
  }, [signInVerification, signUpVerification, signIn, signUp]);

  let title = 'Checking your link…';
  let message = 'Just a moment while we confirm your sign-in.';
  let tone: Tone = 'neutral';

  if (verification) {
    switch (verification.status) {
      case 'verified':
        title = 'You’re signed in!';
        message = 'Your session is active — you can close this tab.';
        tone = 'success';
        break;
      case 'expired':
        title = 'This link has expired';
        message = 'Go back to the app and request a fresh sign-in link.';
        tone = 'error';
        break;
      case 'client_mismatch':
        title = 'Open this link on the same device';
        message =
          'For security, sign-in links only work on the device and browser where you started.';
        tone = 'error';
        break;
      default:
        title = 'The sign-in link failed';
        message = 'Something went wrong while verifying. Try requesting a new link from the app.';
        tone = 'error';
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        {tone === 'neutral' && <ActivityIndicator size="large" color={Brand.primary} />}
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          {message}
        </ThemedText>
        {tone === 'success' && (
          <Pressable
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to browsing">
            <ThemedText style={styles.buttonText}>Back to browsing</ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  button: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    backgroundColor: Brand.primary,
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
