import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, Text, View } from 'react-native';

import { Chevron, ErrorView, ListRow } from '@/components/ui';
import { getCalendarWorkouts } from '@/data/repository';
import { isGrowth } from '@/domain/progress';
import { formatChange, formatDateLong, formatTime, formatWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

/** How many recent workouts the list shows. */
const RECENT_LIMIT = 50;

// History (SPEC.md 3.12), opened from More: the most recent completed
// workouts, newest first. Tapping one opens everything logged in it.
export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  const { data, error, reload } = useFocusData(
    async () =>
      (await getCalendarWorkouts(db)).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, RECENT_LIMIT),
    [db],
  );

  if (error) return <ErrorView message="Could not load your workouts." onRetry={reload} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {data && data.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.bodyStrong}>No workouts yet</Text>
          <Text style={styles.muted}>Finish a workout and it shows up here.</Text>
        </View>
      ) : null}
      {data?.map((w) => (
        <ListRow
          key={w.id}
          title={w.dayName}
          subtitle={`${formatDateLong(w.date)} · ${formatTime(w.startedAt)} · ${formatWeight(w.volume, unit)} ${unit}`}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: colors.shades[w.progress.level] }} />
              <Chevron />
            </View>
          }
          status={formatChange(w.progress.result)}
          // Growth in the data hue, a drop or zero in grey, as on the Calendar.
          statusColor={isGrowth(w.progress.result) ? colors.accent : colors.faint}
          onPress={() => router.push({ pathname: '/more/history/[workoutId]', params: { workoutId: w.id } })}
        />
      ))}
    </ScrollView>
  );
}
