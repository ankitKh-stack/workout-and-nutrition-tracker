import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, EmptyText, ErrorView, InlineError, ListRow } from '@/components/ui';
import {
  countWorkoutSets,
  deleteDay,
  deleteExercise,
  finishWorkout,
  getDayDeletionCounts,
  getDayDetail,
  getExerciseDeletionCounts,
  startWorkout,
} from '@/data/repository';
import { confirmAsync } from '@/lib/dialogs';
import { formatDateLong, formatTime, plural } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useTheme } from '@/theme/settings';

// Day detail (SPEC.md 3.3): the day's exercises plus start/finish workout,
// rename, delete, and removing exercises.
export default function DayDetailScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { data: day, error, reload } = useFocusData(() => getDayDetail(db, dayId), [db, dayId]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The "Workout saved" banner stays for 3 seconds.
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(timer);
  }, [banner]);

  if (error) return <ErrorView message="Could not load this day." onRetry={reload} />;
  if (day === undefined) return <View style={styles.screen} />;
  if (day === null) {
    return (
      <View style={styles.centered}>
        <EmptyText>This day no longer exists.</EmptyText>
      </View>
    );
  }

  const openLog = (workoutId: string, exerciseId: string) =>
    router.push({ pathname: '/workouts/log', params: { workoutId, exerciseId } });

  async function onStart() {
    setActionError(null);
    try {
      await startWorkout(db, dayId);
      await reload();
    } catch {
      setActionError('Could not start the workout. Try again.');
    }
  }

  async function onExercisePress(exerciseId: string) {
    if (!day) return;
    if (day.workout) return openLog(day.workout.id, exerciseId);
    // Sets can only be logged inside a workout, so ask before starting one.
    const ok = await confirmAsync(`Start a workout for ${day.name} now?`, '', 'Start');
    if (!ok) return;
    try {
      const workoutId = await startWorkout(db, dayId);
      openLog(workoutId, exerciseId);
    } catch {
      setActionError('Could not start the workout. Try again.');
    }
  }

  async function onRemoveExercise(exerciseId: string, name: string) {
    const counts = await getExerciseDeletionCounts(db, exerciseId);
    const history =
      counts.loggedSets > 0
        ? ` and ${plural(counts.loggedSets, 'logged set')} (including past workouts, so their volume and calendar shade will change)`
        : '';
    const ok = await confirmAsync(
      `Remove '${name}'?`,
      `This permanently removes ${plural(counts.variations, 'variation')}${history}. This cannot be undone.`,
      'Remove',
      true,
    );
    if (!ok) return;
    setActionError(null);
    try {
      await deleteExercise(db, exerciseId);
      await reload();
    } catch {
      setActionError('Could not remove this exercise. Nothing was removed.');
    }
  }

  async function onFinish() {
    if (!day?.workout) return;
    setActionError(null);
    try {
      const count = await countWorkoutSets(db, day.workout.id);
      if (count === 0) {
        const ok = await confirmAsync(
          'Save with zero volume?',
          'No sets were logged. Save this as a workout with zero volume?',
          'Save',
        );
        if (!ok) return;
      }
      await finishWorkout(db, day.workout.id);
      setBanner('Workout saved');
      await reload();
    } catch {
      setActionError('Could not save the workout. Try again.');
    }
  }

  async function onDelete() {
    if (!day) return;
    setMenuOpen(false);
    const counts = await getDayDeletionCounts(db, dayId);
    const ok = await confirmAsync(
      `Delete '${day.name}'?`,
      `This permanently removes its ${plural(counts.exercises, 'exercise')} and ${plural(
        counts.workouts,
        'logged workout',
      )}. This cannot be undone.`,
      'Delete',
      true,
    );
    if (!ok) return;
    try {
      await deleteDay(db, dayId);
      // Back to Home; when the day was opened directly (e.g. a web reload) there is no screen to go back to.
      if (router.canGoBack()) router.back();
      else router.replace('/workouts');
    } catch {
      setActionError('Could not delete this day. Nothing was removed.');
    }
  }

  const status = day.workout
    ? `Workout in progress — started ${formatTime(day.workout.startedAt)}`
    : day.lastWorkoutDate
      ? `Last workout: ${formatDateLong(day.lastWorkoutDate)}`
      : 'No workouts yet';

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: day.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More"
              onPress={() => setMenuOpen((o) => !o)}
              style={{ paddingHorizontal: 12, paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 22, color: colors.primary }}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      {menuOpen ? (
        <View style={[styles.content, { borderBottomWidth: 1, borderColor: colors.border }]}>
          <Button
            label="Rename day"
            onPress={() => {
              setMenuOpen(false);
              router.push({ pathname: '/name-day', params: { dayId } });
            }}
          />
          <Button
            label="Remove exercises"
            disabled={day.exercises.length === 0}
            onPress={() => {
              setMenuOpen(false);
              setRemoving(true);
            }}
          />
          <Button label="Delete day" variant="danger" onPress={onDelete} />
        </View>
      ) : null}
      {banner ? (
        <View style={{ backgroundColor: colors.success, padding: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>{banner}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.muted, day.workout && { color: colors.success, fontWeight: '600' }]}>{status}</Text>
        {actionError ? <InlineError>{actionError}</InlineError> : null}
        {removing ? (
          <View style={[styles.buttonRow, { alignItems: 'center' }]}>
            <Text style={[styles.muted, { flex: 1 }]}>Tap Remove next to an exercise to delete it.</Text>
            <Button label="Done" compact onPress={() => setRemoving(false)} />
          </View>
        ) : null}
        {day.exercises.length === 0 ? <EmptyText>No exercises yet. Add your first exercise.</EmptyText> : null}
        {day.exercises.map((e) => {
          const parts: string[] = [];
          if (e.variationName.trim().toLowerCase() !== e.name.trim().toLowerCase()) parts.push(e.variationName);
          if (day.workout) parts.push(`${plural(e.loggedSetCount, 'set')} logged`);
          return (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={parts.join(' · ') || undefined}
              onPress={removing ? undefined : () => onExercisePress(e.id)}
              right={
                removing ? (
                  <Button label="Remove" variant="danger" compact onPress={() => onRemoveExercise(e.id, e.name)} />
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
                )
              }
            />
          );
        })}
        {!removing ? (
          <Button
            label="+ Add exercise"
            onPress={() => router.push({ pathname: '/add-exercise', params: { dayId } })}
          />
        ) : null}
      </ScrollView>
      <View style={[styles.content, { borderTopWidth: 1, borderColor: colors.border }]}>
        {day.workout ? (
          <Button label="Finish workout" variant="primary" onPress={onFinish} />
        ) : (
          <Button label="Start workout" variant="primary" onPress={onStart} />
        )}
      </View>
    </View>
  );
}
