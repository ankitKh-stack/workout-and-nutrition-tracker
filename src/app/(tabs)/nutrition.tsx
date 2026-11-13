import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, Text, View } from 'react-native';

import { Button, ErrorView, ListRow, PageHeader } from '@/components/ui';
import { getFoodLog } from '@/data/repository';
import { MEALS, type Numbers } from '@/domain/nutrition';
import { formatNumber, localDateString, whole } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

const formatAmount = (amount: number, unit: 'serving' | 'gram') =>
  unit === 'gram' ? `${formatNumber(amount)} g` : `${formatNumber(amount)} serving${amount === 1 ? '' : 's'}`;

// Food log (SPEC.md 3.9): today's Entries in the four Meals, with totals for the Date.
export default function NutritionScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const date = localDateString(new Date());
  const { data: log, error, reload } = useFocusData(() => getFoodLog(db, date), [db, date]);

  const stat = (label: string, value: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.title, styles.number]}>{value}</Text>
    </View>
  );
  const totals: Numbers | undefined = log?.totals;

  return (
    <View style={styles.screen}>
      <PageHeader title="Nutrition" />
      {error ? (
        <ErrorView message="Could not load the food log." onRetry={reload} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { flexDirection: 'row' }]}>
            {stat('Calories', totals ? `${whole(totals.kcal)} kcal` : '—')}
            {stat('Protein', totals ? `${whole(totals.protein)} g` : '—')}
            {stat('Carbs', totals ? `${whole(totals.carbs)} g` : '—')}
            {stat('Fat', totals ? `${whole(totals.fat)} g` : '—')}
          </View>
          {MEALS.map(({ meal, label }) => {
            const section = log?.meals.find((m) => m.meal === meal);
            return (
              <View key={meal} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text role="heading" aria-level={2} style={[styles.sectionTitle, { flex: 1 }]}>
                    {label}
                  </Text>
                  <Text style={[styles.muted, styles.number]}>{section ? `${whole(section.totals.kcal)} kcal` : ''}</Text>
                  <Button
                    label="+"
                    compact
                    accessibilityLabel={`Add food to ${label}`}
                    onPress={() => router.push({ pathname: '/add-food', params: { date, meal } })}
                  />
                </View>
                {section?.entries.map((e) => (
                  <ListRow
                    key={e.id}
                    title={e.name}
                    subtitle={formatAmount(e.amount, e.unit)}
                    right={<Text style={[styles.body, styles.number, { color: colors.text }]}>{whole(e.kcal)} kcal</Text>}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
