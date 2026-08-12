import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetToken } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  approveRealtor,
  fetchPendingRealtors,
  rejectRealtor,
  type AdminApplication,
} from '@/lib/api';
import { useProfileStore } from '@/store/profile';

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

export default function AdminRealtorsScreen() {
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
          Only admins can review realtor applications.
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

  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [status, setStatus] = useState<QueueStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to review applications.');
      const list = await fetchPendingRealtors(token);
      setApplications(list);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load applications.');
      setStatus('error');
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (app: AdminApplication, action: 'approve' | 'reject') => {
    setBusyId(app.id);
    setFlash(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to review applications.');
      if (action === 'approve') {
        await approveRealtor(app.id, token);
      } else {
        await rejectRealtor(app.id, null, token);
      }
      setApplications((current) => current.filter((a) => a.id !== app.id));
      const name = app.username ?? app.name ?? 'Applicant';
      setFlash(`${name} ${action === 'approve' ? 'approved ✓' : 'rejected'}`);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Couldn’t update the application.');
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
            <ThemedText style={styles.headerTitle}>Realtor applications</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Approve or reject pending applications
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

        {status === 'ready' && applications.length === 0 && (
          <ThemedView type="backgroundElement" style={[styles.card, styles.emptyCard]}>
            <ThemedText style={styles.emptyEmoji}>🎉</ThemedText>
            <ThemedText style={styles.centerTitle}>Queue is clear</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              No realtor applications waiting for review.
            </ThemedText>
          </ThemedView>
        )}

        {status === 'ready' &&
          applications.map((app) => {
            const name = app.username ?? app.name ?? 'Applicant';
            const meta = [app.email, app.phone, app.clerkId].filter(Boolean).join(' · ');
            return (
              <ThemedView key={app.id} type="backgroundElement" style={styles.card}>
                <View style={styles.appRow}>
                  <View style={[styles.avatarDot, { backgroundColor: Brand.primary }]}>
                    <ThemedText style={styles.avatarInitial}>
                      {name.trim().charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.appText}>
                    <ThemedText style={styles.appName}>{name}</ThemedText>
                    {meta ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {meta}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="small" themeColor="textSecondary">
                      Applied {formatDate(app.createdAt)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => void act(app, 'reject')}
                    disabled={busyId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${name}`}
                    style={({ pressed }) => [
                      styles.rejectButton,
                      pressed && styles.pressed,
                    ]}>
                    {busyId === app.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <ThemedText type="smallBold" style={styles.rejectText}>
                        Reject
                      </ThemedText>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => void act(app, 'approve')}
                    disabled={busyId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Approve ${name}`}
                    style={({ pressed }) => [
                      styles.approveButton,
                      pressed && styles.pressed,
                    ]}>
                    {busyId === app.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <ThemedText type="smallBold" style={styles.approveText}>
                        Approve
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </ThemedView>
            );
          })}
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
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 800,
  },
  appText: {
    flex: 1,
    gap: 2,
  },
  appName: {
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
  pressed: {
    opacity: 0.7,
  },
});
