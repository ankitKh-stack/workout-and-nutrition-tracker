import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, Text, View } from 'react-native';

import { SetLines } from '@/components/SetLines';
import { EmptyText, ErrorView } from '@/components/ui';
import { getWorkoutDetail } from '@/data/repository';
import { formatChange, formatDateLong, formatTime, formatWeight } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

// One past workout, read-only: when it was, its volume and change, and every
// set logged in it grouped by exercise.
export default function WorkoutScreen() {
  const db = useSQLiteContext();
  const { styles } = useTheme();
  const { unit } = useSettings();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { data: workout, error, reload } = useFocusData(() => getWorkoutDetail(db, workoutId), [db, workoutId]);

  if (error) return <ErrorView message="Could not load this workout." onRetry={reload} />;
  if (workout === undefined) return <View style={styles.screen} />;
  if (workout === null) {
    return (
      <View style={styles.centered}>
        <EmptyText>This workout no longer exists.</EmptyText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: workout.dayName }} />
      <View style={styles.card}>
        <Text style={styles.label}>
          {formatDateLong(workout.date)} · {formatTime(workout.startedAt)}
          {workout.finishedAt ? `–${formatTime(workout.finishedAt)}` : ''}
        </Text>
        <Text style={[styles.title, styles.number]}>
          {formatWeight(workout.volume, unit)}
          <Text style={styles.small}> {unit} volume</Text>
        </Text>
        {workout.progress ? <Text style={styles.small}>{formatChange(workout.progress.result)}</Text> : null}
      </View>
      {workout.exercises.length === 0 ? <EmptyText>No sets were logged in this workout.</EmptyText> : null}
      {workout.exercises.map((e) => (
        <View key={e.variationId} style={styles.card}>
          <Text style={styles.sectionTitle}>{e.label}</Text>
          <SetLines sets={e.sets} />
        </View>
      ))}
    </ScrollView>
  );
}
