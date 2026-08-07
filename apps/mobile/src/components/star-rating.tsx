import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface StarRatingProps {
  rating: number; // 0–5
  size?: number;
}

/** Row of five stars, filled up to the rounded rating. */
export function StarRating({ rating, size = 14 }: StarRatingProps) {
  const theme = useTheme();
  const filled = Math.round(rating);

  return (
    <View style={styles.row} accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <ThemedText
          key={i}
          style={[
            styles.star,
            { fontSize: size, color: i <= filled ? Brand.star : theme.backgroundSelected },
          ]}>
          ★
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    lineHeight: 20,
  },
});
