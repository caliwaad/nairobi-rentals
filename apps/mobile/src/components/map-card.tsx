import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { type Listing } from '@/data/sample-listings';
import { useTheme } from '@/hooks/use-theme';

/**
 * Listing map. When the API has a Google key it renders a real static-map
 * image with the pin (server-built — the key never ships to the client) plus
 * an "Open in Google Maps" deep link. Without a key it falls back to the
 * stylized placeholder so the screen stays complete during development.
 */
export function MapCard({ listing, mapImageUrl }: { listing: Listing; mapImageUrl?: string | null }) {
  const theme = useTheme();

  const openInMaps = () => {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`,
    );
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {mapImageUrl ? (
        <Pressable onPress={openInMaps} accessibilityRole="link" accessibilityLabel="View map">
          <Image
            source={{ uri: mapImageUrl }}
            style={styles.mapImage}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      ) : (
        <View style={[styles.map, { backgroundColor: theme.backgroundSelected }]}>
        {[16, 32, 48, 64, 80].map((left) => (
          <View
            key={`v${left}`}
            style={[styles.gridLineV, { left: `${left}%`, backgroundColor: theme.backgroundElement }]}
          />
        ))}
        {[20, 40, 60, 80].map((top) => (
          <View
            key={`h${top}`}
            style={[styles.gridLineH, { top: `${top}%`, backgroundColor: theme.backgroundElement }]}
          />
        ))}

        <View
          style={[styles.road, styles.roadA, { backgroundColor: theme.backgroundElement }]}
        />
        <View
          style={[styles.road, styles.roadB, { backgroundColor: theme.backgroundElement }]}
        />

        <View style={styles.pinWrap}>
          <View style={[styles.pinCircle, { backgroundColor: Brand.primary }]}>
            <View style={styles.pinInner} />
          </View>
          <View style={[styles.pinTail, { borderTopColor: Brand.primary }]} />
        </View>

        <View style={[styles.pinLabel, { backgroundColor: theme.background }]}>
          <ThemedText type="small" numberOfLines={1}>
            {listing.neighborhood}
          </ThemedText>
        </View>
        </View>
      )}

      <View style={styles.addressRow}>
        <ThemedText type="small" themeColor="textSecondary">
          📍 {listing.address}, {listing.neighborhood}
        </ThemedText>
      </View>

      <Pressable
        onPress={openInMaps}
        accessibilityRole="link"
        accessibilityLabel={`Open ${listing.address} in Google Maps`}
        style={({ pressed }) => [styles.mapsButton, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.mapsButtonText}>
          Open in Google Maps ↗
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  map: {
    height: 160,
    overflow: 'hidden',
  },
  mapImage: {
    width: '100%',
    height: 180,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    opacity: 0.7,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.7,
  },
  road: {
    position: 'absolute',
    width: '160%',
    height: 14,
    borderRadius: 7,
    opacity: 0.9,
  },
  roadA: {
    left: '-30%',
    top: '42%',
    transform: [{ rotate: '-16deg' }],
  },
  roadB: {
    left: '-30%',
    top: '58%',
    transform: [{ rotate: '22deg' }],
  },
  pinWrap: {
    position: 'absolute',
    left: '62%',
    top: '38%',
    alignItems: 'center',
  },
  pinCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  pinLabel: {
    position: 'absolute',
    left: '52%',
    top: '12%',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  addressRow: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  mapsButton: {
    margin: Spacing.three,
    marginTop: Spacing.two,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
    alignItems: 'center',
    backgroundColor: Brand.primary,
  },
  mapsButtonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.85,
  },
});
