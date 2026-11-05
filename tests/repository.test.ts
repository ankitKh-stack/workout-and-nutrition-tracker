// The repository's SQL run against a real in-memory SQLite database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addExercise,
  addIntensifier,
  addSet,
  computeWorkoutVolume,
  createDay,
  createVariationAndSwap,
  deleteDay,
  deleteExercise,
  finishWorkout,
  getCalendarWorkouts,
  getDataSummary,
  getDayDetail,
  getExerciseDeletionCounts,
  getExerciseHistory,
  getLoggingData,
  getWorkoutDetail,
  listDays,
  removeSet,
  renameDay,
  renameExercise,
  reorderDays,
  reorderExercises,
  resumeWorkout,
  startWorkout,
  updateSetField,
  ValidationError,
} from '../src/data/repository.ts';
import { openTestDb, tick } from './testDb.ts';

const dayOrder = async (db: SQLiteDatabase) => (await listDays(db)).map((d) => d.name);

async function threeDays(db: SQLiteDatabase) {
  const push = await createDay(db, 'Push');
  await tick();
  const pull = await createDay(db, 'Pull');
  await tick();
  const legs = await createDay(db, 'Legs');
  await tick();
  return { push, pull, legs };
}

async function logSet(db: SQLiteDatabase, workoutId: string, variationId: string, reps: number, weight: number) {
  const id = await addSet(db, workoutId, variationId);
  await updateSetField(db, id, 'reps', reps);
  await updateSetField(db, id, 'weight', weight);
  return id;
}

/**
 * The SPEC 4.3 workout: Bench 10 × 60 and 8 × 60, then on set 2 a drop set
 * 6 × 40, 4 partial reps and a superset with Curl 12 × 25. Volume 1,860.
 */
async function specWorkout(db: SQLiteDatabase) {
  const dayId = await createDay(db, 'Push');
  const bench = await addExercise(db, dayId, 'Bench');
  const curl = await addExercise(db, dayId, 'Curl');
  const workoutId = await startWorkout(db, dayId);
  const benchVar = (await getLoggingData(db, workoutId, bench))!.selectedVariationId;
  await logSet(db, workoutId, benchVar, 10, 60);
  const set2 = await logSet(db, workoutId, benchVar, 8, 60);
  const drop = await addIntensifier(db, set2, 'drop');
  await updateSetField(db, drop, 'reps', 6);
  await updateSetField(db, drop, 'weight', 40);
  const partial = await addIntensifier(db, set2, 'partial');
  await updateSetField(db, partial, 'reps', 4);
  const superset = await addIntensifier(db, set2, 'superset', curl);
  await updateSetField(db, superset, 'reps', 12);
  await updateSetField(db, superset, 'weight', 25);
  return { dayId, bench, curl, workoutId, benchVar, set2 };
}

test('a new day starts at the top, and duplicate day names are blocked', async () => {
  const db = await openTestDb();
  await threeDays(db);
  assert.deepEqual(await dayOrder(db), ['Legs', 'Pull', 'Push']);
  await assert.rejects(createDay(db, '  push '), ValidationError);
});

test('any change inside a day moves it to the top', async () => {
  const db = await openTestDb();
  const { push, pull } = await threeDays(db);
  await addExercise(db, push, 'Bench');
  assert.deepEqual(await dayOrder(db), ['Push', 'Legs', 'Pull']);
  await tick();
  await renameDay(db, pull, 'Back');
  assert.deepEqual(await dayOrder(db), ['Back', 'Push', 'Legs']);
});

test('a dragged day order holds until a day changes', async () => {
  const db = await openTestDb();
  const { push, pull, legs } = await threeDays(db);
  await reorderDays(db, [push, legs, pull]);
  assert.deepEqual(await dayOrder(db), ['Push', 'Legs', 'Pull']);
  await tick();
  await addExercise(db, pull, 'Rows');
  assert.deepEqual(await dayOrder(db), ['Pull', 'Push', 'Legs']);
});

test('a day with a workout in progress stays first', async () => {
  const db = await openTestDb();
  const { push, pull, legs } = await threeDays(db);
  await startWorkout(db, push);
  await tick();
  await reorderDays(db, [pull, legs, push]);
  assert.deepEqual(await dayOrder(db), ['Push', 'Pull', 'Legs']);
});

test('exercises keep the dragged order, and duplicate names in a day are blocked', async () => {
  const db = await openTestDb();
  const day = await createDay(db, 'Push');
  const bench = await addExercise(db, day, 'Bench');
  const dips = await addExercise(db, day, 'Dips');
  const fly = await addExercise(db, day, 'Fly');
  await reorderExercises(db, [fly, bench, dips]);
  assert.deepEqual((await getDayDetail(db, day))!.exercises.map((e) => e.name), ['Fly', 'Bench', 'Dips']);
  await assert.rejects(addExercise(db, day, 'dips'), ValidationError);
});

test('renaming an exercise keeps its sets and renames its original variation', async () => {
  const db = await openTestDb();
  const day = await createDay(db, 'Pull');
  const rows = await addExercise(db, day, 'Rows');
  await addExercise(db, day, 'Curl');
  const workout = await startWorkout(db, day);
  await logSet(db, workout, (await getLoggingData(db, workout, rows))!.selectedVariationId, 10, 50);
  await createVariationAndSwap(db, workout, rows, 'Cable row');

  await renameExercise(db, rows, 'T-bar Rows');
  const history = (await getExerciseHistory(db, rows, null))!;
  assert.equal(history.exerciseName, 'T-bar Rows');
  assert.deepEqual(history.variations.map((v) => v.name), ['T-bar Rows', 'Cable row']);
  assert.equal((await getExerciseDeletionCounts(db, rows)).loggedSets, 1);

  await assert.rejects(renameExercise(db, rows, 'curl'), ValidationError);
  await renameExercise(db, rows, 't-bar rows'); // a change of case is allowed
});

test('workout volume follows SPEC 4.3: 1,860', async () => {
  const db = await openTestDb();
  const { dayId, workoutId } = await specWorkout(db);
  assert.equal(await computeWorkoutVolume(db, workoutId), 1860);

  // Sets so far: Bench has 2 normal sets; Curl has the superset partner set.
  const detail = (await getDayDetail(db, dayId))!;
  assert.deepEqual(detail.exercises.map((e) => [e.name, e.loggedSetCount]), [['Bench', 2], ['Curl', 1]]);

  await finishWorkout(db, workoutId);
  const [calendar] = await getCalendarWorkouts(db);
  assert.equal(calendar.volume, 1860);
  assert.equal(calendar.progress.result.kind, 'first');
});

test('the next workout shows last time\'s normal sets', async () => {
  const db = await openTestDb();
  const { dayId, bench, workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  const next = await startWorkout(db, dayId);
  const data = (await getLoggingData(db, next, bench))!;
  assert.deepEqual(data.lastTime?.sets, [
    { reps: 10, weight: 60 },
    { reps: 8, weight: 60 },
  ]);
});

test('history shows the variation\'s own volume, leaving out superset rows', async () => {
  const db = await openTestDb();
  const { bench, workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  const history = (await getExerciseHistory(db, bench, null))!;
  assert.equal(history.workouts.length, 1);
  assert.equal(history.workouts[0].volume, 1560);
});

test('swapping a variation never moves logged sets', async () => {
  const db = await openTestDb();
  const { bench, workoutId } = await specWorkout(db);
  await createVariationAndSwap(db, workoutId, bench, 'Incline bench');
  const data = (await getLoggingData(db, workoutId, bench))!;
  assert.equal(data.selectedVariationName, 'Incline bench');
  assert.equal(data.sets.length, 0);
  assert.deepEqual(data.alsoLogged.map((v) => [v.name, v.count]), [['Bench', 2]]);
  assert.equal(await computeWorkoutVolume(db, workoutId), 1860);
});

test('removing a set removes its intensifier rows', async () => {
  const db = await openTestDb();
  const { workoutId, set2 } = await specWorkout(db);
  await removeSet(db, set2);
  assert.equal(await computeWorkoutVolume(db, workoutId), 600);
});

test('removing an exercise takes its sets out of past volumes', async () => {
  const db = await openTestDb();
  const { curl, workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  await deleteExercise(db, curl);
  assert.equal((await getCalendarWorkouts(db))[0].volume, 1560);
});

test('deleting a day removes everything that belonged to it', async () => {
  const db = await openTestDb();
  const { dayId, workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  await deleteDay(db, dayId);
  assert.deepEqual(await getDataSummary(db), { days: 0, exercises: 0, workouts: 0, sets: 0 });
  // No orphaned rows left in any table.
  for (const table of ['exercise', 'variation', 'workout', 'workout_set', 'intensifier']) {
    assert.deepEqual(await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`), { n: 0 }, table);
  }
});

/** Makes a workout look as if its last activity was `minutes` ago. */
async function age(db: SQLiteDatabase, workoutId: string, minutes: number) {
  const then = new Date(Date.now() - minutes * 60000).toISOString();
  await db.runAsync('UPDATE workout SET started_at = ?, updated_at = ? WHERE id = ?', then, then, workoutId);
  await db.runAsync('UPDATE workout_set SET created_at = ?, updated_at = ? WHERE workout_id = ?', then, then, workoutId);
  return then;
}

const workoutRow = (db: SQLiteDatabase, id: string) =>
  db.getFirstAsync<{ status: string; finished_at: string | null }>('SELECT status, finished_at FROM workout WHERE id = ?', id);

test('a workout inactive for over an hour ends at its last activity', async () => {
  const db = await openTestDb();
  const { dayId, workoutId } = await specWorkout(db);
  const lastActivity = await age(db, workoutId, 61);
  await listDays(db);
  assert.deepEqual(await workoutRow(db, workoutId), { status: 'completed', finished_at: lastActivity });
  const detail = (await getDayDetail(db, dayId))!;
  assert.equal(detail.workout, null);
  assert.equal(detail.resumable, null); // ended over 30 minutes ago
  assert.equal((await getCalendarWorkouts(db))[0].volume, 1860);
});

test('an inactive workout with nothing typed in is discarded', async () => {
  const db = await openTestDb();
  const day = await createDay(db, 'Push');
  const bench = await addExercise(db, day, 'Bench');
  const workout = await startWorkout(db, day);
  await addSet(db, workout, (await getLoggingData(db, workout, bench))!.selectedVariationId); // empty row
  await age(db, workout, 61);
  await listDays(db);
  assert.equal(await workoutRow(db, workout), null);
  // Its rows go with it (through the foreign keys), not just out of the counts.
  assert.deepEqual(await db.getFirstAsync('SELECT COUNT(*) AS n FROM workout_set'), { n: 0 });
});

test('a workout active within the hour keeps going', async () => {
  const db = await openTestDb();
  const { workoutId } = await specWorkout(db);
  await age(db, workoutId, 59);
  await listDays(db);
  assert.equal((await workoutRow(db, workoutId))!.status, 'in_progress');
});

test('a workout finished within 30 minutes can be resumed, with its sets', async () => {
  const db = await openTestDb();
  const { dayId, workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  await age(db, workoutId, 70); // sets logged long ago, finished just now
  assert.equal((await getDayDetail(db, dayId))!.resumable?.id, workoutId);
  await resumeWorkout(db, workoutId);
  // Resuming counts as activity, so it is not auto-ended straight away.
  const detail = (await getDayDetail(db, dayId))!;
  assert.equal(detail.workout?.id, workoutId);
  assert.equal(detail.workout?.volume, 1860);
  assert.equal(detail.resumable, null);
});

test('resuming is refused after 30 minutes or while another workout runs', async () => {
  const db = await openTestDb();
  const { dayId, workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  const other = await startWorkout(db, dayId);
  assert.equal((await getDayDetail(db, dayId))!.resumable, null);
  await assert.rejects(resumeWorkout(db, workoutId), /already has a workout in progress/);
  await finishWorkout(db, other);
  await db.runAsync('UPDATE workout SET finished_at = ? WHERE id = ?', new Date(Date.now() - 31 * 60000).toISOString(), workoutId);
  await assert.rejects(resumeWorkout(db, workoutId), /more than 30 minutes ago/);
});

test('workout detail lists every set, with superset rows under their set', async () => {
  const db = await openTestDb();
  const { workoutId } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  const detail = (await getWorkoutDetail(db, workoutId))!;
  assert.equal(detail.volume, 1860);
  assert.deepEqual(detail.exercises.map((e) => e.label), ['Bench']); // Curl only appears as Bench's superset
  const [, set2] = detail.exercises[0].sets;
  assert.deepEqual(set2.intensifiers.map((i) => [i.type, i.partnerLabel]), [['drop', null], ['partial', null], ['superset', 'Curl']]);
});

test('auto-ending a workout leaves the day order alone', async () => {
  const db = await openTestDb();
  const { push, pull, legs } = await threeDays(db);
  const bench = await addExercise(db, push, 'Bench');
  const workout = await startWorkout(db, push);
  await logSet(db, workout, (await getLoggingData(db, workout, bench))!.selectedVariationId, 10, 60);
  await age(db, workout, 61);
  await tick();
  await reorderDays(db, [pull, legs, push]);
  // Listing days ends the stale workout first; ending it is not a change, so the dragged order holds.
  assert.deepEqual(await dayOrder(db), ['Pull', 'Legs', 'Push']);
  assert.equal((await workoutRow(db, workout))!.status, 'completed');
});

test('removing a set counts as activity', async () => {
  const db = await openTestDb();
  const { workoutId, set2 } = await specWorkout(db);
  await age(db, workoutId, 61);
  await removeSet(db, set2);
  await listDays(db);
  assert.equal((await workoutRow(db, workoutId))!.status, 'in_progress');
});

test('only a finished workout can be resumed', async () => {
  const db = await openTestDb();
  const { workoutId } = await specWorkout(db);
  await assert.rejects(resumeWorkout(db, workoutId), /cannot be resumed/); // still in progress
  await assert.rejects(resumeWorkout(db, 'no-such-workout'), /cannot be resumed/);
});

test('Finish on a workout that already auto-ended changes nothing', async () => {
  const db = await openTestDb();
  const { workoutId } = await specWorkout(db);
  const lastActivity = await age(db, workoutId, 61);
  assert.equal(await finishWorkout(db, workoutId), false);
  // Still ended at its last activity, so it stays out of the resume window.
  assert.deepEqual(await workoutRow(db, workoutId), { status: 'completed', finished_at: lastActivity });
});

test('Finish on an empty workout that already auto-ended does not save it', async () => {
  const db = await openTestDb();
  const day = await createDay(db, 'Push');
  const workout = await startWorkout(db, day);
  await age(db, workout, 61);
  assert.equal(await finishWorkout(db, workout), false);
  assert.equal(await workoutRow(db, workout), null);
});

test('Finish on an active workout finishes it', async () => {
  const db = await openTestDb();
  const { workoutId } = await specWorkout(db);
  assert.equal(await finishWorkout(db, workoutId), true);
  assert.equal((await workoutRow(db, workoutId))!.status, 'completed');
});

test('workout detail shows its change against the previous workout of the day', async () => {
  const db = await openTestDb();
  const { dayId, workoutId, benchVar } = await specWorkout(db);
  await finishWorkout(db, workoutId);
  const next = await startWorkout(db, dayId);
  await logSet(db, next, benchVar, 10, 186); // 1,860 → 1,860: no change
  await finishWorkout(db, next);
  const progress = (await getWorkoutDetail(db, next))!.progress!;
  assert.equal(progress.result.kind, 'change');
  assert.ok(progress.result.kind === 'change' && Math.abs(progress.result.percent) < 1e-9);
  assert.equal((await getWorkoutDetail(db, workoutId))!.progress!.result.kind, 'first');
});
