import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, Text, View } from 'react-native';

import { PageHeader, Segmented } from '@/components/ui';
import { getDataSummary } from '@/data/repository';
import { formatNumber, formatWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

// Settings: theme and weight unit (both apply immediately and are saved),
// plus what is stored on this phone.
export default function MoreScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { theme, setTheme, unit, setUnit } = useSettings();
  const { data: summary } = useFocusData(() => getDataSummary(db), [db]);

  const stat = (label: string, value: number | undefined) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.title, styles.number]}>{value === undefined ? '—' : formatNumber(value)}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <PageHeader title="More" subtitle="Settings and your data" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyStrong}>Theme</Text>
              <Text style={styles.small}>Saved on this phone</Text>
            </View>
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
        </View>

        <Text style={styles.sectionTitle}>Units</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyStrong}>Weight</Text>
              {/* Shows what the setting produces, using one fixed example in the chosen unit first. */}
              <Text style={[styles.small, styles.number]}>
                {unit === 'kg' ? `60 kg = ${formatWeight(60, 'lb')} lb` : `${formatWeight(60, 'lb')} lb = 60 kg`}
              </Text>
            </View>
            <Segmented
              accessibilityLabel="Weight unit"
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
              value={unit}
              onChange={setUnit}
            />
          </View>
          <Text style={styles.muted}>Switching changes how every weight is shown, past workouts included. Logged data stays as it is.</Text>
        </View>

        <Text style={styles.sectionTitle}>Your data</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {stat('Days', summary?.days)}
            {stat('Exercises', summary?.exercises)}
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {stat('Workouts', summary?.workouts)}
            {stat('Sets logged', summary?.sets)}
          </View>
          <Text style={styles.small}>Stored only on this phone. Nothing is uploaded.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
