import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * OAuth redirect target (default redirectUrl for useSSO flows). The auth
 * session resolves in the background — this screen just holds the landing.
 */
export default function SSOCallbackScreen() {
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          Finishing sign-in…
        </ThemedText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  text: {
    marginTop: Spacing.two,
  },
});
