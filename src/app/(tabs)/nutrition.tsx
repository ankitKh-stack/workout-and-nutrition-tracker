import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, ErrorView, ListRow, PageHeader } from '@/components/ui';
import { WeekStrip } from '@/components/WeekStrip';
import { getFoodLog, getTargets, type Targets } from '@/data/repository';
import { MEALS, targetProgress, type Numbers } from '@/domain/nutrition';
import { formatNumber, localDateString, whole } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

const formatAmount = (amount: number, unit: 'serving' | 'gram') =>
  unit === 'gram' ? `${formatNumber(amount)} g` : `${formatNumber(amount)} serving${amount === 1 ? '' : 's'}`;

// Food log (SPEC.md 3.9): the selected Date's Entries (today by default; future Dates view-only) in the four Meals, with totals for the Date.
export default function NutritionScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const today = localDateString(new Date());
  const [date, setDate] = useState(today);
  const future = date > today;
  const { data, error, reload } = useFocusData(
    () => Promise.all([getFoodLog(db, date), getTargets(db)]),
    [db, date],
  );
  const [log, targets] = data ?? [];

  const stat = (label: string, value: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.title, styles.number]}>{value}</Text>
    </View>
  );
  const totals: Numbers | undefined = log?.totals;
  const hasTargets = targets && Object.values(targets).some((t) => t !== null);

  return (
    <View style={styles.screen}>
      <PageHeader title="Nutrition" />
      <ScrollView contentContainerStyle={styles.content}>
        <WeekStrip selected={date} onSelect={setDate} />
        {error ? (
          <ErrorView message="Could not load the food log." onRetry={reload} />
        ) : (
          <>
            {totals && hasTargets ? (
              <TargetSummary totals={totals} targets={targets} />
            ) : (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row' }}>
                  {stat('Calories', totals ? `${whole(totals.kcal)} kcal` : '—')}
                  {stat('Protein', totals ? `${whole(totals.protein)} g` : '—')}
                  {stat('Carbs', totals ? `${whole(totals.carbs)} g` : '—')}
                  {stat('Fat', totals ? `${whole(totals.fat)} g` : '—')}
                </View>
                {targets ? <Button label="Set targets" variant="link" onPress={() => router.push('/more')} /> : null}
              </View>
            )}
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
                      disabled={future}
                      accessibilityLabel={`Add food to ${label}`}
                      onPress={() => router.push({ pathname: '/add-food', params: { date, meal } })}
                    />
                  </View>
                  {section?.entries.map((e) => (
                    <ListRow
                      key={e.id}
                      title={e.name}
                      subtitle={formatAmount(e.amount, e.unit)}
                      onPress={() => router.push({ pathname: '/food-amount', params: { entryId: e.id } })}
                      right={<Text style={[styles.body, styles.number, { color: colors.text }]}>{whole(e.kcal)} kcal</Text>}
                    />
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Progress against the Targets: Calories with a bar and what's left or over, then a thin bar per Macro.
// A blank Target shows its total alone. Going over is the accent colour: a surplus isn't a failure.
function TargetSummary({ totals, targets }: { totals: Numbers; targets: Targets }) {
  const { styles, colors } = useTheme();
  const bar = (fraction: number, height: number) => (
    <View aria-hidden style={{ height, borderRadius: height / 2, backgroundColor: colors.raised, overflow: 'hidden' }}>
      <View style={{ width: `${fraction * 100}%`, height, backgroundColor: colors.accent }} />
    </View>
  );
  const kcal = targetProgress(totals.kcal, targets.kcal);
  const kcalOver = kcal !== null && Math.round(kcal.over) > 0;
  const macros = [
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'fat', label: 'Fat' },
  ] as const;

  return (
    <View style={[styles.card, { gap: 12 }]}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[styles.title, styles.number, { flex: 1 }]}>
            {kcal ? `${whole(kcal.eaten)} of ${whole(kcal.target)} kcal` : `${whole(totals.kcal)} kcal`}
          </Text>
          {kcal ? (
            <Text style={[styles.muted, styles.number, kcalOver && { color: colors.accent }]}>
              {kcalOver ? `${whole(kcal.over)} over` : `${whole(kcal.left)} left`}
            </Text>
          ) : null}
        </View>
        {kcal ? bar(kcal.fraction, 8) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {macros.map(({ key, label }) => {
          const p = targetProgress(totals[key], targets[key]);
          const over = p !== null && Math.round(p.over) > 0;
          return (
            <View key={key} style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.bodyStrong, styles.number, over && { color: colors.accent }]}>
                {p ? `${whole(p.eaten)} / ${whole(p.target)} g` : `${whole(totals[key])} g`}
              </Text>
              {p ? bar(p.fraction, 4) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
