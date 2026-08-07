import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterSheet } from '@/components/filter-sheet';
import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import {
  EMPTY_FILTERS,
  SAMPLE_LISTINGS,
  matchesListing,
  type ListingFilters,
} from '@/data/sample-listings';

const ItemSeparator = () => <View style={styles.separator} />;
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_LISTINGS.filter((listing) => {
      if (!matchesListing(listing, filters)) return false;
      if (q) {
        const haystack = `${listing.title} ${listing.neighborhood} ${listing.address}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [filters, query]);

  const activeFilterCount = [filters.size, filters.maxPrice, filters.neighborhood].filter(
    (v) => v !== null,
  ).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.content, Platform.OS === 'web' && styles.contentWeb]}>
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

          <FlatList
            data={filtered}
            keyExtractor={(listing) => listing.id}
            renderItem={({ item }) => <ListingCard listing={item} />}
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
        </View>
      </SafeAreaView>

      <FilterSheet
        visible={filterVisible}
        initial={filters}
        onApply={(next) => {
          setFilters(next);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  contentWeb: {
    paddingTop: 84,
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
