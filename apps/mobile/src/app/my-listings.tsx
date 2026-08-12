import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetToken } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { fetchMyListings, type ApiListing } from '@/lib/api';
import { useProfileStore } from '@/store/profile';

const KES = (n: number) => `KSh ${n.toLocaleString('en-KE')}`;

export default function MyListingsScreen() {
  const realtorStatus = useProfileStore((s) => s.realtorStatus);
  if (realtorStatus !== 'approved') return <RealtorOnly />;
  return <MyListings />;
}

function RealtorOnly() {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.center}>
        <ThemedText style={styles.centerTitle}>Realtor access only</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Approved realtors can track their published listings here.
        </ThemedText>
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText style={styles.primaryButtonText}>← Back to homes</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

type Status = 'loading' | 'ready' | 'error';

function MyListings() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const getToken = useGetToken();

  const [listings, setListings] = useState<ApiListing[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to see your listings.');
      setListings(await fetchMyListings(token));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load your listings.');
      setStatus('error');
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const openListing = (listing: ApiListing) => {
    if (listing.status !== 'approved') {
      setFlash(
        listing.status === 'pending'
          ? '⏳ This listing is still pending review.'
          : '✕ This listing was rejected.',
      );
      return;
    }
    router.push({ pathname: '/listing/[id]', params: { id: listing.id } });
  };

  const badge = {
    pending: isDark ? { bg: 'rgba(180, 83, 9, 0.18)', fg: '#FBBF24' } : { bg: '#FEF3C7', fg: '#B45309' },
    approved: isDark
      ? { bg: 'rgba(4, 120, 87, 0.2)', fg: '#34D399' }
      : { bg: '#D1FAE5', fg: '#047857' },
    rejected: isDark
      ? { bg: 'rgba(185, 28, 28, 0.2)', fg: '#F87171' }
      : { bg: '#FEE2E2', fg: '#B91C1C' },
  } as const;

  const badgeLabel = {
    pending: '⏳ Pending review',
    approved: '✅ Live',
    rejected: '✕ Rejected',
  } as const;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.five }]}>
        {/* Header */}
        <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.headerBackGlyph}>←</ThemedText>
          </Pressable>
          <View style={styles.headerText}>
            <ThemedText style={styles.headerTitle}>My listings</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Track your published apartments
            </ThemedText>
          </View>
        </View>

        {flash && (
          <ThemedView type="backgroundElement" style={styles.flash}>
            <ThemedText type="smallBold">{flash}</ThemedText>
          </ThemedView>
        )}

        {status === 'loading' && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {status === 'error' && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Try again</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {status === 'ready' && listings.length === 0 && (
          <ThemedView type="backgroundElement" style={[styles.card, styles.emptyCard]}>
            <ThemedText style={styles.emptyEmoji}>🏠</ThemedText>
            <ThemedText style={styles.centerTitle}>No listings yet</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Post your first apartment to start reaching tenants across Nairobi.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/new-listing')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>＋ Post a listing</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {status === 'ready' &&
          listings.map((listing) => (
            <Pressable
              key={listing.id}
              onPress={() => openListing(listing)}
              accessibilityRole="button"
              accessibilityLabel={`${listing.title}, ${badgeLabel[listing.status]}`}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.listingCard}>
                <View style={styles.thumbWrap}>
                  {listing.images[0] ? (
                    <Image
                      source={{ uri: listing.images[0] }}
                      style={styles.thumb}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <ThemedText style={styles.thumbEmptyGlyph}>🏠</ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.listingText}>
                  <ThemedText style={styles.listingTitle} numberOfLines={1}>
                    {listing.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {KES(listing.price)}/mo · {listing.neighborhood}
                  </ThemedText>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: badge[listing.status].bg }]}>
                      <ThemedText type="smallBold" style={{ color: badge[listing.status].fg }}>
                        {badgeLabel[listing.status]}
                      </ThemedText>
                    </View>
                  </View>
                  {listing.status === 'rejected' && listing.rejectionReason && (
                    <ThemedText type="small" style={styles.rejectionText}>
                      Reason: {listing.rejectionReason}
                    </ThemedText>
                  )}
                </View>
              </ThemedView>
            </Pressable>
          ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackGlyph: {
    fontSize: 18,
    lineHeight: 22,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  flash: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  listingCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  thumbWrap: {
    width: 76,
    height: 76,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbEmpty: {
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmptyGlyph: {
    fontSize: 26,
  },
  listingText: {
    flex: 1,
    gap: 3,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  badgeRow: {
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    paddingVertical: 3,
    paddingHorizontal: Spacing.two,
  },
  rejectionText: {
    color: '#DC2626',
  },
  primaryButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 700,
  },
  errorText: {
    color: '#DC2626',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centerBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  centerText: {
    textAlign: 'center',
    maxWidth: 320,
  },
  pressed: {
    opacity: 0.7,
  },
});
