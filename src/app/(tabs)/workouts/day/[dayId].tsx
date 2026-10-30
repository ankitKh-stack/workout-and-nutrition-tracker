import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Chevron, EmptyText, ErrorView, InlineError, ListRow } from '@/components/ui';
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
import { formatDateLong, formatTime, formatWeight, plural } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

// Day detail (SPEC.md 3.3): the day's exercises plus start/finish workout,
// rename, delete, and removing exercises.
export default function DayDetailScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
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

  function onExercisePress(exerciseId: string) {
    if (!day) return;
    if (day.workout) return openLog(day.workout.id, exerciseId);
    // No workout running: show the exercise's history read-only. Workouts
    // start only from the Start workout button.
    router.push({ pathname: '/workouts/history', params: { exerciseId } });
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
    ? `In progress · started ${formatTime(day.workout.startedAt)}`
    : day.lastWorkoutDate
      ? `Last workout ${formatDateLong(day.lastWorkoutDate)}`
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
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {menuOpen ? (
        <View style={[styles.content, { paddingTop: 4 }]}>
          <View style={[styles.card, { padding: 8, gap: 4 }]}>
            <Button
              label="Rename day"
              icon="create-outline"
              variant="link"
              style={{ alignItems: 'flex-start' }}
              onPress={() => {
                setMenuOpen(false);
                router.push({ pathname: '/name-day', params: { dayId } });
              }}
            />
            <Button
              label="Remove exercises"
              icon="remove-circle-outline"
              variant="link"
              style={{ alignItems: 'flex-start' }}
              disabled={day.exercises.length === 0}
              onPress={() => {
                setMenuOpen(false);
                setRemoving(true);
              }}
            />
            <Button
              label="Delete day"
              icon="trash-outline"
              variant="link"
              style={{ alignItems: 'flex-start' }}
              onPress={onDelete}
            />
          </View>
        </View>
      ) : null}
      {banner ? (
        <View style={{ backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={[styles.bodyStrong, { color: colors.onPrimary, textAlign: 'center' }]}>{banner}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        {/* The day at a glance: the workout running now, or how the last one went. */}
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.label, day.workout && { color: colors.accent }]}>{status}</Text>
            <Text style={[styles.title, styles.number]}>
              {day.workout
                ? formatWeight(day.workout.volume, unit)
                : day.lastWorkoutVolume !== null
                  ? formatWeight(day.lastWorkoutVolume, unit)
                  : '—'}
              <Text style={styles.small}> {unit} volume</Text>
            </Text>
          </View>
          {day.workout ? (
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.label}>Sets so far</Text>
              {/* Same count as the rows below, so the two always agree. */}
              <Text style={[styles.title, styles.number]}>{day.exercises.reduce((n, e) => n + e.loggedSetCount, 0)}</Text>
            </View>
          ) : null}
        </View>
        {actionError ? <InlineError>{actionError}</InlineError> : null}
        {removing ? (
          <View style={[styles.buttonRow, { alignItems: 'center' }]}>
            <Text style={[styles.muted, { flex: 1 }]}>Removing also deletes the sets logged on that exercise.</Text>
            <Button label="Done" compact onPress={() => setRemoving(false)} />
          </View>
        ) : null}
        {day.exercises.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.bodyStrong}>No exercises yet</Text>
            <Text style={styles.muted}>Add the exercises you do on {day.name}, for example Bench press or Incline dumbbell press.</Text>
          </View>
        ) : null}
        {day.exercises.map((e) => {
          const parts: string[] = [];
          if (e.variationName.trim().toLowerCase() !== e.name.trim().toLowerCase()) parts.push(e.variationName);
          if (day.workout) parts.push(`${plural(e.loggedSetCount, 'set')} logged`);
          else parts.push('Tap to see past sets');
          return (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={parts.join(' · ')}
              onPress={removing ? undefined : () => onExercisePress(e.id)}
              right={
                removing ? (
                  <Button label="Remove" variant="danger" compact onPress={() => onRemoveExercise(e.id, e.name)} />
                ) : (
                  <Chevron />
                )
              }
            />
          );
        })}
        {!removing ? (
          <Button
            label="Add exercise"
            icon="add"
            onPress={() => router.push({ pathname: '/add-exercise', params: { dayId } })}
          />
        ) : null}
      </ScrollView>
      <View style={[styles.content, { paddingBottom: 12 }]}>
        {day.workout ? (
          <Button label="Finish workout" icon="checkmark" variant="primary" onPress={onFinish} />
        ) : (
          <Button label="Start workout" icon="play" variant="primary" onPress={onStart} />
        )}
      </View>
    </View>
  );
}
