import { View } from 'react-native';

import { EmptyText, styles } from '@/components/ui';

// Placeholder only: nutrition tracking is a later phase (SPEC.md 3.9).
export default function NutritionScreen() {
  return (
    <View style={[styles.screen, styles.centered]}>
      <EmptyText>Nutrition tracking is coming in a later version.</EmptyText>
    </View>
  );
}
