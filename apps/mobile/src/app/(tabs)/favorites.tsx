import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { SAMPLE_LISTINGS } from '@/data/sample-listings';
import { useTheme } from '@/hooks/use-theme';
import { useFavoritesStore } from '@/store/favorites';

export default function FavoritesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const favoriteIds = useFavoritesStore((s) => s.favoriteIds);
  const clearFavorites = useFavoritesStore((s) => s.clear);

  const saved = useMemo(
    () => SAMPLE_LISTINGS.filter((listing) => favoriteIds.includes(listing.id)),
    [favoriteIds],
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>Saved homes</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {saved.length} saved {saved.length === 1 ? 'home' : 'homes'}
              </ThemedText>
            </View>
            {saved.length > 0 && (
              <Pressable
                onPress={clearFavorites}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear all saved homes">
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Clear all
                </ThemedText>
              </Pressable>
            )}
          </View>

          <FlatList
            data={saved}
            keyExtractor={(listing) => listing.id}
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                onPress={(listing) =>
                  router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
                }
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={[styles.emptyHeart, { color: Brand.heart }]}>♡</ThemedText>
                </View>
                <ThemedText style={styles.emptyTitle}>No saved homes yet</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Tap the ♥ on any home to save it here for later.
                </ThemedText>
              </View>
            }
          />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerText: {
    gap: Spacing.half,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.five,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.three,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyHeart: {
    fontSize: 34,
    lineHeight: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 260,
  },
});
