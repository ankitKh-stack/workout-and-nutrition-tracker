import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { PageHeader } from '@/components/ui';
import { useTheme } from '@/theme/settings';

// Placeholder only: nutrition tracking is a later phase (SPEC.md 3.9).
// Centred in the space as an empty state, so the tab does not read as broken.
export default function NutritionScreen() {
  const { styles, colors } = useTheme();
  return (
    <View style={styles.screen}>
      <PageHeader title="Nutrition" />
      <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
          <Ionicons name="nutrition-outline" size={32} color={colors.faint} />
          <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>Coming in a later version</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Nutrition tracking is planned once the workout side is finished.
          </Text>
        </View>
      </View>
    </View>
  );
}
