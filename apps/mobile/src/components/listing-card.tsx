import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { formatKES, SIZE_LABELS, type Listing } from '@/data/sample-listings';
import { useTheme } from '@/hooks/use-theme';

interface ListingCardProps {
  listing: Listing;
  onPress?: (listing: Listing) => void;
}

export const ListingCard = memo(function ListingCard({ listing, onPress }: ListingCardProps) {
  const theme = useTheme();
  const [saved, setSaved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    // Wrapper keeps the save button a *sibling* of the card button — on web,
    // role="button" elements render as <button>, and nesting them is invalid HTML.
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => onPress?.(listing)}
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${formatKES(listing.price)} per month, rated ${listing.rating.toFixed(1)}`}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.imageWrap}>
            {imageFailed ? (
              <View style={[styles.image, styles.fallback, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  📷 {SIZE_LABELS[listing.size]}
                </ThemedText>
              </View>
            ) : (
              <Image
                source={{ uri: listing.images[0] }}
                style={styles.image}
                contentFit="cover"
                transition={250}
                onError={() => setImageFailed(true)}
              />
            )}

            <View style={[styles.sizeBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <ThemedText type="smallBold" style={styles.sizeBadgeText}>
                {SIZE_LABELS[listing.size]}
              </ThemedText>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.priceRow}>
              <View style={styles.priceGroup}>
                <ThemedText style={styles.price}>{formatKES(listing.price)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  /mo
                </ThemedText>
              </View>
              <View style={styles.rating}>
                <ThemedText style={styles.star}>★</ThemedText>
                <ThemedText type="smallBold">{listing.rating.toFixed(1)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ({listing.reviewCount})
                </ThemedText>
              </View>
            </View>

            <ThemedText type="smallBold" numberOfLines={1}>
              {listing.title}
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              📍 {listing.neighborhood} · {listing.address}
            </ThemedText>

            <View style={styles.amenityRow}>
              {listing.amenities.slice(0, 3).map((amenity) => (
                <View
                  key={amenity}
                  style={[styles.amenityChip, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.amenityText}>
                    {amenity}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </ThemedView>
      </Pressable>

      <Pressable
        onPress={() => setSaved((s) => !s)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
        accessibilityState={{ selected: saved }}
        style={({ pressed }) => [styles.heartButton, pressed && styles.pressed]}>
        <ThemedText style={[styles.heart, { color: saved ? Brand.heart : '#ffffff' }]}>
          {saved ? '♥' : '♡'}
        </ThemedText>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  pressable: {
    width: '100%',
  },
  pressed: {
    opacity: 0.92,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  sizeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    fontSize: 18,
    lineHeight: 22,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  price: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 700,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  star: {
    color: Brand.star,
    fontSize: 14,
  },
  amenityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  amenityChip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  amenityText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
