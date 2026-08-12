import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppleLogo, GoogleLogo } from '@/components/brand-logos';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type OAuthStrategy = 'oauth_google' | 'oauth_apple';
type BusyState = OAuthStrategy | 'email-link' | null;

/** Pulls a human-readable message out of a Clerk error. */
function clerkError(e: unknown): string | null {
  if (typeof e === 'object' && e !== null) {
    const anyE = e as { errors?: Array<{ message?: string }>; message?: string };
    if (Array.isArray(anyE.errors) && anyE.errors[0]?.message) return anyE.errors[0].message;
    if (anyE.message) return anyE.message;
  }
  return null;
}

/**
 * Pulls the stable machine code out of a Clerk error.
 * Response errors carry a generic top-level code (`api_response_error`) with
 * the real code nested under `errors[0].code`, so the nested code wins.
 */
function clerkErrorCode(e: unknown): string | null {
  if (typeof e === 'object' && e !== null) {
    const anyE = e as { code?: string; errors?: Array<{ code?: string }> };
    if (Array.isArray(anyE.errors) && anyE.errors[0]?.code) return anyE.errors[0].code;
    if (anyE.code) return anyE.code;
  }
  return null;
}

/** Clerk's code for "no account exists for this email". */
const ACCOUNT_NOT_FOUND = 'form_identifier_not_found';

/**
 * The URL the email-link lands on after the user clicks it.
 * Web: the current origin (so the link works from whatever host serves the app).
 * Native: the app's custom scheme, which expo-router resolves to the verify screen.
 */
function emailLinkVerificationUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}/sign-in/verify`;
  }
  return 'nairobi-rentals://sign-in/verify';
}

export function SignInScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  const { startSSOFlow } = useSSO();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Guards the awaited email-link flow against resets/unmounts.
  const cancelledRef = useRef(false);
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

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

  /**
   * The one-field "Log in or sign up" flow:
   * 1. Try the sign-in email link first (existing accounts).
   * 2. If Clerk says no account exists, create one via sign-up with
   *    the same magic-link email.
   */
  const handleContinue = async () => {
    const email = identifier.trim();
    if (!email) {
      setError('Enter your email or phone number.');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address — we’ll send you a sign-in link.');
      return;
    }
    setError(null);
    cancelledRef.current = false;
    setBusy('email-link');
    try {
      const verificationUrl = emailLinkVerificationUrl();

      const { error: sendError } = await signIn.emailLink.sendLink({
        emailAddress: email,
        verificationUrl,
      });

      if (sendError && clerkErrorCode(sendError) === ACCOUNT_NOT_FOUND) {
        // No account for this email — sign them up with the same magic link.
        await signIn.reset();
        const { error: createError } = await signUp.create({ emailAddress: email });
        if (createError) {
          setError(clerkError(createError) ?? 'Couldn’t create your account. Try again.');
          setBusy(null);
          return;
        }
        const { error: signUpSendError } = await signUp.verifications.sendEmailLink({
          verificationUrl,
        });
        if (signUpSendError) {
          if (clerkErrorCode(signUpSendError) === 'form_param_value_invalid') {
            // Clerk instance hasn't enabled email-link verification for sign-up yet.
            setError(
              'Email-link sign-up isn’t enabled for this account yet — turn on “Email verification link” under Sign-up in the Clerk dashboard.',
            );
          } else {
            setError(clerkError(signUpSendError) ?? 'Couldn’t send the sign-up link. Try again.');
          }
          setBusy(null);
          return;
        }
        setSentTo(email);
        setBusy(null);

        const { error: waitError } = await signUp.verifications.waitForEmailLinkVerification();
        if (cancelledRef.current) return;
        if (waitError) {
          setError(clerkError(waitError) ?? 'The sign-up link wasn’t verified. Try again.');
          return;
        }

        const verification = signUp.verifications.emailLinkVerification;
        if (verification?.status === 'expired') {
          setError('That sign-up link expired. Request a new one.');
          return;
        }
        if (verification?.status === 'client_mismatch') {
          setError('Open the sign-up link on the same device and browser where you started.');
          return;
        }
        if (verification?.status === 'failed') {
          setError('The sign-up link couldn’t be verified. Request a new one.');
          return;
        }
        if (signUp.status === 'complete') {
          const { error: finalizeError } = await signUp.finalize();
          if (finalizeError) {
            setError(clerkError(finalizeError) ?? 'Couldn’t finish signing you up.');
          }
          // On success the Profile screen flips to the account view automatically.
        }
        return;
      }

      if (sendError) {
        setError(clerkError(sendError) ?? 'Couldn’t send the sign-in link. Try again.');
        setBusy(null);
        return;
      }
      setSentTo(email);
      setBusy(null);

      const { error: waitError } = await signIn.emailLink.waitForVerification();
      if (cancelledRef.current) return;
      if (waitError) {
        setError(clerkError(waitError) ?? 'The sign-in link wasn’t verified. Try again.');
        return;
      }

      const verification = signIn.emailLink.verification;
      if (verification?.status === 'expired') {
        setError('That sign-in link expired. Request a new one.');
        return;
      }
      if (verification?.status === 'client_mismatch') {
        setError('Open the sign-in link on the same device and browser where you started.');
        return;
      }
      if (verification?.status === 'failed') {
        setError('The sign-in link couldn’t be verified. Request a new one.');
        return;
      }
      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) setError(clerkError(finalizeError) ?? 'Couldn’t finish signing you in.');
        // On success the Profile screen flips to the account view automatically.
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setError(clerkError(e) ?? 'Something went wrong. Please try again.');
      }
    } finally {
      if (!cancelledRef.current) setBusy(null);
    }
  };

  const resetLinkFlow = async () => {
    cancelledRef.current = true;
    setError(null);
    setSentTo(null);
    await signIn.reset();
    await signUp.reset();
  };

  const borderColor = isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.2)';
  const squareBackground = isDark ? '#1E1E1E' : '#FFFFFF';
  const appleColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <View style={styles.container}>
      <View style={[styles.brandMark, { backgroundColor: Brand.primary }]}>
        <ThemedText style={styles.brandGlyph}>🏠</ThemedText>
      </View>

      <ThemedText style={styles.title}>Log in or sign up</ThemedText>

      {sentTo ? (
        <View style={[styles.sentBox, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.sentTitle}>📧 Check your email</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sentText}>
            We sent a sign-in link to{' '}
            <ThemedText type="small" style={styles.sentEmail}>
              {sentTo}
            </ThemedText>
            . Open it on this device to sign in.
          </ThemedText>
          <Pressable
            onPress={() => void resetLinkFlow()}
            style={({ pressed }) => [styles.differentEmail, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Use a different email">
            <ThemedText type="smallBold" themeColor="textSecondary">
              Use a different email
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            onSubmitEditing={() => void handleContinue()}
            placeholder="Email or phone number"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            editable={busy === null}
            style={[
              styles.input,
              { color: theme.text, borderColor, backgroundColor: theme.background },
            ]}
            accessibilityLabel="Email or phone number"
          />

          <Pressable
            onPress={() => void handleContinue()}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.continueButton,
              { backgroundColor: Brand.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue">
            {busy === 'email-link' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <ThemedText style={styles.continueText}>Continue</ThemedText>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: borderColor }]} />
        <ThemedText type="small" themeColor="textSecondary">
          or
        </ThemedText>
        <View style={[styles.orLine, { backgroundColor: borderColor }]} />
      </View>

      <View style={styles.socialRow}>
        <Pressable
          onPress={() => void handleOAuth('oauth_google')}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.socialSquare,
            { backgroundColor: squareBackground, borderColor },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google">
          {busy === 'oauth_google' ? <ActivityIndicator size="small" /> : <GoogleLogo size={22} />}
        </Pressable>

        <Pressable
          onPress={() => void handleOAuth('oauth_apple')}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.socialSquare,
            { backgroundColor: squareBackground, borderColor },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple">
          {busy === 'oauth_apple' ? (
            <ActivityIndicator size="small" color={appleColor} />
          ) : (
            <AppleLogo size={22} color={appleColor} />
          )}
        </Pressable>
      </View>

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      {/* Required for sign-up flows on Expo web (CAPTCHA slot). */}
      <View nativeID="clerk-captcha" />
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
    fontSize: 27,
    fontWeight: 800,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 340,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: 14,
    fontSize: 16,
  },
  continueButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
  },
  sentBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  sentTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  sentText: {
    textAlign: 'center',
  },
  sentEmail: {
    fontWeight: 700,
  },
  differentEmail: {
    paddingVertical: Spacing.two,
    marginTop: Spacing.half,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
    maxWidth: 340,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
    maxWidth: 340,
  },
  socialSquare: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
    maxWidth: 320,
  },
  pressed: {
    opacity: 0.7,
  },
});
