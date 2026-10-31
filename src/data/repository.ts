// The only module that reads or writes the database (SPEC.md 6). Screens call
// these functions and never write SQL themselves, so the data model stays
// independent of the storage engine.
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  computeProgress,
  workoutVolume,
  type VolumeSetInput,
  type WorkoutProgress,
} from '@/domain/progress';
import { localDateString, type Unit } from '@/lib/format';
import type { ThemeName } from '@/theme/palette';

export type IntensifierType = 'drop' | 'partial' | 'superset';

/** Thrown for a rule the user broke, such as a duplicate name; the message is shown on screen. */
export class ValidationError extends Error {}

const now = () => new Date().toISOString();
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------------------------------------------------------------------------
// Day baskets

export type DaySummary = {
  id: string;
  name: string;
  exerciseCount: number;
  lastWorkoutDate: string | null;
  /** Start time of the day's in-progress workout, or null when none is running. */
  inProgressSince: string | null;
  /** Latest change anywhere inside the day (ISO timestamp); used for ordering. */
  lastChangedAt: string;
};

/**
 * Days with a workout in progress come first; the rest follow with the most
 * recently changed day on top. "Changed" is the latest timestamp written
 * anywhere inside the day: the day itself (rename, drag into place), its
 * exercises (add, rename, reorder, swap), its workouts (start, finish, remove
 * a set) and every set (add, edit).
 */
export async function listDays(db: SQLiteDatabase): Promise<DaySummary[]> {
  return db.getAllAsync<DaySummary>(
    `SELECT d.id, d.name,
       MAX(
         d.updated_at,
         COALESCE(d.moved_at, ''),
         COALESCE((SELECT MAX(e.updated_at) FROM exercise e WHERE e.day_id = d.id), ''),
         COALESCE((SELECT MAX(w.updated_at) FROM workout w WHERE w.day_id = d.id), ''),
         COALESCE((SELECT MAX(s.updated_at) FROM workout_set s JOIN workout w ON w.id = s.workout_id
                   WHERE w.day_id = d.id), '')
       ) AS lastChangedAt,
       (SELECT COUNT(*) FROM exercise e WHERE e.day_id = d.id) AS exerciseCount,
       (SELECT w.date FROM workout w WHERE w.day_id = d.id AND w.status = 'completed'
          ORDER BY w.started_at DESC LIMIT 1) AS lastWorkoutDate,
       (SELECT w.started_at FROM workout w WHERE w.day_id = d.id AND w.status = 'in_progress'
          LIMIT 1) AS inProgressSince
     FROM day_basket d
     ORDER BY (inProgressSince IS NULL) ASC, lastChangedAt DESC, d.created_at ASC`,
  );
}

export async function getDayName(db: SQLiteDatabase, dayId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM day_basket WHERE id = ?', dayId);
  return row?.name ?? null;
}

async function assertUniqueDayName(db: SQLiteDatabase, name: string, exceptId: string | null) {
  const rows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM day_basket');
  if (rows.some((r) => r.id !== exceptId && sameName(r.name, name))) {
    throw new ValidationError(`You already have a day called '${name.trim()}'.`);
  }
}

export async function createDay(db: SQLiteDatabase, name: string): Promise<string> {
  await assertUniqueDayName(db, name, null);
  const id = randomUUID();
  const t = now();
  await db.runAsync(
    'INSERT INTO day_basket (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id, name.trim(), t, t,
  );
  return id;
}

/** Renaming changes only the name; the id stays, so all history stays linked. */
export async function renameDay(db: SQLiteDatabase, dayId: string, name: string): Promise<void> {
  await assertUniqueDayName(db, name, dayId);
  await db.runAsync('UPDATE day_basket SET name = ?, updated_at = ? WHERE id = ?', name.trim(), now(), dayId);
}

/**
 * Saves the order the user dragged the days into (ids top to bottom). Each day
 * gets a "moved" time just under now, in that order, which ranks above every
 * earlier change; a later change inside any day still lifts it to the top.
 */
export async function reorderDays(db: SQLiteDatabase, dayIds: string[]): Promise<void> {
  const base = Date.now();
  await db.withTransactionAsync(async () => {
    for (const [i, id] of dayIds.entries()) {
      await db.runAsync('UPDATE day_basket SET moved_at = ? WHERE id = ?', new Date(base - i).toISOString(), id);
    }
  });
}

export async function getDayDeletionCounts(
  db: SQLiteDatabase,
  dayId: string,
): Promise<{ exercises: number; workouts: number }> {
  const row = await db.getFirstAsync<{ exercises: number; workouts: number }>(
    `SELECT
       (SELECT COUNT(*) FROM exercise WHERE day_id = ?) AS exercises,
       (SELECT COUNT(*) FROM workout WHERE day_id = ? AND status = 'completed') AS workouts`,
    dayId, dayId,
  );
  return row ?? { exercises: 0, workouts: 0 };
}

/** Deletes the day and everything that belongs to it in one transaction. */
export async function deleteDay(db: SQLiteDatabase, dayId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const workoutIds = 'SELECT id FROM workout WHERE day_id = ?';
    await db.runAsync(`DELETE FROM intensifier WHERE workout_id IN (${workoutIds})`, dayId);
    await db.runAsync(`DELETE FROM workout_set WHERE workout_id IN (${workoutIds})`, dayId);
    await db.runAsync('DELETE FROM workout WHERE day_id = ?', dayId);
    await db.runAsync(
      'DELETE FROM variation WHERE exercise_id IN (SELECT id FROM exercise WHERE day_id = ?)',
      dayId,
    );
    await db.runAsync('DELETE FROM exercise WHERE day_id = ?', dayId);
    await db.runAsync('DELETE FROM day_basket WHERE id = ?', dayId);
  });
}

// ---------------------------------------------------------------------------
// Day detail and exercises

type WorkoutRow = {
  id: string;
  day_id: string;
  date: string;
  started_at: string;
  status: 'in_progress' | 'completed';
  selected_variations: string;
};

export type DayDetail = {
  id: string;
  name: string;
  lastWorkoutDate: string | null;
  workout: { id: string; startedAt: string; volume: number } | null;
  /** Volume (kg) of the last completed workout of this day. */
  lastWorkoutVolume: number | null;
  exercises: {
    id: string;
    name: string;
    variationName: string;
    /** Normal sets plus superset partner sets logged for this exercise in the current workout. */
    loggedSetCount: number;
  }[];
};

function parseSelected(json: string): Record<string, string> {
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

async function getInProgressWorkout(db: SQLiteDatabase, dayId: string): Promise<WorkoutRow | null> {
  return db.getFirstAsync<WorkoutRow>(
    "SELECT * FROM workout WHERE day_id = ? AND status = 'in_progress' LIMIT 1",
    dayId,
  );
}

export async function getDayDetail(db: SQLiteDatabase, dayId: string): Promise<DayDetail | null> {
  const day = await db.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM day_basket WHERE id = ?',
    dayId,
  );
  if (!day) return null;

  const last = await db.getFirstAsync<{ id: string; date: string }>(
    "SELECT id, date FROM workout WHERE day_id = ? AND status = 'completed' ORDER BY started_at DESC LIMIT 1",
    dayId,
  );
  const workout = await getInProgressWorkout(db, dayId);
  const selected = workout ? parseSelected(workout.selected_variations) : {};

  const exercises = await db.getAllAsync<{ id: string; name: string; default_variation_id: string }>(
    'SELECT id, name, default_variation_id FROM exercise WHERE day_id = ? ORDER BY position ASC',
    dayId,
  );
  const variations = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT v.id, v.name FROM variation v JOIN exercise e ON e.id = v.exercise_id WHERE e.day_id = ?`,
    dayId,
  );
  const variationName = new Map(variations.map((v) => [v.id, v.name]));

  const counts = new Map<string, number>();
  if (workout) {
    const rows = await db.getAllAsync<{ exerciseId: string; n: number }>(
      `SELECT v.exercise_id AS exerciseId, COUNT(*) AS n
       FROM workout_set s
       JOIN variation v ON v.id = s.variation_id
       LEFT JOIN intensifier i ON i.id = s.intensifier_id
       WHERE s.workout_id = ? AND (s.intensifier_id IS NULL OR i.type = 'superset')
       GROUP BY v.exercise_id`,
      workout.id,
    );
    rows.forEach((r) => counts.set(r.exerciseId, r.n));
  }

  return {
    id: day.id,
    name: day.name,
    lastWorkoutDate: last?.date ?? null,
    lastWorkoutVolume: last ? await computeWorkoutVolume(db, last.id) : null,
    workout: workout
      ? {
          id: workout.id,
          startedAt: workout.started_at,
          volume: await computeWorkoutVolume(db, workout.id),
        }
      : null,
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      variationName: variationName.get(selected[e.id] ?? e.default_variation_id) ?? e.name,
      loggedSetCount: counts.get(e.id) ?? 0,
    })),
  };
}

/** Creates an exercise together with its first variation, which has the same name. */
export async function addExercise(db: SQLiteDatabase, dayId: string, name: string): Promise<string> {
  const existing = await db.getAllAsync<{ name: string }>('SELECT name FROM exercise WHERE day_id = ?', dayId);
  if (existing.some((e) => sameName(e.name, name))) {
    throw new ValidationError(`This day already has an exercise called '${name.trim()}'.`);
  }
  const exerciseId = randomUUID();
  const variationId = randomUUID();
  const t = now();
  await db.withTransactionAsync(async () => {
    const pos = await db.getFirstAsync<{ p: number | null }>(
      'SELECT MAX(position) AS p FROM exercise WHERE day_id = ?',
      dayId,
    );
    await db.runAsync(
      `INSERT INTO exercise (id, day_id, name, position, default_variation_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      exerciseId, dayId, name.trim(), (pos?.p ?? 0) + 1, variationId, t, t,
    );
    await db.runAsync(
      'INSERT INTO variation (id, exercise_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      variationId, exerciseId, name.trim(), t, t,
    );
  });
  return exerciseId;
}

export async function getExerciseName(db: SQLiteDatabase, exerciseId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM exercise WHERE id = ?', exerciseId);
  return row?.name ?? null;
}

/**
 * Renames an exercise. Its variation with the old name (the one created with
 * it) is renamed too, so history and logging show the new name; other
 * variations keep theirs. The id stays, so all logged sets stay linked.
 */
export async function renameExercise(db: SQLiteDatabase, exerciseId: string, name: string): Promise<void> {
  const exercise = await db.getFirstAsync<{ day_id: string; name: string }>(
    'SELECT day_id, name FROM exercise WHERE id = ?',
    exerciseId,
  );
  if (!exercise) throw new Error('Exercise not found');
  const siblings = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM exercise WHERE day_id = ?', exercise.day_id);
  if (siblings.some((e) => e.id !== exerciseId && sameName(e.name, name))) {
    throw new ValidationError(`This day already has an exercise called '${name.trim()}'.`);
  }
  const variations = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM variation WHERE exercise_id = ?', exerciseId);
  const original = variations.find((v) => sameName(v.name, exercise.name));
  const clash = variations.some((v) => v.id !== original?.id && sameName(v.name, name));
  const t = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE exercise SET name = ?, updated_at = ? WHERE id = ?', name.trim(), t, exerciseId);
    if (original && !clash) {
      await db.runAsync('UPDATE variation SET name = ?, updated_at = ? WHERE id = ?', name.trim(), t, original.id);
    }
  });
}

/** Saves the order the user dragged a day's exercises into (ids top to bottom). */
export async function reorderExercises(db: SQLiteDatabase, exerciseIds: string[]): Promise<void> {
  const t = now();
  await db.withTransactionAsync(async () => {
    for (const [i, id] of exerciseIds.entries()) {
      await db.runAsync('UPDATE exercise SET position = ?, updated_at = ? WHERE id = ?', i + 1, t, id);
    }
  });
}

export async function getExerciseDeletionCounts(
  db: SQLiteDatabase,
  exerciseId: string,
): Promise<{ variations: number; loggedSets: number }> {
  const row = await db.getFirstAsync<{ variations: number; loggedSets: number }>(
    `SELECT
       (SELECT COUNT(*) FROM variation WHERE exercise_id = ?) AS variations,
       (SELECT COUNT(*) FROM workout_set s JOIN variation v ON v.id = s.variation_id
        WHERE v.exercise_id = ? AND s.intensifier_id IS NULL) AS loggedSets`,
    exerciseId, exerciseId,
  );
  return row ?? { variations: 0, loggedSets: 0 };
}

/**
 * Deletes an exercise, its variations and every set logged on it, including
 * intensifier rows attached to those sets and superset rows that paired with
 * it. Volumes of past workouts are computed on read, so the calendar updates.
 */
export async function deleteExercise(db: SQLiteDatabase, exerciseId: string): Promise<void> {
  // Removing an exercise counts as a change to its day (for the day order on Home).
  await db.runAsync(
    'UPDATE day_basket SET updated_at = ? WHERE id = (SELECT day_id FROM exercise WHERE id = ?)',
    now(), exerciseId,
  );
  const exerciseSets = `SELECT s.id FROM workout_set s JOIN variation v ON v.id = s.variation_id WHERE v.exercise_id = ?`;
  const doomedIntensifiers = `SELECT id FROM intensifier WHERE parent_set_id IN (${exerciseSets}) OR partner_exercise_id = ?`;
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM workout_set WHERE intensifier_id IN (${doomedIntensifiers})`, exerciseId, exerciseId);
    await db.runAsync(`DELETE FROM intensifier WHERE id IN (${doomedIntensifiers})`, exerciseId, exerciseId);
    await db.runAsync('DELETE FROM workout_set WHERE variation_id IN (SELECT id FROM variation WHERE exercise_id = ?)', exerciseId);
    await db.runAsync('DELETE FROM variation WHERE exercise_id = ?', exerciseId);
    await db.runAsync('DELETE FROM exercise WHERE id = ?', exerciseId);
  });
}

// ---------------------------------------------------------------------------
// Workouts

/** Starts a workout for today, or returns the day's existing in-progress workout. */
export async function startWorkout(db: SQLiteDatabase, dayId: string): Promise<string> {
  const existing = await getInProgressWorkout(db, dayId);
  if (existing) return existing.id;
  const id = randomUUID();
  const started = new Date();
  const t = started.toISOString();
  await db.runAsync(
    `INSERT INTO workout (id, day_id, date, started_at, finished_at, status, selected_variations, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, 'in_progress', '{}', ?, ?)`,
    id, dayId, localDateString(started), t, t, t,
  );
  return id;
}

export async function countWorkoutSets(db: SQLiteDatabase, workoutId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ?',
    workoutId,
  );
  return row?.n ?? 0;
}

type VolumeRow = {
  workout_id: string;
  reps: number | null;
  weight: number | null;
  itype: IntensifierType | null;
  parent_weight: number | null;
};

const VOLUME_QUERY = `
  SELECT s.workout_id, s.reps, s.weight, i.type AS itype, p.weight AS parent_weight
  FROM workout_set s
  LEFT JOIN intensifier i ON i.id = s.intensifier_id
  LEFT JOIN workout_set p ON p.id = i.parent_set_id`;

function toVolumeInput(r: VolumeRow): VolumeSetInput {
  return { reps: r.reps, weight: r.weight, isPartial: r.itype === 'partial', parentWeight: r.parent_weight };
}

export async function computeWorkoutVolume(db: SQLiteDatabase, workoutId: string): Promise<number> {
  const rows = await db.getAllAsync<VolumeRow>(`${VOLUME_QUERY} WHERE s.workout_id = ?`, workoutId);
  return workoutVolume(rows.map(toVolumeInput));
}

/** Volume is not stored: every screen computes it from the sets, so it always matches them. */
export async function finishWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  const t = now();
  await db.runAsync(
    "UPDATE workout SET status = 'completed', finished_at = ?, updated_at = ? WHERE id = ?",
    t, t, workoutId,
  );
}

// ---------------------------------------------------------------------------
// Exercise logging

type SetRow = {
  id: string;
  workout_id: string;
  variation_id: string;
  intensifier_id: string | null;
  position: number;
  reps: number | null;
  weight: number | null;
};

export type IntensifierRow = {
  intensifierId: string;
  type: IntensifierType;
  childSetId: string;
  reps: number | null;
  weight: number | null;
  /** For superset rows: "Triceps pushdown" or "Triceps pushdown (Rope pushdown)". */
  partnerLabel: string | null;
};

export type NormalSetRow = {
  setId: string;
  number: number;
  reps: number | null;
  weight: number | null;
  intensifiers: IntensifierRow[];
};

export type PartnerSetRow = {
  setId: string;
  label: string;
  reps: number | null;
  weight: number | null;
};

export type LoggingData = {
  exerciseName: string;
  dayId: string;
  workoutStatus: 'in_progress' | 'completed';
  selectedVariationId: string;
  selectedVariationName: string;
  lastTime: { date: string; sets: { reps: number | null; weight: number | null }[] } | null;
  alsoLogged: { variationId: string; name: string; count: number }[];
  sets: NormalSetRow[];
  partnerSets: PartnerSetRow[];
};

function variationLabel(exerciseName: string, variationName: string) {
  return sameName(exerciseName, variationName) ? exerciseName : `${exerciseName} (${variationName})`;
}

async function selectedVariationFor(
  db: SQLiteDatabase,
  workoutId: string,
  exerciseId: string,
): Promise<string> {
  const w = await db.getFirstAsync<{ selected_variations: string }>(
    'SELECT selected_variations FROM workout WHERE id = ?',
    workoutId,
  );
  const selected = w ? parseSelected(w.selected_variations) : {};
  if (selected[exerciseId]) return selected[exerciseId];
  const e = await db.getFirstAsync<{ default_variation_id: string }>(
    'SELECT default_variation_id FROM exercise WHERE id = ?',
    exerciseId,
  );
  if (!e) throw new Error('Exercise not found');
  return e.default_variation_id;
}

async function normalSets(db: SQLiteDatabase, workoutId: string, variationId: string): Promise<SetRow[]> {
  return db.getAllAsync<SetRow>(
    `SELECT * FROM workout_set
     WHERE workout_id = ? AND variation_id = ? AND intensifier_id IS NULL
     ORDER BY position ASC`,
    workoutId, variationId,
  );
}

/** Normal sets of one variation in one workout, numbered, each with its intensifier rows. */
async function setsWithIntensifiers(db: SQLiteDatabase, workoutId: string, variationId: string): Promise<NormalSetRow[]> {
  const sets = await normalSets(db, workoutId, variationId);
  const intensifiers = await db.getAllAsync<{
    id: string;
    type: IntensifierType;
    parent_set_id: string;
    child_id: string;
    reps: number | null;
    weight: number | null;
    partner_exercise: string | null;
    partner_variation: string | null;
  }>(
    `SELECT i.id, i.type, i.parent_set_id, c.id AS child_id, c.reps, c.weight,
            pe.name AS partner_exercise, pv.name AS partner_variation
     FROM intensifier i
     JOIN workout_set p ON p.id = i.parent_set_id
     JOIN workout_set c ON c.intensifier_id = i.id
     LEFT JOIN exercise pe ON pe.id = i.partner_exercise_id
     LEFT JOIN variation pv ON pv.id = c.variation_id
     WHERE p.workout_id = ? AND p.variation_id = ?
     ORDER BY i.position ASC`,
    workoutId, variationId,
  );
  return sets.map((s, index) => ({
    setId: s.id,
    number: index + 1,
    reps: s.reps,
    weight: s.weight,
    intensifiers: intensifiers
      .filter((i) => i.parent_set_id === s.id)
      .map((i) => ({
        intensifierId: i.id,
        type: i.type,
        childSetId: i.child_id,
        reps: i.reps,
        weight: i.weight,
        partnerLabel:
          i.type === 'superset' && i.partner_exercise
            ? variationLabel(i.partner_exercise, i.partner_variation ?? i.partner_exercise)
            : null,
      })),
  }));
}

export async function getLoggingData(
  db: SQLiteDatabase,
  workoutId: string,
  exerciseId: string,
): Promise<LoggingData | null> {
  const exercise = await db.getFirstAsync<{ name: string; day_id: string }>(
    'SELECT name, day_id FROM exercise WHERE id = ?',
    exerciseId,
  );
  const workout = await db.getFirstAsync<{ status: 'in_progress' | 'completed' }>(
    'SELECT status FROM workout WHERE id = ?',
    workoutId,
  );
  if (!exercise || !workout) return null;

  const selectedId = await selectedVariationFor(db, workoutId, exerciseId);
  const selectedVar = await db.getFirstAsync<{ name: string }>('SELECT name FROM variation WHERE id = ?', selectedId);

  const sets = await setsWithIntensifiers(db, workoutId, selectedId);

  // Superset partner sets started from another exercise that landed on this one.
  const partners = await db.getAllAsync<{
    id: string;
    reps: number | null;
    weight: number | null;
    parent_set_id: string;
    parent_variation_id: string;
    parent_exercise: string;
  }>(
    `SELECT c.id, c.reps, c.weight, i.parent_set_id, p.variation_id AS parent_variation_id,
            pe.name AS parent_exercise
     FROM workout_set c
     JOIN intensifier i ON i.id = c.intensifier_id
     JOIN variation cv ON cv.id = c.variation_id
     JOIN workout_set p ON p.id = i.parent_set_id
     JOIN variation pvar ON pvar.id = p.variation_id
     JOIN exercise pe ON pe.id = pvar.exercise_id
     WHERE c.workout_id = ? AND i.type = 'superset' AND cv.exercise_id = ?
     ORDER BY c.created_at ASC`,
    workoutId, exerciseId,
  );
  const partnerSets: PartnerSetRow[] = [];
  for (const p of partners) {
    const siblings = await normalSets(db, workoutId, p.parent_variation_id);
    const number = siblings.findIndex((s) => s.id === p.parent_set_id) + 1;
    partnerSets.push({
      setId: p.id,
      label: `Superset with ${p.parent_exercise}, Set ${number}`,
      reps: p.reps,
      weight: p.weight,
    });
  }

  // "Last time": the most recent completed workout with normal sets on this variation.
  const lastWorkout = await db.getFirstAsync<{ id: string; date: string }>(
    `SELECT w.id, w.date FROM workout w
     WHERE w.status = 'completed' AND w.id != ? AND EXISTS (
       SELECT 1 FROM workout_set s
       WHERE s.workout_id = w.id AND s.variation_id = ? AND s.intensifier_id IS NULL)
     ORDER BY w.started_at DESC LIMIT 1`,
    workoutId, selectedId,
  );
  const lastTime = lastWorkout
    ? {
        date: lastWorkout.date,
        sets: (await normalSets(db, lastWorkout.id, selectedId)).map((s) => ({ reps: s.reps, weight: s.weight })),
      }
    : null;

  const alsoLogged = await db.getAllAsync<{ variationId: string; name: string; count: number }>(
    `SELECT v.id AS variationId, v.name, COUNT(*) AS count
     FROM workout_set s JOIN variation v ON v.id = s.variation_id
     WHERE s.workout_id = ? AND v.exercise_id = ? AND v.id != ? AND s.intensifier_id IS NULL
     GROUP BY v.id
     ORDER BY MIN(s.created_at) ASC`,
    workoutId, exerciseId, selectedId,
  );

  return {
    exerciseName: exercise.name,
    dayId: exercise.day_id,
    workoutStatus: workout.status,
    selectedVariationId: selectedId,
    selectedVariationName: selectedVar?.name ?? exercise.name,
    lastTime,
    alsoLogged,
    sets,
    partnerSets,
  };
}

export type HistoryData = {
  exerciseName: string;
  selectedVariationId: string;
  variations: { id: string; name: string }[];
  /** Most recent first. */
  workouts: { workoutId: string; date: string; volume: number; sets: NormalSetRow[] }[];
};

const HISTORY_LIMIT = 5;

/**
 * Read-only history of one exercise: the last few completed workouts that
 * logged sets on the chosen variation (default: the exercise's current
 * variation). Opening it never starts a workout or changes any data.
 */
export async function getExerciseHistory(
  db: SQLiteDatabase,
  exerciseId: string,
  variationId: string | null,
): Promise<HistoryData | null> {
  const exercise = await db.getFirstAsync<{ name: string; default_variation_id: string }>(
    'SELECT name, default_variation_id FROM exercise WHERE id = ?',
    exerciseId,
  );
  if (!exercise) return null;
  const variations = await db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM variation WHERE exercise_id = ? ORDER BY created_at ASC',
    exerciseId,
  );
  const selectedId =
    variationId && variations.some((v) => v.id === variationId) ? variationId : exercise.default_variation_id;

  const recent = await db.getAllAsync<{ id: string; date: string }>(
    `SELECT w.id, w.date FROM workout w
     WHERE w.status = 'completed' AND EXISTS (
       SELECT 1 FROM workout_set s
       WHERE s.workout_id = w.id AND s.variation_id = ? AND s.intensifier_id IS NULL)
     ORDER BY w.started_at DESC LIMIT ${HISTORY_LIMIT}`,
    selectedId,
  );
  const workouts = [];
  for (const w of recent) {
    const sets = await setsWithIntensifiers(db, w.id, selectedId);
    // Volume of this variation only, by the same rules as a whole workout (SPEC.md 5.7).
    // Superset rows belong to the partner exercise, so they are left out here.
    const volume = workoutVolume(
      sets.flatMap((s) => [
        { reps: s.reps, weight: s.weight, isPartial: false, parentWeight: null },
        ...s.intensifiers.filter((i) => i.type !== 'superset').map((i) => ({
          reps: i.reps,
          weight: i.weight,
          isPartial: i.type === 'partial',
          parentWeight: s.weight,
        })),
      ]),
    );
    workouts.push({ workoutId: w.id, date: w.date, volume, sets });
  }
  return { exerciseName: exercise.name, selectedVariationId: selectedId, variations, workouts };
}

/** Appends an empty normal set for a variation in a workout. */
export async function addSet(db: SQLiteDatabase, workoutId: string, variationId: string): Promise<string> {
  const id = randomUUID();
  const t = now();
  const pos = await db.getFirstAsync<{ p: number | null }>(
    `SELECT MAX(position) AS p FROM workout_set
     WHERE workout_id = ? AND variation_id = ? AND intensifier_id IS NULL`,
    workoutId, variationId,
  );
  await db.runAsync(
    `INSERT INTO workout_set (id, workout_id, variation_id, intensifier_id, position, reps, weight, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, ?)`,
    id, workoutId, variationId, (pos?.p ?? 0) + 1, t, t,
  );
  return id;
}

export async function updateSetField(
  db: SQLiteDatabase,
  setId: string,
  field: 'reps' | 'weight',
  value: number | null,
): Promise<void> {
  // The column name comes from a fixed allowlist, never from user input.
  const column = field === 'reps' ? 'reps' : 'weight';
  await db.runAsync(`UPDATE workout_set SET ${column} = ?, updated_at = ? WHERE id = ?`, value, now(), setId);
}

export async function countIntensifiers(db: SQLiteDatabase, setId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM intensifier WHERE parent_set_id = ?',
    setId,
  );
  return row?.n ?? 0;
}

/** Removes a normal set together with its intensifiers and their rows. */
export async function removeSet(db: SQLiteDatabase, setId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Stamp the workout so the day counts as changed once the set is gone.
    await db.runAsync(
      'UPDATE workout SET updated_at = ? WHERE id = (SELECT workout_id FROM workout_set WHERE id = ?)',
      now(), setId,
    );
    await db.runAsync(
      'DELETE FROM workout_set WHERE intensifier_id IN (SELECT id FROM intensifier WHERE parent_set_id = ?)',
      setId,
    );
    await db.runAsync('DELETE FROM intensifier WHERE parent_set_id = ?', setId);
    await db.runAsync('DELETE FROM workout_set WHERE id = ?', setId);
  });
}

export async function removeIntensifier(db: SQLiteDatabase, intensifierId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE workout SET updated_at = ? WHERE id = (SELECT workout_id FROM intensifier WHERE id = ?)',
      now(), intensifierId,
    );
    await db.runAsync('DELETE FROM workout_set WHERE intensifier_id = ?', intensifierId);
    await db.runAsync('DELETE FROM intensifier WHERE id = ?', intensifierId);
  });
}

// ---------------------------------------------------------------------------
// Intensifier picker

export type IntensifierPickerData = {
  setLabel: string;
  hasSuperset: boolean;
  dayId: string;
  partners: { exerciseId: string; name: string; variationName: string }[];
};

export async function getIntensifierPickerData(
  db: SQLiteDatabase,
  workoutId: string,
  setId: string,
): Promise<IntensifierPickerData | null> {
  const parent = await db.getFirstAsync<SetRow & { exercise_id: string; day_id: string }>(
    `SELECT s.*, v.exercise_id, e.day_id FROM workout_set s
     JOIN variation v ON v.id = s.variation_id
     JOIN exercise e ON e.id = v.exercise_id
     WHERE s.id = ?`,
    setId,
  );
  if (!parent) return null;
  const siblings = await normalSets(db, workoutId, parent.variation_id);
  const number = siblings.findIndex((s) => s.id === setId) + 1;
  const superset = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM intensifier WHERE parent_set_id = ? AND type = 'superset'",
    setId,
  );
  const others = await db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM exercise WHERE day_id = ? AND id != ? ORDER BY position ASC',
    parent.day_id, parent.exercise_id,
  );
  const partners = [];
  for (const o of others) {
    const vid = await selectedVariationFor(db, workoutId, o.id);
    const v = await db.getFirstAsync<{ name: string }>('SELECT name FROM variation WHERE id = ?', vid);
    partners.push({ exerciseId: o.id, name: o.name, variationName: v?.name ?? o.name });
  }
  return { setLabel: `Set ${number}`, hasSuperset: superset !== null, dayId: parent.day_id, partners };
}

/**
 * Attaches a drop set, partial reps or superset to a normal set. Each
 * intensifier owns exactly one child set holding the row's values.
 * Returns the child set's id.
 */
export async function addIntensifier(
  db: SQLiteDatabase,
  parentSetId: string,
  type: IntensifierType,
  partnerExerciseId: string | null = null,
): Promise<string> {
  const parent = await db.getFirstAsync<SetRow>('SELECT * FROM workout_set WHERE id = ?', parentSetId);
  if (!parent) throw new Error('Set not found');
  if (parent.intensifier_id !== null) throw new ValidationError('Intensifiers attach only to normal sets.');

  let childVariationId = parent.variation_id;
  if (type === 'superset') {
    if (!partnerExerciseId) throw new Error('A superset needs a partner exercise');
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM intensifier WHERE parent_set_id = ? AND type = 'superset'",
      parentSetId,
    );
    if (existing) throw new ValidationError('This set already has a superset');
    childVariationId = await selectedVariationFor(db, parent.workout_id, partnerExerciseId);
  }

  const intensifierId = randomUUID();
  const childId = randomUUID();
  const t = now();
  await db.withTransactionAsync(async () => {
    const pos = await db.getFirstAsync<{ p: number | null }>(
      'SELECT MAX(position) AS p FROM intensifier WHERE parent_set_id = ?',
      parentSetId,
    );
    await db.runAsync(
      `INSERT INTO intensifier (id, workout_id, type, parent_set_id, partner_exercise_id, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      intensifierId, parent.workout_id, type, parentSetId,
      type === 'superset' ? partnerExerciseId : null, (pos?.p ?? 0) + 1, t, t,
    );
    await db.runAsync(
      `INSERT INTO workout_set (id, workout_id, variation_id, intensifier_id, position, reps, weight, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NULL, NULL, ?, ?)`,
      childId, parent.workout_id, childVariationId, intensifierId, t, t,
    );
  });
  return childId;
}

// ---------------------------------------------------------------------------
// Variations

export type SwapData = {
  exerciseName: string;
  selectedVariationId: string;
  variations: { id: string; name: string; lastDone: string | null }[];
};

export async function getSwapData(
  db: SQLiteDatabase,
  workoutId: string,
  exerciseId: string,
): Promise<SwapData | null> {
  const exercise = await db.getFirstAsync<{ name: string }>('SELECT name FROM exercise WHERE id = ?', exerciseId);
  if (!exercise) return null;
  const selectedVariationId = await selectedVariationFor(db, workoutId, exerciseId);
  const variations = await db.getAllAsync<{ id: string; name: string; lastDone: string | null }>(
    `SELECT v.id, v.name,
       (SELECT MAX(w.date) FROM workout w JOIN workout_set s ON s.workout_id = w.id
        WHERE w.status = 'completed' AND s.variation_id = v.id) AS lastDone
     FROM variation v WHERE v.exercise_id = ?
     ORDER BY v.created_at ASC`,
    exerciseId,
  );
  return { exerciseName: exercise.name, selectedVariationId, variations };
}

/**
 * Selects another variation for this exercise. No set is moved: logged sets
 * keep the variation they were done on, which is what keeps every variation's
 * progression intact.
 */
export async function swapVariation(
  db: SQLiteDatabase,
  workoutId: string,
  exerciseId: string,
  variationId: string,
): Promise<void> {
  const w = await db.getFirstAsync<{ selected_variations: string }>(
    'SELECT selected_variations FROM workout WHERE id = ?',
    workoutId,
  );
  const selected = w ? parseSelected(w.selected_variations) : {};
  selected[exerciseId] = variationId;
  const t = now();
  await db.runAsync(
    'UPDATE workout SET selected_variations = ?, updated_at = ? WHERE id = ?',
    JSON.stringify(selected), t, workoutId,
  );
  // The next workout opens on the most recently used variation.
  await db.runAsync('UPDATE exercise SET default_variation_id = ?, updated_at = ? WHERE id = ?', variationId, t, exerciseId);
}

export async function createVariationAndSwap(
  db: SQLiteDatabase,
  workoutId: string,
  exerciseId: string,
  name: string,
): Promise<string> {
  const existing = await db.getAllAsync<{ name: string }>('SELECT name FROM variation WHERE exercise_id = ?', exerciseId);
  if (existing.some((v) => sameName(v.name, name))) throw new ValidationError('This variation already exists.');
  const id = randomUUID();
  const t = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO variation (id, exercise_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      id, exerciseId, name.trim(), t, t,
    );
    await swapVariation(db, workoutId, exerciseId, id);
  });
  return id;
}

// ---------------------------------------------------------------------------
// Calendar

export type CalendarWorkout = {
  id: string;
  dayName: string;
  date: string;
  startedAt: string;
  volume: number;
  progress: WorkoutProgress;
};

/**
 * Loads every completed workout with its volume, change and shade. Changes
 * are computed on read so they always match the data that currently exists.
 */
export async function getCalendarWorkouts(db: SQLiteDatabase): Promise<CalendarWorkout[]> {
  const workouts = await db.getAllAsync<{ id: string; day_id: string; day_name: string; date: string; started_at: string }>(
    `SELECT w.id, w.day_id, d.name AS day_name, w.date, w.started_at
     FROM workout w JOIN day_basket d ON d.id = w.day_id
     WHERE w.status = 'completed'`,
  );
  const sets = await db.getAllAsync<VolumeRow>(
    `${VOLUME_QUERY} JOIN workout w ON w.id = s.workout_id WHERE w.status = 'completed'`,
  );
  const setsByWorkout = new Map<string, VolumeSetInput[]>();
  for (const r of sets) {
    const list = setsByWorkout.get(r.workout_id) ?? [];
    list.push(toVolumeInput(r));
    setsByWorkout.set(r.workout_id, list);
  }
  const withVolume = workouts.map((w) => ({
    id: w.id,
    dayId: w.day_id,
    dayName: w.day_name,
    date: w.date,
    startedAt: w.started_at,
    volume: workoutVolume(setsByWorkout.get(w.id) ?? []),
  }));
  const progress = computeProgress(withVolume);
  return withVolume.map((w) => ({
    id: w.id,
    dayName: w.dayName,
    date: w.date,
    startedAt: w.startedAt,
    volume: w.volume,
    progress: progress.get(w.id)!,
  }));
}

// ---------------------------------------------------------------------------
// Settings

export type DataSummary = { days: number; exercises: number; workouts: number; sets: number };

/** What is stored on the phone, for the More screen. */
export async function getDataSummary(db: SQLiteDatabase): Promise<DataSummary> {
  const row = await db.getFirstAsync<DataSummary>(
    `SELECT
       (SELECT COUNT(*) FROM day_basket) AS days,
       (SELECT COUNT(*) FROM exercise) AS exercises,
       (SELECT COUNT(*) FROM workout WHERE status = 'completed') AS workouts,
       (SELECT COUNT(*) FROM workout_set s JOIN workout w ON w.id = s.workout_id WHERE w.status = 'completed') AS sets`,
  );
  return row ?? { days: 0, exercises: 0, workouts: 0, sets: 0 };
}

export type StoredSettings = { theme: ThemeName | null; unit: Unit | null };

export async function getSettings(db: SQLiteDatabase): Promise<StoredSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const theme = map.get('theme');
  const unit = map.get('unit');
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : null,
    unit: unit === 'kg' || unit === 'lb' ? unit : null,
  };
}

export async function saveSetting(db: SQLiteDatabase, key: 'theme' | 'unit', value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}
