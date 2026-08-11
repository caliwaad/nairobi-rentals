import { useAuth, useUser } from '@clerk/expo';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useClerkConfigured } from '@/components/auth-provider';
import { ScreenContainer } from '@/components/screen-container';
import { SignInScreen } from '@/components/sign-in-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useFavoritesStore } from '@/store/favorites';
import { useProfileStore } from '@/store/profile';

export default function ProfileScreen() {
  const clerkConfigured = useClerkConfigured();
  if (!clerkConfigured) return <ClerkSetupNotice />;
  return <ProfileGate />;
}

/** Shown before the Clerk key is configured — keeps the tab usable in dev. */
function ClerkSetupNotice() {
  return (
    <ScreenContainer>
      <View style={styles.setupNotice}>
        <ThemedText style={styles.title}>Auth not configured yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.setupText}>
          Add your Clerk publishable key to{' '}
          <ThemedText type="code">apps/mobile/.env</ThemedText> to enable sign-in:
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.setupCode}>
          <ThemedText type="code">EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…</ThemedText>
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary" style={styles.setupText}>
          Create the app at dashboard.clerk.com, enable Google + Apple under SSO connections, then
          restart the dev server. Full steps are in .env.example.
        </ThemedText>
      </View>
    </ScreenContainer>
  );
}

/** Gates the tab: loading → sign-in → profile. Only rendered when Clerk is configured. */
function ProfileGate() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }
  if (!isSignedIn) {
    return (
      <ScreenContainer>
        <SignInScreen />
      </ScreenContainer>
    );
  }
  return <ProfileContent />;
}

function ProfileContent() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const {
    username,
    email,
    phone,
    avatarUri,
    realtorStatus,
    setUsername,
    setEmail,
    setPhone,
    setAvatarUri,
    applyRealtor,
  } = useProfileStore();
  const savedCount = useFavoritesStore((s) => s.favoriteIds.length);

  // Tie the local profile to the Clerk account: prefill once per account, reset on switch.
  const { user } = useUser();
  const { signOut } = useAuth();
  useEffect(() => {
    if (!user) return;
    const state = useProfileStore.getState();
    if (state.userId !== user.id) {
      const fallback =
        user.username ?? user.firstName ?? user.primaryEmailAddress?.emailAddress?.split('@')[0];
      state.setUserId(user.id);
      if (fallback) state.setUsername(fallback);
      if (user.imageUrl) state.setAvatarUri(user.imageUrl);
    }
  }, [user]);

  const handleSignOut = async () => {
    useProfileStore.getState().reset();
    await signOut();
  };

  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const handleSave = () => {
    setSavedFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 1600);
  };

  const initial = username.trim().charAt(0).toUpperCase();

  /** Gallery or camera → local avatar URI. Real uploads to Cloudinary come in Phase 3. */
  const pickPhoto = async (source: 'library' | 'camera') => {
    setPhotoError(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setPhotoError('Camera permission was denied. You can enable it in your device settings.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPhotoError('Photo library permission was denied. You can enable it in your device settings.');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        setPhotoSheetOpen(false);
      }
    } catch {
      setPhotoError('Could not open the camera or gallery on this device.');
    }
  };

  /** Status pill colors — light pastels in light mode, subtle tints in dark mode. */
  const pill = {
    pending: isDark ? { bg: 'rgba(180, 83, 9, 0.18)', fg: '#FBBF24' } : { bg: '#FEF3C7', fg: '#B45309' },
    approved: isDark
      ? { bg: 'rgba(4, 120, 87, 0.2)', fg: '#34D399' }
      : { bg: '#D1FAE5', fg: '#047857' },
    rejected: isDark
      ? { bg: 'rgba(185, 28, 28, 0.2)', fg: '#F87171' }
      : { bg: '#FEE2E2', fg: '#B91C1C' },
  } as const;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Profile</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your account and preferences
          </ThemedText>
        </View>

        {/* Avatar card */}
        <ThemedView type="backgroundElement" style={styles.avatarCard}>
          <View style={styles.avatarRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: avatarUri ? 'transparent' : Brand.primary },
              ]}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <ThemedText style={styles.avatarInitial}>{initial || '👤'}</ThemedText>
              )}
              <Pressable
                style={({ pressed }) => [styles.avatarEdit, pressed && styles.pressed]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                onPress={() => {
                  setPhotoError(null);
                  setPhotoSheetOpen(true);
                }}>
                <ThemedText style={styles.avatarEditIcon}>✎</ThemedText>
              </Pressable>
            </View>
            <View style={styles.avatarText}>
              <ThemedText style={styles.avatarName}>
                {username.trim() ? username : 'Tenant'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {realtorStatus === 'approved' ? 'Realtor account' : 'Tenant account'}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Your details */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          YOUR DETAILS
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Username
            </ThemedText>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. Njeri_W"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              accessibilityLabel="Username"
            />
            <ThemedText type="small" themeColor="textSecondary">
              Shown on your reviews — never your real name.
            </ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Email
            </ThemedText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              accessibilityLabel="Email"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Phone (optional)
            </ThemedText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="07XX XXX XXX"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              accessibilityLabel="Phone number"
            />
          </View>
        </ThemedView>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: savedFlash ? Brand.primaryStrong : Brand.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save changes">
          <ThemedText style={styles.saveButtonText}>{savedFlash ? 'Saved ✓' : 'Save changes'}</ThemedText>
        </Pressable>

        {/* For realtors */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          FOR REALTORS
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.realtorTitle}>List your apartments</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.realtorText}>
            Publish photos, prices and house rules to reach thousands of tenants across Nairobi.
            Monthly subscription via M-Pesa.
          </ThemedText>

          {realtorStatus === null && (
            <Pressable
              onPress={applyRealtor}
              style={({ pressed }) => [styles.realtorButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Apply to become a realtor">
              <ThemedText style={styles.realtorButtonText}>Apply to become a realtor</ThemedText>
            </Pressable>
          )}

          {realtorStatus === 'pending' && (
            <View style={[styles.statusPill, { backgroundColor: pill.pending.bg }]}>
              <ThemedText style={[styles.statusText, { color: pill.pending.fg }]}>
                ⏳ Application submitted — pending admin review
              </ThemedText>
            </View>
          )}

          {realtorStatus === 'approved' && (
            <View style={[styles.statusPill, { backgroundColor: pill.approved.bg }]}>
              <ThemedText style={[styles.statusText, { color: pill.approved.fg }]}>
                ✅ Realtor mode active — you can post listings
              </ThemedText>
            </View>
          )}

          {realtorStatus === 'rejected' && (
            <View style={[styles.statusPill, { backgroundColor: pill.rejected.bg }]}>
              <ThemedText style={[styles.statusText, { color: pill.rejected.fg }]}>
                ✕ Application not approved — contact support for details
              </ThemedText>
            </View>
          )}
        </ThemedView>

        {/* Stats */}
        <View style={styles.statsRow}>
          <ThemedView type="backgroundElement" style={styles.statCard}>
            <ThemedText style={[styles.statValue, { color: Brand.heart }]}>♥ {savedCount}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Saved homes
            </ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.statCard}>
            <ThemedText style={[styles.statValue, { color: Brand.star }]}>★ —</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Reviews written
            </ThemedText>
          </ThemedView>
        </View>

        <Pressable
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Sign out">
          <ThemedText style={styles.signOutText}>Sign out</ThemedText>
        </Pressable>
      </ScrollView>

      {/* Photo action sheet */}
      <Modal
        visible={photoSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setPhotoSheetOpen(false)}>
          <Pressable style={[styles.sheetCard, { backgroundColor: theme.background }]} onPress={() => {}}>
            <ThemedText style={styles.sheetTitle}>Change profile photo</ThemedText>

            <Pressable
              onPress={() => pickPhoto('library')}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Choose photo from gallery">
              <ThemedText style={styles.sheetOptionText}>🖼  Choose from gallery</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => pickPhoto('camera')}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Take a photo with the camera">
              <ThemedText style={styles.sheetOptionText}>📷  Take a photo</ThemedText>
            </Pressable>

            {avatarUri && (
              <Pressable
                onPress={() => {
                  setAvatarUri(null);
                  setPhotoSheetOpen(false);
                }}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo">
                <ThemedText style={[styles.sheetOptionText, { color: '#DC2626' }]}>
                  🗑  Remove photo
                </ThemedText>
              </Pressable>
            )}

            {photoError && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.sheetError}>
                {photoError}
              </ThemedText>
            )}

            <Pressable
              onPress={() => setPhotoSheetOpen(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.half,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
  },
  avatarCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: 800,
    color: '#ffffff',
    lineHeight: 36,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Brand.primary,
  },
  avatarEditIcon: {
    fontSize: 12,
    color: Brand.primary,
    lineHeight: 14,
  },
  avatarText: {
    flex: 1,
    gap: Spacing.half,
  },
  avatarName: {
    fontSize: 18,
    fontWeight: 700,
  },
  sectionLabel: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.25)',
    marginVertical: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  saveButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 16,
  },
  realtorTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: Spacing.one,
  },
  realtorText: {
    marginBottom: Spacing.three,
  },
  realtorButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    backgroundColor: Brand.primary,
  },
  realtorButtonText: {
    color: '#ffffff',
    fontWeight: 700,
  },
  statusPill: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  statusText: {
    fontWeight: 600,
    fontSize: 14,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  statCard: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 800,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupNotice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  setupText: {
    textAlign: 'center',
    maxWidth: 320,
  },
  setupCode: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    maxWidth: '100%',
  },
  signOutButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.5)',
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  signOutText: {
    color: '#DC2626',
    fontWeight: 700,
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
  sheetOption: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: 600,
  },
  sheetError: {
    textAlign: 'center',
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
