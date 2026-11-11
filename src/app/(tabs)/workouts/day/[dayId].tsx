import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ReorderableList } from '@/components/ReorderableList';
import { RestTimerBar } from '@/components/RestTimerBar';
import { Button, Chevron, EmptyText, ErrorView, InlineError, ListRow } from '@/components/ui';
import {
  countWorkoutSets,
  deleteDay,
  deleteExercise,
  finishWorkout,
  getDayDeletionCounts,
  getDayDetail,
  getExerciseDeletionCounts,
  getWorkoutPRs,
  reorderExercises,
  resumeWorkout,
  startWorkout,
  ValidationError,
  type SetPR,
} from '@/data/repository';
import { confirmAsync } from '@/lib/dialogs';
import { useRestTimer } from '@/lib/restTimer';
import { formatDateLong, formatTime, formatWeight, plural } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

const ENDED_MESSAGE = 'This workout already ended on its own after an hour with no activity.';

// Day detail (SPEC.md 3.3): the day's exercises plus start/finish/resume workout,
// rename, delete, renaming and removing exercises, and holding an exercise to
// drag it into a new order.
export default function DayDetailScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { unit } = useSettings();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { data: day, error, reload } = useFocusData(() => getDayDetail(db, dayId), [db, dayId]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Remove or rename mode: each exercise row shows that action instead of opening.
  const [mode, setMode] = useState<'remove' | 'rename' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Personal records of the workout just finished; gone on × or when leaving the screen.
  const [prs, setPrs] = useState<SetPR[]>([]);
  // Set at once (state only updates on the next render), so a fast double tap starts one workout.
  const starting = useRef(false);
  const finishing = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const { cancelFor } = useRestTimer();
  // No workout in progress (finished, auto-ended or discarded), or the day is gone: no rest to time.
  useEffect(() => {
    if (day === null || (day && !day.workout)) cancelFor({ dayId });
  }, [day, dayId, cancelFor]);

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
    if (starting.current) return;
    starting.current = true;
    setActionError(null);
    try {
      await startWorkout(db, dayId);
      setPrs([]);
      await reload();
    } catch {
      setActionError('Could not start the workout. Try again.');
    }
    starting.current = false;
  }

  function onExercisePress(exerciseId: string) {
    if (!day) return;
    if (day.workout) return openLog(day.workout.id, exerciseId);
    // No workout running: show the exercise's history read-only. Workouts
    // start only from the Start workout button.
    router.push({ pathname: '/workouts/history', params: { exerciseId } });
  }

  async function onResume() {
    if (!day?.resumable) return;
    setActionError(null);
    try {
      await resumeWorkout(db, day.resumable.id);
      setPrs([]);
      await reload();
    } catch (e) {
      setActionError(e instanceof ValidationError ? e.message : 'Could not resume the workout. Try again.');
      await reload();
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
    if (!day?.workout || finishing.current) return;
    finishing.current = true;
    setActionError(null);
    try {
      // Reload first: the screen may have been left open in the background past
      // the auto-end hour, and then the workout has already ended.
      const fresh = await reload();
      if (!fresh?.workout) {
        setActionError(ENDED_MESSAGE);
        return;
      }
      const count = await countWorkoutSets(db, fresh.workout.id);
      if (count === 0) {
        const ok = await confirmAsync(
          'Save with zero volume?',
          'No sets were logged. Save this as a workout with zero volume?',
          'Save',
        );
        if (!ok) return;
      }
      if (!(await finishWorkout(db, fresh.workout.id))) {
        setActionError(ENDED_MESSAGE);
        await reload();
        return;
      }
      cancelFor({ workoutId: fresh.workout.id });
      setBanner('Workout saved');
      // The workout is saved by now, so a failed PR read only means no card.
      setPrs(await getWorkoutPRs(db, fresh.workout.id).catch(() => []));
      // The card is at the top; Finish sits below a list that may be scrolled down.
      scroll.current?.scrollTo({ y: 0, animated: true });
      await reload();
    } catch {
      setActionError('Could not save the workout. Try again.');
    }
    finishing.current = false;
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
              label="Rename exercises"
              icon="pencil-outline"
              variant="link"
              style={{ alignItems: 'flex-start' }}
              disabled={day.exercises.length === 0}
              onPress={() => {
                setMenuOpen(false);
                setMode('rename');
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
                setMode('remove');
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
      <ScrollView ref={scroll} contentContainerStyle={styles.content} scrollEnabled={!dragging}>
        {prs.length > 0 ? (
          <View style={[styles.card, { gap: 4 }]} accessibilityLiveRegion="polite">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[styles.bodyStrong, { flex: 1 }]}
                accessibilityRole="header"
                accessibilityLabel={`${plural(prs.length, 'personal record')} this workout`}
              >
                🏆 {plural(prs.length, 'PR')} this workout
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss personal records"
                onPress={() => setPrs([])}
                hitSlop={12}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={18} color={colors.faint} />
              </Pressable>
            </View>
            {prs.map((p) => (
              <Text key={`${p.label}:${p.setNumber}`} style={[styles.body, styles.number]}>
                {p.label} Set {p.setNumber} · {p.reps} × {formatWeight(p.weight, unit)} {unit} (was {p.lastReps} ×{' '}
                {formatWeight(p.lastWeight, unit)})
              </Text>
            ))}
          </View>
        ) : null}
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
        {mode ? (
          <View style={[styles.buttonRow, { alignItems: 'center' }]}>
            <Text style={[styles.muted, { flex: 1 }]}>
              {mode === 'remove'
                ? 'Removing also deletes the sets logged on that exercise.'
                : 'Renaming keeps all the sets logged on that exercise.'}
            </Text>
            <Button label="Done" compact onPress={() => setMode(null)} />
          </View>
        ) : null}
        {day.exercises.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.bodyStrong}>No exercises yet</Text>
            <Text style={styles.muted}>Add the exercises you do on {day.name}, for example Bench press or Incline dumbbell press.</Text>
          </View>
        ) : null}
        <ReorderableList
          items={day.exercises}
          keyOf={(e) => e.id}
          disabled={mode !== null}
          onDragChange={setDragging}
          onReorder={(ids) => reorderExercises(db, ids).then(reload, () => {
            setActionError('Could not save the new order. Try again.');
            reload();
          })}
          renderItem={(e, drag) => {
            const parts: string[] = [];
            if (e.variationName.trim().toLowerCase() !== e.name.trim().toLowerCase()) parts.push(e.variationName);
            if (day.workout) parts.push(`${plural(e.loggedSetCount, 'set')} logged`);
            else parts.push('Tap to see past sets');
            return (
              <ListRow
                {...(mode ? {} : drag.handlers)}
                lifted={drag.active}
                title={e.name}
                subtitle={parts.join(' · ')}
                onPress={mode ? undefined : () => onExercisePress(e.id)}
                right={
                  mode === 'remove' ? (
                    <Button label="Remove" variant="danger" compact onPress={() => onRemoveExercise(e.id, e.name)} />
                  ) : mode === 'rename' ? (
                    <Button
                      label="Rename"
                      compact
                      onPress={() => router.push({ pathname: '/add-exercise', params: { dayId, exerciseId: e.id } })}
                    />
                  ) : (
                    <Chevron />
                  )
                }
              />
            );
          }}
        />
        {!mode ? (
          <Button
            label="Add exercise"
            icon="add"
            onPress={() => router.push({ pathname: '/add-exercise', params: { dayId } })}
          />
        ) : null}
      </ScrollView>
      <RestTimerBar dayId={dayId} />
      <View style={[styles.content, { paddingBottom: 12 }]}>
        {day.workout ? (
          <Button label="Finish workout" icon="checkmark" variant="primary" onPress={onFinish} />
        ) : (
          <>
            {day.resumable ? (
              <Button
                label={`Resume workout finished ${formatTime(day.resumable.finishedAt)}`}
                icon="refresh"
                onPress={onResume}
              />
            ) : null}
            <Button label="Start workout" icon="play" variant="primary" onPress={onStart} />
          </>
        )}
      </View>
    </View>
  );
}
