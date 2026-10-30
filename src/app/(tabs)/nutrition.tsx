import { View } from 'react-native';

import { EmptyText, LargeHeader } from '@/components/ui';
import { useTheme } from '@/theme/settings';

// Placeholder only: nutrition tracking is a later phase (SPEC.md 3.9).
export default function NutritionScreen() {
  const { styles } = useTheme();
  return (
    <View style={styles.screen}>
      <LargeHeader title="Nutrition" />
      <View style={styles.content}>
        <EmptyText>Nutrition tracking is coming in a later version.</EmptyText>
      </View>
    </View>
  );
}
