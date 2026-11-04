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
  listDays,
  removeSet,
  renameDay,
  renameExercise,
  reorderDays,
  reorderExercises,
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
