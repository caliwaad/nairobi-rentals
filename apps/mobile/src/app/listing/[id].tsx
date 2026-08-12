import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetToken } from '@/components/auth-provider';
import { MapCard } from '@/components/map-card';
import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  buildRatingBreakdown,
  formatKES,
  SIZE_LABELS,
  telLink,
  whatsappLink,
  type Listing,
  type Review,
} from '@/data/sample-listings';
import { useTheme } from '@/hooks/use-theme';
import { fetchListing, fetchListingReviews } from '@/lib/api';
import { useFavoritesStore, useIsFavorite } from '@/store/favorites';
import { useAllListings } from '@/store/listings';

export default function ListingDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const allListings = useAllListings();
  const storeListing = allListings.find((l) => l.id === id);
  const [fetchedListing, setFetchedListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [heroWidth, setHeroWidth] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const listing = fetchedListing ?? storeListing;

  // Deep link / refresh: the listing may not be in the feed store yet.
  useEffect(() => {
    if (!id || storeListing) return;
    let cancelled = false;
    void fetchListing(id).then((l) => {
      if (!cancelled) setFetchedListing(l);
    });
    return () => {
      cancelled = true;
    };
  }, [id, storeListing]);

  // Reviews come from their own endpoint — the feed embeds none.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchListingReviews(id).then((r) => {
      if (!cancelled) setReviews(r);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const saved = useIsFavorite(id ?? '');
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const getToken = useGetToken();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (!listing) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.notFound}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <ThemedText style={styles.notFoundTitle}>Listing not found</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            It may have been removed, or your connection dropped.
          </ThemedText>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            style={({ pressed }) => [styles.backToHome, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.whiteText}>
              ← Back to homes
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const breakdown = buildRatingBreakdown(listing.rating, listing.reviewCount);
  const maxBucket = Math.max(...breakdown, 1);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 96 + insets.bottom },
        ]}>
        {/* Header */}
        <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.headerBackGlyph}>←</ThemedText>
          </Pressable>

          <Pressable
            onPress={() =>
              listing && void getToken().then((token) => toggleFavorite(listing.id, token))
            }
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
            accessibilityState={{ selected: saved }}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.headerHeart, { color: saved ? Brand.heart : theme.text }]}>
              {saved ? '♥' : '♡'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Photo slideshow */}
        <View
          style={styles.hero}
          onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
          {heroWidth > 0 && (
            <FlatList
              data={listing.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `${listing.id}-${i}`}
              onScroll={(e) => {
                const width = e.nativeEvent.layoutMeasurement.width || 1;
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                const clamped = Math.min(
                  listing.images.length - 1,
                  Math.max(0, index),
                );
                if (clamped !== photoIndex) setPhotoIndex(clamped);
              }}
              scrollEventThrottle={16}
              snapToInterval={heroWidth}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: heroWidth, height: heroWidth * 0.72 }}
                  contentFit="cover"
                  transition={250}
                />
              )}
            />
          )}
          {heroWidth > 0 && (
            <View style={styles.heroBadges}>
              <View style={styles.dotsRow}>
                {listing.images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === photoIndex ? '#ffffff' : 'rgba(255,255,255,0.45)',
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.counterBadge}>
                <ThemedText type="small" style={styles.whiteText}>
                  {photoIndex + 1}/{listing.images.length}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Price + rating */}
        <View style={styles.body}>
          <View style={styles.priceRow}>
            <View style={styles.priceGroup}>
              <ThemedText style={styles.price}>{formatKES(listing.price)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                /mo
              </ThemedText>
            </View>
            <View style={styles.ratingGroup}>
              <StarRating rating={listing.rating} />
              <ThemedText type="small" themeColor="textSecondary">
                {listing.rating.toFixed(1)} ({listing.reviewCount})
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.title}>{listing.title}</ThemedText>

          <View style={styles.metaRow}>
            <View style={[styles.sizeChip, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {SIZE_LABELS[listing.size]}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              📍 {listing.neighborhood} · {listing.address}
            </ThemedText>
          </View>

          {/* Amenities */}
          <Section title="What this home offers">
            {listing.amenities.length > 0 ? (
              <View style={styles.chipWrap}>
                {listing.amenities.map((amenity) => (
                  <View
                    key={amenity}
                    style={[styles.amenityChip, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold" themeColor="text" style={styles.amenityText}>
                      {amenity}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No amenities listed yet — contact the agent for details.
              </ThemedText>
            )}
          </Section>

          {/* Description */}
          <Section title="About this home">
            <ThemedText type="small" themeColor="textSecondary">
              {listing.description}
            </ThemedText>
          </Section>

          {/* House rules */}
          <Section title="What you should know">
            {listing.houseRules.length > 0 ? (
              <ThemedView type="backgroundElement" style={styles.rulesCard}>
                {listing.houseRules.map((rule) => (
                  <View key={rule} style={styles.ruleRow}>
                    <View style={[styles.ruleDot, { backgroundColor: Brand.primary }]} />
                    <ThemedText type="small">{rule}</ThemedText>
                  </View>
                ))}
              </ThemedView>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No house rules listed yet — ask the agent directly.
              </ThemedText>
            )}
          </Section>

          {/* Location */}
          <Section title="Location">
            <MapCard listing={listing} />
          </Section>

          {/* Reviews */}
          <Section title="Reviews">
            <ThemedView type="backgroundElement" style={styles.ratingSummary}>
              <View style={styles.ratingLeft}>
                <ThemedText style={styles.ratingBig}>{listing.rating.toFixed(1)}</ThemedText>
                <StarRating rating={listing.rating} size={16} />
                <ThemedText type="small" themeColor="textSecondary">
                  {listing.reviewCount} tenant reviews
                </ThemedText>
              </View>
              <View style={styles.breakdown}>
                {[5, 4, 3, 2, 1].map((stars, i) => (
                  <View key={stars} style={styles.breakdownRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {stars}★
                    </ThemedText>
                    <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                      <View
                        style={[
                          styles.barFill,
                          { backgroundColor: Brand.star, width: `${(breakdown[i] / maxBucket) * 100}%` },
                        ]}
                      />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.barCount}>
                      {breakdown[i]}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>

            {(reviews.length > 0 ? reviews : listing.reviews).length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.noReviewsCard}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.noReviewsText}>
                  No reviews yet — be the first tenant to review this home.
                </ThemedText>
              </ThemedView>
            ) : (
              (reviews.length > 0 ? reviews : listing.reviews).map((review, i) => (
                <ThemedView key={i} type="backgroundElement" style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={[styles.avatar, { backgroundColor: Brand.primary }]}>
                      <ThemedText type="smallBold" style={styles.whiteText}>
                        {review.username.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.reviewMeta}>
                      <ThemedText type="smallBold">{review.username}</ThemedText>
                      <StarRating rating={review.stars} size={12} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {review.date}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {review.comment}
                  </ThemedText>
                </ThemedView>
              ))
            )}
          </Section>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.three),
            backgroundColor: theme.background,
          },
        ]}>
        <View style={styles.actionBarInner}>
          <Pressable
            onPress={() => Linking.openURL(whatsappLink(listing))}
            accessibilityRole="link"
            accessibilityLabel={`Message the agent on WhatsApp about ${listing.title}`}
            style={({ pressed }) => [styles.whatsappButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.whiteText}>
              💬 WhatsApp
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(telLink(listing))}
            accessibilityRole="link"
            accessibilityLabel={`Call the agent about ${listing.title}`}
            style={({ pressed }) => [
              styles.callButton,
              { borderColor: Brand.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              📞 Call
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
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
  headerHeart: {
    fontSize: 20,
    lineHeight: 24,
  },
  hero: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  heroBadges: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  counterBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  whiteText: {
    color: '#ffffff',
  },
  body: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  price: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
  ratingGroup: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    marginTop: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sizeChip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  section: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  amenityChip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  amenityText: {
    fontSize: 13,
    lineHeight: 18,
  },
  rulesCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ruleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ratingSummary: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.four,
  },
  ratingLeft: {
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 110,
  },
  ratingBig: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: 800,
  },
  breakdown: {
    flex: 1,
    gap: Spacing.one,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  barCount: {
    width: 24,
    textAlign: 'right',
  },
  reviewCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  noReviewsCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
  },
  noReviewsText: {
    textAlign: 'center',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewMeta: {
    flex: 1,
    gap: 2,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  actionBarInner: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  whatsappButton: {
    flex: 1.4,
    backgroundColor: '#25D366',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  callButton: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.85,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  backToHome: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
