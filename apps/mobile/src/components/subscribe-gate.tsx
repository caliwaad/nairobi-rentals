import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useGetToken } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { fetchSubscriptionStatus, subscribe, type SubscriptionStatus } from '@/lib/api';
import { useProfileStore } from '@/store/profile';

/**
 * Phase 5 paywall — wraps the realtor publish flow.
 *
 * - Payments not configured (no IntaSend keys): children render under a small
 *   "development mode" banner, matching the Cloudinary graceful-degradation.
 * - Active subscription: children render.
 * - Otherwise: a paywall with the price + a "Pay via M-Pesa" button that
 *   triggers the STK push and polls until the webhook flips the row active.
 */
export function SubscribeGate({ children }: { children: ReactNode }) {
  const getToken = useGetToken();
  const subscription = useProfileStore((s) => s.subscription);
  const setSubscription = useProfileStore((s) => s.setSubscription);
  const [status, setStatus] = useState<SubscriptionStatus | null>(subscription);
  const [loading, setLoading] = useState(!subscription);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch once on mount (the store may already have it from the Profile tab).
  useEffect(() => {
    let cancelled = false;
    void getToken().then((token) => {
      if (!token) return;
      void fetchSubscriptionStatus(token)
        .then((s) => {
          if (cancelled) return;
          setStatus(s);
          setSubscription(s);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const refresh = async (token: string | null): Promise<SubscriptionStatus | null> => {
    try {
      const s = await fetchSubscriptionStatus(token);
      setStatus(s);
      setSubscription(s);
      return s;
    } catch {
      return null;
    }
  };

  const handlePay = async () => {
    setError(null);
    setPushing(true);
    try {
      const token = await getToken();
      await subscribe(token);
      // Poll until the webhook flips the row active (STK push takes seconds).
      stopPolling();
      pollRef.current = setInterval(() => {
        void refresh(token).then((s) => {
          if (s?.subscription?.status === 'active') stopPolling();
        });
      }, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t start the payment.');
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} />
      </View>
    );
  }

  if (!status?.configured) {
    // Graceful degradation: without IntaSend keys publishing stays open.
    return (
      <View style={styles.wrap}>
        <View style={[styles.banner, { backgroundColor: 'rgba(128,128,128,0.12)' }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
            💳 Payments are not configured yet — publishing is open in development mode.
          </ThemedText>
        </View>
        {children}
      </View>
    );
  }

  const active = status.subscription?.status === 'active';

  if (active) {
    return <View style={styles.wrap}>{children}</View>;
  }

  const price = status.price;
  const amount = status.subscription?.amount ?? 0;
  const charged = amount || Math.ceil(price / 0.97);

  return (
    <View style={styles.wrap}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.cardTitle}>Subscribe to publish</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          A monthly subscription unlocks posting. Pay via M-Pesa — you'll get an STK push on
          the phone saved to your profile.
        </ThemedText>

        <View style={styles.priceRow}>
          <ThemedText style={styles.price}>KES {price.toLocaleString()}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">/ month</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {charged.toLocaleString()} charged — includes the M-Pesa fee.
        </ThemedText>

        <Pressable
          onPress={() => void handlePay()}
          disabled={pushing}
          accessibilityRole="button"
          accessibilityLabel="Subscribe via M-Pesa"
          style={({ pressed }) => [
            styles.payButton,
            { backgroundColor: pushing ? Brand.primaryStrong : Brand.primary },
            pressed && styles.pressed,
          ]}>
          {pushing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <ThemedText style={styles.payButtonText}>💳  Pay via M-Pesa</ThemedText>
          )}
        </Pressable>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    borderRadius: Spacing.two,
    padding: Spacing.two + 2,
    marginBottom: Spacing.two,
  },
  bannerText: {
    textAlign: 'center',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  body: {
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  price: {
    fontSize: 28,
    fontWeight: 800,
    color: Brand.primary,
  },
  payButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  payButtonText: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 16,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
