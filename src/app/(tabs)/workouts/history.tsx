import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { EmptyText, ErrorView, Segmented } from '@/components/ui';
import { getExerciseHistory } from '@/data/repository';
import { formatDateLong, formatWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

// Exercise history (read-only). Opened by tapping an exercise when no workout
// is in progress, so the user can look up what they lifted last time without
// starting a workout. Nothing on this screen writes to storage.
export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const [variationId, setVariationId] = useState<string | null>(null);
  const { data, error, reload } = useFocusData(
    () => getExerciseHistory(db, exerciseId, variationId),
    [db, exerciseId, variationId],
  );

  if (error) return <ErrorView message="Could not load this exercise." onRetry={reload} />;
  if (data === undefined) return <View style={styles.screen} />;
  if (data === null) {
    return (
      <View style={styles.centered}>
        <EmptyText>This exercise no longer exists.</EmptyText>
      </View>
    );
  }

  const w = (kg: number | null) => `${formatWeight(kg, unit)} ${unit}`;
  const line = (label: string, value: string, color?: string, indent = false) => (
    <View
      key={label + value}
      style={[
        { flexDirection: 'row', alignItems: 'baseline', minHeight: 28 },
        indent && { marginLeft: 12, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: color },
      ]}
    >
      <Text style={[indent ? styles.muted : styles.bodyStrong, { flex: 1 }, indent && color ? { color } : null]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[indent ? styles.muted : styles.body, styles.number]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.exerciseName }} />

      {/* Switch which variation's history is shown; this never changes the next workout. */}
      {data.variations.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Segmented
            accessibilityLabel="Variation"
            options={data.variations.map((v) => ({ value: v.id, label: v.name }))}
            value={data.selectedVariationId}
            onChange={setVariationId}
          />
        </ScrollView>
      ) : null}

      <Text style={styles.small}>
        {data.workouts.length === 0
          ? 'No logged workouts for this variation yet.'
          : `Last ${data.workouts.length === 1 ? 'workout' : `${data.workouts.length} workouts`}, newest first`}
      </Text>

      {data.workouts.map((wk) => (
        <View key={wk.workoutId} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 }}>
            <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>{formatDateLong(wk.date)}</Text>
            <Text style={[styles.bodyStrong, styles.number]}>
              {formatWeight(wk.volume, unit)}
              <Text style={styles.small}> {unit} volume</Text>
            </Text>
          </View>
          {wk.sets.map((s) => (
            <View key={s.setId} style={{ gap: 2 }}>
              {line(`Set ${s.number}`, `${s.reps ?? '—'} × ${w(s.weight)}`)}
              {s.intensifiers.map((i) =>
                i.type === 'drop'
                  ? line('Drop set', `${i.reps ?? '—'} × ${w(i.weight)}`, colors.kinds.drop, true)
                  : i.type === 'partial'
                    ? line('Partial reps', `${i.reps ?? '—'} at ${w(s.weight)}`, colors.kinds.partial, true)
                    : line(`Superset: ${i.partnerLabel}`, `${i.reps ?? '—'} × ${w(i.weight)}`, colors.kinds.superset, true),
              )}
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.small}>To log sets, tap Start workout on the day screen.</Text>
    </ScrollView>
  );
}
