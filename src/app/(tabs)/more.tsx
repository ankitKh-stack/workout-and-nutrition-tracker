import { ScrollView, Text, View } from 'react-native';

import { LargeHeader, Segmented } from '@/components/ui';
import { useSettings, useTheme } from '@/theme/settings';

// Settings: dark mode and weight unit. Both apply immediately and are saved.
export default function MoreScreen() {
  const { styles } = useTheme();
  const { theme, setTheme, unit, setUnit } = useSettings();

  return (
    <View style={styles.screen}>
      <LargeHeader title="More" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Theme</Text>
          <Segmented
            accessibilityLabel="Theme"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={theme}
            onChange={setTheme}
          />
        </View>

        <Text style={styles.sectionTitle}>Units</Text>
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Weight</Text>
          <Segmented
            accessibilityLabel="Weight unit"
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            value={unit}
            onChange={setUnit}
          />
          <Text style={styles.muted}>
            Switching converts every weight you see, including past workouts. Your logged data is not changed.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
