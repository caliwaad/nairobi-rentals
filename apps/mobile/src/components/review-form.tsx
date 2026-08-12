import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useClerkConfigured, useGetToken } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { submitReview } from '@/lib/api';

interface ReviewFormProps {
  listingId: string;
  /** Called after a review is saved so the screen can refresh reviews + rating. */
  onSubmitted: () => void;
}

/**
 * One review per tenant per home (upsert on the server). Signed-out users see
 * a sign-in prompt; signed-in users pick 1–5 stars and can add a comment.
 */
export function ReviewForm({ listingId, onSubmitted }: ReviewFormProps) {
  const configured = useClerkConfigured();
  if (!configured) return null;
  return <ReviewFormInner listingId={listingId} onSubmitted={onSubmitted} />;
}

function ReviewFormInner({ listingId, onSubmitted }: ReviewFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const getToken = useGetToken();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isLoaded) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ActivityIndicator size="small" />
      </ThemedView>
    );
  }

  if (!isSignedIn) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Lived here? Share your experience.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Sign in to rate this home and leave a review for other tenants.
        </ThemedText>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            Sign in to review
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const handleSubmit = async () => {
    if (stars === 0) {
      setError('Pick a star rating first.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const token = await getToken();
      await submitReview(listingId, stars, comment.trim(), token);
      setSubmitted(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSubmitted(false), 2500);
      setStars(0);
      setComment('');
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save your review. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Rate this home</ThemedText>

      <View style={styles.starRow} accessibilityLabel="Choose your rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => {
              setStars(value);
              setError(null);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
            accessibilityState={{ selected: stars >= value }}>
            <ThemedText
              style={[
                styles.star,
                { color: value <= stars ? Brand.star : theme.backgroundSelected },
              ]}>
              ★
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="What did you like or dislike? (optional)"
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={2000}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background },
        ]}
        accessibilityLabel="Review comment"
      />

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={() => void handleSubmit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Submit review"
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: submitted ? Brand.primaryStrong : Brand.primary },
          pressed && styles.pressed,
        ]}>
        {busy ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {submitted ? '✓ Review posted' : 'Post review'}
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  hint: {
    lineHeight: 18,
  },
  starRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  star: {
    fontSize: 28,
    lineHeight: 32,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  error: {
    color: '#DC2626',
  },
  submitButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
});
