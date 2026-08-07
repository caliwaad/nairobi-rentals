import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  EMPTY_FILTERS,
  NEIGHBORHOODS,
  PRICE_PRESETS,
  SIZES,
  SIZE_LABELS,
  countMatching,
  type ListingFilters,
  type ListingSize,
} from '@/data/sample-listings';
import { useTheme } from '@/hooks/use-theme';

interface FilterSheetProps {
  visible: boolean;
  initial: ListingFilters;
  onApply: (filters: ListingFilters) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, initial, onApply, onClose }: FilterSheetProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<ListingFilters>(initial);

  useEffect(() => {
    if (visible) {
      setDraft(initial);
    }
  }, [visible, initial]);

  const hasActive = draft.size !== null || draft.maxPrice !== null || draft.neighborhood !== null;
  const draftCount = countMatching(draft);

  const toggleSize = (size: ListingSize) =>
    setDraft((d) => ({ ...d, size: d.size === size ? null : size }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView style={styles.sheet}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />

          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>Filters</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ✕
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Size
            </ThemedText>
            <View style={styles.chipWrap}>
              {SIZES.map((size) => {
                const selected = draft.size === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => toggleSize(size)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: selected ? Brand.primary : theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="small"
                      themeColor={selected ? undefined : 'text'}
                      style={selected ? styles.chipSelectedText : undefined}>
                      {SIZE_LABELS[size]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Max rent per month
            </ThemedText>
            <View style={styles.chipWrap}>
              {PRICE_PRESETS.map((preset) => {
                const selected = draft.maxPrice === preset.value;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => setDraft((d) => ({ ...d, maxPrice: preset.value }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: selected ? Brand.primary : theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="small"
                      themeColor={selected ? undefined : 'text'}
                      style={selected ? styles.chipSelectedText : undefined}>
                      {preset.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Neighbourhood
            </ThemedText>
            <View style={styles.chipWrap}>
              <Pressable
                onPress={() => setDraft((d) => ({ ...d, neighborhood: null }))}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.neighborhood === null }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor:
                      draft.neighborhood === null ? Brand.primary : theme.backgroundElement,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="small"
                  themeColor={draft.neighborhood === null ? undefined : 'text'}
                  style={
                    draft.neighborhood === null ? styles.chipSelectedText : undefined
                  }>
                  All
                </ThemedText>
              </Pressable>
              {NEIGHBORHOODS.map((neighborhood) => {
                const selected = draft.neighborhood === neighborhood;
                return (
                  <Pressable
                    key={neighborhood}
                    onPress={() => setDraft((d) => ({ ...d, neighborhood }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: selected ? Brand.primary : theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="small"
                      themeColor={selected ? undefined : 'text'}
                      style={selected ? styles.chipSelectedText : undefined}>
                      {neighborhood}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {hasActive && (
              <Pressable onPress={() => setDraft(EMPTY_FILTERS)} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Clear all
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => onApply(draft)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.applyText}>
                Show {draftCount} home{draftCount === 1 ? '' : 's'}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  scrollContent: {
    paddingBottom: Spacing.three,
  },
  sectionLabel: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingBottom: Spacing.five,
  },
  applyButton: {
    flex: 1,
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  applyText: {
    color: '#ffffff',
  },
  chipSelectedText: {
    color: '#ffffff',
  },
});
