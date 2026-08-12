import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetToken } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  approveListing,
  fetchPendingListings,
  rejectListing,
  type AdminListing,
} from '@/lib/api';
import { useProfileStore } from '@/store/profile';

const KES = (n: number) => `KSh ${n.toLocaleString('en-KE')}`;

/** ISO timestamp → '10 Jul 2026' style label. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function AdminListingsScreen() {
  const role = useProfileStore((s) => s.role);
  if (role !== 'admin') return <NotAdmin />;
  return <ReviewQueue />;
}

function NotAdmin() {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.center}>
        <ThemedText style={styles.centerTitle}>Admin access only</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Only admins can review listings.
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

type QueueStatus = 'loading' | 'ready' | 'error';

function ReviewQueue() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const getToken = useGetToken();

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [status, setStatus] = useState<QueueStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminListing | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to review listings.');
      setListings(await fetchPendingListings(token));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load listings.');
      setStatus('error');
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (listing: AdminListing) => {
    setBusyId(listing.id);
    setFlash(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to review listings.');
      await approveListing(listing.id, token);
      setListings((current) => current.filter((l) => l.id !== listing.id));
      setFlash(`“${listing.title}” is now live ✓`);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Couldn’t update the listing.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const listing = rejectTarget;
    setBusyId(listing.id);
    setFlash(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to review listings.');
      await rejectListing(listing.id, rejectReason.trim() || null, token);
      setListings((current) => current.filter((l) => l.id !== listing.id));
      setFlash(`“${listing.title}” rejected`);
      setRejectTarget(null);
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : 'Couldn’t reject the listing.');
    } finally {
      setBusyId(null);
    }
  };

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
            <ThemedText style={styles.headerTitle}>Listing approvals</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Approve or reject new listings
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
            <ThemedText style={styles.emptyEmoji}>🎉</ThemedText>
            <ThemedText style={styles.centerTitle}>Queue is clear</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              No listings waiting for approval.
            </ThemedText>
          </ThemedView>
        )}

        {status === 'ready' &&
          listings.map((listing) => (
            <ThemedView key={listing.id} type="backgroundElement" style={styles.card}>
              <View style={styles.listingRow}>
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
                  <ThemedText type="small" themeColor="textSecondary">
                    By {listing.realtorUsername ?? 'Realtor'} · {formatDate(listing.createdAt)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => {
                    setRejectReason('');
                    setRejectError(null);
                    setRejectTarget(listing);
                  }}
                  disabled={busyId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Reject ${listing.title}`}
                  style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}>
                  {busyId === listing.id ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.rejectText}>
                      Reject
                    </ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void approve(listing)}
                  disabled={busyId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Approve ${listing.title}`}
                  style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}>
                  {busyId === listing.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.approveText}>
                      Approve
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </ThemedView>
          ))}
      </ScrollView>

      {/* Reject reason sheet */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setRejectTarget(null)}>
          <Pressable style={[styles.sheetCard, { backgroundColor: theme.background }]} onPress={() => {}}>
            <ThemedText style={styles.sheetTitle}>Reject listing</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {rejectTarget ? `“${rejectTarget.title}”` : ''} — the reason is shown to the
              realtor on their My Listings screen.
            </ThemedText>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason (optional)…"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[
                styles.reasonInput,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                },
              ]}
              accessibilityLabel="Rejection reason"
            />
            {rejectError && (
              <ThemedText type="small" style={styles.errorText}>
                {rejectError}
              </ThemedText>
            )}
            <Pressable
              onPress={() => void confirmReject()}
              disabled={busyId !== null}
              accessibilityRole="button"
              accessibilityLabel="Confirm rejection"
              style={({ pressed }) => [styles.rejectConfirmButton, pressed && styles.pressed]}>
              {busyId !== null ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.approveText}>
                  Reject listing
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              onPress={() => setRejectTarget(null)}
              disabled={busyId !== null}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    gap: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  flash: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumbWrap: {
    width: 64,
    height: 64,
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
    fontSize: 22,
  },
  listingText: {
    flex: 1,
    gap: 2,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  rejectButton: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.5)',
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  rejectText: {
    color: '#DC2626',
  },
  approveButton: {
    flex: 1,
    borderRadius: Spacing.two,
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  approveText: {
    color: '#ffffff',
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetCard: {
    width: '100%',
    maxWidth: 520,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    minHeight: 80,
  },
  rejectConfirmButton: {
    borderRadius: Spacing.two,
    backgroundColor: '#DC2626',
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
