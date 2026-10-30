import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, View } from 'react-native';

import { Button, EmptyText, ErrorView, LargeHeader, ListRow } from '@/components/ui';
import { listDays } from '@/data/repository';
import { formatDateLong, formatTime, plural } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

// Home / Day list (SPEC.md 3.1). A day with a workout in progress is listed
// first and highlighted so the user can get back to it in one tap.
export default function HomeScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { data: days, error, reload } = useFocusData(() => listDays(db), [db]);

  if (error) return <ErrorView message="Could not load your days." onRetry={reload} />;

  return (
    <View style={styles.screen}>
      <LargeHeader title="Workouts" />
      <ScrollView contentContainerStyle={styles.content}>
        {days && days.length === 0 ? (
          <EmptyText>No days yet. Create your first day, for example Push Day, Pull Day or Leg Day.</EmptyText>
        ) : null}
        {days?.map((day) => {
          const active = day.inProgressSince !== null;
          return (
            <ListRow
              key={day.id}
              title={day.name}
              badge={active ? { label: `In progress · started ${formatTime(day.inProgressSince!)}`, color: colors.success } : undefined}
              subtitle={`${plural(day.exerciseCount, 'exercise')} · ${
                day.lastWorkoutDate ? `Last workout: ${formatDateLong(day.lastWorkoutDate)}` : 'No workouts yet'
              }`}
              style={active ? { borderWidth: 2, borderColor: colors.success } : undefined}
              onPress={() => router.push({ pathname: '/workouts/day/[dayId]', params: { dayId: day.id } })}
            />
          );
        })}
        <Button label="+ New day" variant="primary" onPress={() => router.push('/name-day')} />
      </ScrollView>
    </View>
  );
}
