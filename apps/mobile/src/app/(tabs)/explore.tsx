import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  EMPTY_FILTERS,
  NEIGHBORHOODS,
  SIZES,
  SIZE_LABELS,
  type ListingFilters,
  type ListingSize,
} from '@/data/sample-listings';
import { useTheme } from '@/hooks/use-theme';
import { useBrowseStore } from '@/store/browse';
import { useAllListings, useFetchListingsOnMount } from '@/store/listings';

interface ChipProps {
  label: string;
  count: number;
  onPress: () => void;
}

function Chip({ label, count, onPress }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small">{label}</ThemedText>
      <View style={[styles.countBadge, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {count}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * Explore Nairobi — browse the feed by neighbourhood or home size.
 * Tapping a chip hands the filter to the Home tab (via the browse store)
 * and navigates there, so the request becomes the active Home filters.
 */
export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  useFetchListingsOnMount();
  const allListings = useAllListings();

  const neighborhoodCounts = useMemo(() => {
    // Seed the static list so chips show even before the feed loads.
    const counts = new Map<string, number>(NEIGHBORHOODS.map((n) => [n, 0]));
    for (const listing of allListings) {
      counts.set(listing.neighborhood, (counts.get(listing.neighborhood) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allListings]);

  const sizeCounts = useMemo(() => {
    const counts = new Map<ListingSize, number>(SIZES.map((s) => [s, 0]));
    for (const listing of allListings) {
      counts.set(listing.size, (counts.get(listing.size) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [allListings]);

  const browse = (filters: ListingFilters) => {
    useBrowseStore.getState().request(filters);
    router.navigate('/');
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText style={styles.title}>Explore Nairobi</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Pick a neighbourhood or home size — the Home feed will match it.
            </ThemedText>
          </View>
        </View>

        <ThemedText type="smallBold" style={styles.sectionLabel}>
          Neighbourhoods
        </ThemedText>
        <View style={styles.chipWrap}>
          {neighborhoodCounts.map(([neighborhood, count]) => (
            <Chip
              key={neighborhood}
              label={neighborhood}
              count={count}
              onPress={() =>
                browse({ ...EMPTY_FILTERS, neighborhood })
              }
            />
          ))}
        </View>

        <ThemedText type="smallBold" style={styles.sectionLabel}>
          Home size
        </ThemedText>
        <View style={styles.chipWrap}>
          {sizeCounts.map(([size, count]) => (
            <Chip
              key={size}
              label={SIZE_LABELS[size]}
              count={count}
              onPress={() => browse({ ...EMPTY_FILTERS, size })}
            />
          ))}
        </View>

        <ThemedView type="backgroundElement" style={styles.tipCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Tip: you can combine neighbourhood and size with the Filter button on the
            Home screen.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
  },
  sectionLabel: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    borderRadius: Spacing.three,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one + 2,
  },
  pressed: {
    opacity: 0.8,
  },
  tipCard: {
    marginTop: Spacing.five,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
});
