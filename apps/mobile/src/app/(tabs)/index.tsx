import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { FilterSheet } from '@/components/filter-sheet';
import { ListingCard } from '@/components/listing-card';
import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { EMPTY_FILTERS, matchesListing, type ListingFilters } from '@/data/sample-listings';

import { useTheme } from '@/hooks/use-theme';
import { useBrowseStore } from '@/store/browse';
import { useAllListings, useFetchListingsOnMount, useListingsStore } from '@/store/listings';

const ItemSeparator = () => <View style={styles.separator} />;

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [query, setQuery] = useState('');
  const status = useFetchListingsOnMount();
  const error = useListingsStore((s) => s.error);
  const fetchListings = useListingsStore((s) => s.fetchListings);
  const allListings = useAllListings();

  // Apply a browse request arriving from the Explore tab, then clear it so it
  // only ever applies once.
  const pendingBrowse = useBrowseStore((s) => s.pending);
  const consumeBrowse = useBrowseStore((s) => s.consume);
  useEffect(() => {
    if (!pendingBrowse) return;
    setFilters(pendingBrowse);
    setQuery('');
    consumeBrowse();
  }, [pendingBrowse, consumeBrowse]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allListings.filter((listing) => {
      if (!matchesListing(listing, filters)) return false;
      if (q) {
        const haystack = `${listing.title} ${listing.neighborhood} ${listing.address}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [filters, query, allListings]);

  const activeFilterCount = [filters.size, filters.maxPrice, filters.neighborhood].filter(
    (v) => v !== null,
  ).length;

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.brand}>Nairobi Rentals</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Find your next home in Nairobi
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setFilterVisible(true)}
              style={({ pressed }) => [
                styles.filterButton,
                { backgroundColor: activeFilterCount ? Brand.primary : theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              {activeFilterCount > 0 && (
                <View style={styles.filterDot}>
                  <ThemedText type="small" style={styles.filterDotText}>
                    {activeFilterCount}
                  </ThemedText>
                </View>
              )}
              <ThemedText
                type="smallBold"
                themeColor={activeFilterCount ? undefined : 'text'}
                style={activeFilterCount ? styles.filterButtonText : undefined}>
                Filter
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              🔍
            </ThemedText>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search neighbourhood or area…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCorrect={false}
              accessibilityLabel="Search neighbourhood or area"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={12}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  ✕
                </ThemedText>
              </Pressable>
            )}
          </View>

          <View style={styles.resultsRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {filtered.length} home{filtered.length === 1 ? '' : 's'} in Nairobi
            </ThemedText>
          </View>

          {status === 'idle' || status === 'loading' ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Brand.primary} />
              <ThemedText type="small" themeColor="textSecondary">
                Loading homes…
              </ThemedText>
            </View>
          ) : status === 'error' ? (
            <ThemedView type="backgroundElement" style={styles.errorState}>
              <ThemedText style={styles.errorTitle}>Couldn’t load homes</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                {error}
              </ThemedText>
              <Pressable
                onPress={() => void fetchListings()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.retryText}>
                  Try again
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <FlatList
            data={filtered}
            keyExtractor={(listing) => listing.id}
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                onPress={(listing) =>
                  router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
                }
              />
            )}
            ItemSeparatorComponent={ItemSeparator}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <ThemedView type="backgroundElement" style={styles.emptyState}>
                  <ThemedText style={styles.emptyTitle}>No homes match your filters</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                    Try a different size, price range, or neighbourhood.
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      setFilters(EMPTY_FILTERS);
                      setQuery('');
                    }}
                    style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.clearButtonText}>
                      Clear all filters
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              }
            />
          )}
      </ScreenContainer>

      <FilterSheet
        visible={filterVisible}
        initial={filters}
        onApply={(next) => {
          setFilters(next);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  brand: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  filterDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterDotText: {
    fontSize: 12,
    lineHeight: 16,
    color: Brand.primaryStrong,
    fontWeight: 800,
  },
  filterButtonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    marginBottom: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  resultsRow: {
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.five,
  },
  separator: {
    height: Spacing.three,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  errorState: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: 700,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.two,
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
  },
  retryText: {
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  clearButton: {
    marginTop: Spacing.two,
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
  },
  clearButtonText: {
    color: '#ffffff',
  },
});
