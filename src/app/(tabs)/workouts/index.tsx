import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView } from 'react-native';

import { Button, EmptyText, ErrorView, ListRow, styles } from '@/components/ui';
import { listDays } from '@/data/repository';
import { formatDateLong, plural } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';

// Home / Day list (SPEC.md 3.1)
export default function HomeScreen() {
  const db = useSQLiteContext();
  const { data: days, error, reload } = useFocusData(() => listDays(db), [db]);

  if (error) return <ErrorView message="Could not load your days." onRetry={reload} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {days && days.length === 0 ? (
        <EmptyText>No days yet. Create your first day, for example Push Day, Pull Day or Leg Day.</EmptyText>
      ) : null}
      {days?.map((day) => (
        <ListRow
          key={day.id}
          title={day.name}
          subtitle={`${plural(day.exerciseCount, 'exercise')} · ${
            day.inProgress
              ? 'Workout in progress'
              : day.lastWorkoutDate
                ? `Last workout: ${formatDateLong(day.lastWorkoutDate)}`
                : 'No workouts yet'
          }`}
          onPress={() => router.push({ pathname: '/workouts/day/[dayId]', params: { dayId: day.id } })}
        />
      ))}
      <Button label="+ New day" variant="primary" onPress={() => router.push('/name-day')} />
    </ScrollView>
  );
}
