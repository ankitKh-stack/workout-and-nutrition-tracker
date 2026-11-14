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
import { entryNumbers, MEALS, sumNumbers, type AmountUnit, type Meal, type Numbers } from '@/domain/nutrition';
import { MAX_REST_SECONDS, MIN_REST_SECONDS } from '@/domain/restTimer';
import { localDateString, toDisplayWeight, type Unit } from '@/lib/format';
import type { ThemeName } from '@/theme/palette';

export type IntensifierType = 'drop' | 'partial' | 'superset';

/** Thrown for a rule the user broke, such as a duplicate name; the message is shown on screen. */
export class ValidationError extends Error {}

const now = () => new Date().toISOString();
/** A set row counts as logged once something is typed in; the empty row opening an exercise adds does not. */
const LOGGED = '(s.reps IS NOT NULL OR s.weight IS NOT NULL)';
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
  await endInactiveWorkouts(db);
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

/**
 * Deletes the day and everything that belongs to it: its exercises, variations,
 * workouts, sets and intensifiers go with it through ON DELETE CASCADE.
 */
export async function deleteDay(db: SQLiteDatabase, dayId: string): Promise<void> {
  await db.runAsync('DELETE FROM day_basket WHERE id = ?', dayId);
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
  /** The last workout, when it was finished within RESUME_MINUTES and nothing is in progress. */
  resumable: { id: string; finishedAt: string } | null;
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
  await endInactiveWorkouts(db);
  const day = await db.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM day_basket WHERE id = ?',
    dayId,
  );
  if (!day) return null;

  const last = await db.getFirstAsync<{ id: string; date: string; finished_at: string }>(
    "SELECT id, date, finished_at FROM workout WHERE day_id = ? AND status = 'completed' ORDER BY started_at DESC LIMIT 1",
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
       WHERE s.workout_id = ? AND (s.intensifier_id IS NULL OR i.type = 'superset') AND ${LOGGED}
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
    resumable: !workout && last && canResume(last.finished_at) ? { id: last.id, finishedAt: last.finished_at } : null,
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
  // The rest goes through ON DELETE CASCADE: variations, their sets, those sets'
  // intensifier rows, and superset rows that paired with this exercise.
  await db.runAsync('DELETE FROM exercise WHERE id = ?', exerciseId);
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

/** Logged sets only (see LOGGED), the same rule auto-end uses. */
export async function countWorkoutSets(db: SQLiteDatabase, workoutId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workout_set s WHERE s.workout_id = ? AND ${LOGGED}`,
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

// TODO(ankit): check this note, moved here from finishWorkout in the audit (finding 7).
/** Volume is not stored: every screen computes it from the sets, so it always matches them. */
export async function computeWorkoutVolume(db: SQLiteDatabase, workoutId: string): Promise<number> {
  const rows = await db.getAllAsync<VolumeRow>(`${VOLUME_QUERY} WHERE s.workout_id = ? AND s.is_warmup = 0`, workoutId);
  return workoutVolume(rows.map(toVolumeInput));
}

/**
 * Finishes a workout in progress. Returns false, and changes nothing, when it
 * is no longer in progress: for example a screen left open in the background
 * past the auto-end hour, where the workout has already been ended at its last
 * activity (or discarded) by endInactiveWorkouts.
 */
export async function finishWorkout(db: SQLiteDatabase, workoutId: string): Promise<boolean> {
  await endInactiveWorkouts(db);
  const t = now();
  const result = await db.runAsync(
    "UPDATE workout SET status = 'completed', finished_at = ?, updated_at = ? WHERE id = ? AND status = 'in_progress'",
    t, t, workoutId,
  );
  return result.changes > 0;
}

/** A finished workout can be resumed for this long after it ended. */
export const RESUME_MINUTES = 30;
/** An in-progress workout with no activity for this long is ended automatically. */
export const AUTO_END_MINUTES = 60;

const minutesSince = (iso: string) => (Date.now() - Date.parse(iso)) / 60000;
const canResume = (finishedAt: string | null) => finishedAt !== null && minutesSince(finishedAt) <= RESUME_MINUTES;

/** Puts a recently finished workout back in progress, as if Finish had not been tapped. */
export async function resumeWorkout(db: SQLiteDatabase, workoutId: string): Promise<void> {
  const w = await db.getFirstAsync<{ day_id: string; status: string; finished_at: string | null }>(
    'SELECT day_id, status, finished_at FROM workout WHERE id = ?',
    workoutId,
  );
  if (!w || w.status !== 'completed') throw new ValidationError('This workout cannot be resumed.');
  if (!canResume(w.finished_at)) {
    throw new ValidationError(`This workout ended more than ${RESUME_MINUTES} minutes ago, so it can no longer be resumed.`);
  }
  if (await getInProgressWorkout(db, w.day_id)) throw new ValidationError('This day already has a workout in progress.');
  // Resuming counts as activity, so the auto-end clock starts again from now.
  await db.runAsync(
    "UPDATE workout SET status = 'in_progress', finished_at = NULL, updated_at = ? WHERE id = ?",
    now(), workoutId,
  );
}

/**
 * Ends every in-progress workout with no activity (a set added or edited,
 * a variation swapped) for over AUTO_END_MINUTES. It is saved as finished at
 * its last activity; one with nothing typed into any set is discarded. Run at
 * the start of each read that shows workout state, since nothing runs in the
 * background while the app is closed.
 */
export async function endInactiveWorkouts(db: SQLiteDatabase): Promise<void> {
  const open = await db.getAllAsync<{ id: string; lastActivity: string; logged: number }>(
    `SELECT w.id,
       MAX(w.updated_at, COALESCE((SELECT MAX(s.updated_at) FROM workout_set s WHERE s.workout_id = w.id), '')) AS lastActivity,
       EXISTS (SELECT 1 FROM workout_set s WHERE s.workout_id = w.id AND ${LOGGED}) AS logged
     FROM workout w WHERE w.status = 'in_progress'`,
  );
  for (const w of open) {
    if (minutesSince(w.lastActivity) <= AUTO_END_MINUTES) continue;
    // Single statements guarded on status, so two reads running this at the
    // same time cannot end or discard the same workout twice.
    if (w.logged) {
      await db.runAsync(
        "UPDATE workout SET status = 'completed', finished_at = ? WHERE id = ? AND status = 'in_progress'",
        w.lastActivity, w.id,
      );
    } else {
      // Its sets and intensifiers go with it through the ON DELETE CASCADE foreign keys.
      await db.runAsync("DELETE FROM workout WHERE id = ? AND status = 'in_progress'", w.id);
    }
  }
}

export type WorkoutDetail = {
  id: string;
  dayId: string;
  dayName: string;
  date: string;
  startedAt: string;
  finishedAt: string | null;
  volume: number;
  /** Change and shade against the previous workout of the day; null while in progress. */
  progress: WorkoutProgress | null;
  /** Each variation with normal sets in this workout, in the day's exercise order. */
  exercises: { variationId: string; label: string; sets: NormalSetRow[] }[];
};

/** One workout with every set logged in it, for the History tab. */
export async function getWorkoutDetail(db: SQLiteDatabase, workoutId: string): Promise<WorkoutDetail | null> {
  await endInactiveWorkouts(db);
  const w = await db.getFirstAsync<{ id: string; day_id: string; day_name: string; date: string; started_at: string; finished_at: string | null }>(
    `SELECT w.id, w.day_id, d.name AS day_name, w.date, w.started_at, w.finished_at
     FROM workout w JOIN day_basket d ON d.id = w.day_id WHERE w.id = ?`,
    workoutId,
  );
  if (!w) return null;
  const variations = await variationsIn(db, workoutId);
  const exercises = [];
  for (const v of variations) {
    exercises.push({ variationId: v.id, label: variationLabel(v.exercise, v.variation), sets: await setsWithIntensifiers(db, workoutId, v.id) });
  }
  return {
    id: w.id,
    dayId: w.day_id,
    dayName: w.day_name,
    date: w.date,
    startedAt: w.started_at,
    finishedAt: w.finished_at,
    volume: await computeWorkoutVolume(db, workoutId),
    progress: (await completedWorkouts(db, w.day_id)).find((c) => c.id === workoutId)?.progress ?? null,
    exercises,
  };
}

/** Each variation with normal sets in a workout, in the day's exercise order. */
function variationsIn(db: SQLiteDatabase, workoutId: string) {
  return db.getAllAsync<{ id: string; exercise: string; variation: string }>(
    `SELECT v.id, e.name AS exercise, v.name AS variation
     FROM variation v JOIN exercise e ON e.id = v.exercise_id
     WHERE EXISTS (SELECT 1 FROM workout_set s WHERE s.workout_id = ? AND s.variation_id = v.id AND s.intensifier_id IS NULL)
     ORDER BY e.position ASC, v.created_at ASC`,
    workoutId,
  );
}

/** "Last time": the most recent completed workout, other than this one, with normal sets on the variation. */
function lastWorkoutWith(db: SQLiteDatabase, variationId: string, excludeWorkoutId: string) {
  return db.getFirstAsync<{ id: string; date: string }>(
    `SELECT w.id, w.date FROM workout w
     WHERE w.status = 'completed' AND w.id != ? AND EXISTS (
       SELECT 1 FROM workout_set s
       WHERE s.workout_id = w.id AND s.variation_id = ? AND s.intensifier_id IS NULL)
     ORDER BY w.started_at DESC LIMIT 1`,
    excludeWorkoutId, variationId,
  );
}

export type SetPR = { label: string; setNumber: number; reps: number; weight: number; lastReps: number; lastWeight: number };

/**
 * Personal records (SPEC.md 3.3): normal sets whose reps × weight beat the
 * same set number on the same variation last time. Ties and sets with
 * nothing to compare with are not records.
 */
export async function getWorkoutPRs(db: SQLiteDatabase, workoutId: string): Promise<SetPR[]> {
  const prs: SetPR[] = [];
  for (const v of await variationsIn(db, workoutId)) {
    const last = await lastWorkoutWith(db, v.id, workoutId);
    if (!last) continue;
    const before = await workingSets(db, last.id, v.id);
    (await workingSets(db, workoutId, v.id)).forEach((s, i) => {
      const b = before[i];
      if (!b || s.reps === null || s.weight === null || b.reps === null || b.weight === null) return;
      if (s.reps * s.weight > b.reps * b.weight) {
        prs.push({
          label: variationLabel(v.exercise, v.variation),
          setNumber: i + 1,
          reps: s.reps,
          weight: s.weight,
          lastReps: b.reps,
          lastWeight: b.weight,
        });
      }
    });
  }
  return prs;
}

// ---------------------------------------------------------------------------
// Exercise logging

type SetRow = {
  id: string;
  workout_id: string;
  variation_id: string;
  intensifier_id: string | null;
  position: number;
  is_warmup: number;
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
  /** Warm-ups come first and are numbered on their own (W1, W2…), then working sets (Set 1, Set 2…). */
  warmup: boolean;
  number: number;
  reps: number | null;
  weight: number | null;
  intensifiers: IntensifierRow[];
};

export type PartnerSetRow = {
  setId: string;
  label: string;
  /** The number of the set it was paired with, e.g. 2 for "Set 2". */
  setNumber: number;
  reps: number | null;
  weight: number | null;
};

export type LoggingData = {
  exerciseName: string;
  dayId: string;
  workoutStatus: 'in_progress' | 'completed';
  selectedVariationId: string;
  selectedVariationName: string;
  /** The selected variation's note, or null when it has none. */
  selectedVariationNote: string | null;
  lastTime: { date: string; sets: { reps: number | null; weight: number | null; warmup: boolean; number: number }[] } | null;
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
     ORDER BY is_warmup DESC, position ASC`,
    workoutId, variationId,
  );
}

/** Normal sets without warm-ups: what set numbers in labels, supersets and records refer to. */
async function workingSets(db: SQLiteDatabase, workoutId: string, variationId: string): Promise<SetRow[]> {
  return (await normalSets(db, workoutId, variationId)).filter((s) => !s.is_warmup);
}

/** Each set with its number within its group: warm-ups 1.., then working sets 1... */
function numbered(sets: SetRow[]) {
  let warmups = 0;
  let working = 0;
  return sets.map((s) => ({ set: s, warmup: !!s.is_warmup, number: s.is_warmup ? ++warmups : ++working }));
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
  return numbered(sets).map(({ set: s, warmup, number }) => ({
    setId: s.id,
    warmup,
    number,
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
  await endInactiveWorkouts(db);
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
  const selectedVar = await db.getFirstAsync<{ name: string; note: string | null }>(
    'SELECT name, note FROM variation WHERE id = ?',
    selectedId,
  );

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
    const siblings = await workingSets(db, workoutId, p.parent_variation_id);
    const number = siblings.findIndex((s) => s.id === p.parent_set_id) + 1;
    partnerSets.push({
      setId: p.id,
      label: `Superset with ${p.parent_exercise}, Set ${number}`,
      setNumber: number,
      reps: p.reps,
      weight: p.weight,
    });
  }

  const lastWorkout = await lastWorkoutWith(db, selectedId, workoutId);
  const lastTime = lastWorkout
    ? {
        date: lastWorkout.date,
        sets: numbered(await normalSets(db, lastWorkout.id, selectedId)).map(({ set, warmup, number }) => ({
          reps: set.reps,
          weight: set.weight,
          warmup,
          number,
        })),
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
    selectedVariationNote: selectedVar?.note ?? null,
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
  /** The selected variation's note, or null when it has none. */
  note: string | null;
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
  const rows = await db.getAllAsync<{ id: string; name: string; note: string | null }>(
    'SELECT id, name, note FROM variation WHERE exercise_id = ? ORDER BY created_at ASC',
    exerciseId,
  );
  const variations = rows.map((v) => ({ id: v.id, name: v.name }));
  const selectedId =
    variationId && variations.some((v) => v.id === variationId) ? variationId : exercise.default_variation_id;
  const note = rows.find((v) => v.id === selectedId)?.note ?? null;

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
      sets.filter((s) => !s.warmup).flatMap((s) => [
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
  return { exerciseName: exercise.name, selectedVariationId: selectedId, variations, note, workouts };
}

/** Appends an empty normal set for a variation in a workout; a warm-up sorts above the working sets. */
export async function addSet(db: SQLiteDatabase, workoutId: string, variationId: string, warmup = false): Promise<string> {
  const id = randomUUID();
  const t = now();
  const pos = await db.getFirstAsync<{ p: number | null }>(
    `SELECT MAX(position) AS p FROM workout_set
     WHERE workout_id = ? AND variation_id = ? AND intensifier_id IS NULL`,
    workoutId, variationId,
  );
  await db.runAsync(
    `INSERT INTO workout_set (id, workout_id, variation_id, intensifier_id, position, reps, weight, is_warmup, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, ?, ?)`,
    id, workoutId, variationId, (pos?.p ?? 0) + 1, warmup ? 1 : 0, t, t,
  );
  return id;
}

/**
 * Fill from last time (SPEC.md 3.5): copies last time's reps and weight into
 * the fields of this set that are still empty, never over a stored value.
 * Returns the set's values afterwards, and whether the fill changed anything.
 */
export async function fillSetFromLast(
  db: SQLiteDatabase,
  setId: string,
  reps: number | null,
  weight: number | null,
): Promise<{ reps: number | null; weight: number | null; changed: boolean }> {
  const before = await db.getFirstAsync<{ reps: number | null; weight: number | null }>(
    'SELECT reps, weight FROM workout_set WHERE id = ?',
    setId,
  );
  if (!before) return { reps: null, weight: null, changed: false };
  const after = { reps: before.reps ?? reps, weight: before.weight ?? weight };
  const changed = after.reps !== before.reps || after.weight !== before.weight;
  if (changed) {
    await db.runAsync('UPDATE workout_set SET reps = ?, weight = ?, updated_at = ? WHERE id = ?', after.reps, after.weight, now(), setId);
  }
  return { ...after, changed };
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
    // Its intensifiers and their rows go with it through ON DELETE CASCADE.
    await db.runAsync('DELETE FROM workout_set WHERE id = ?', setId);
  });
}

export async function removeIntensifier(db: SQLiteDatabase, intensifierId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE workout SET updated_at = ? WHERE id = (SELECT workout_id FROM intensifier WHERE id = ?)',
      now(), intensifierId,
    );
    // Its row goes with it through ON DELETE CASCADE.
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
  const siblings = await workingSets(db, workoutId, parent.variation_id);
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
  if (parent.is_warmup) throw new ValidationError('Warm-up sets have no intensifiers.');

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

export const NOTE_MAX_LENGTH = 500;

/**
 * Saves a variation's note, trimmed; blank text removes it. The exercise is
 * stamped too, so the day moves up on Home like any other change inside it.
 * The workout is not touched, so a note never counts as workout activity.
 */
export async function setVariationNote(db: SQLiteDatabase, variationId: string, note: string): Promise<void> {
  const text = note.trim();
  if (text.length > NOTE_MAX_LENGTH) throw new ValidationError(`A note can be at most ${NOTE_MAX_LENGTH} characters.`);
  const t = now();
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('UPDATE variation SET note = ?, updated_at = ? WHERE id = ?', text || null, t, variationId);
    if (result.changes === 0) throw new ValidationError('This variation no longer exists.');
    await db.runAsync(
      'UPDATE exercise SET updated_at = ? WHERE id = (SELECT exercise_id FROM variation WHERE id = ?)',
      t, variationId,
    );
  });
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
  await endInactiveWorkouts(db);
  return completedWorkouts(db, null);
}

/**
 * Completed workouts with volume and progress, for every day or for one day.
 * Progress only compares workouts of the same day, so one day's workouts are
 * enough to work out any of them.
 */
async function completedWorkouts(db: SQLiteDatabase, dayId: string | null): Promise<CalendarWorkout[]> {
  const dayFilter = dayId === null ? '' : ' AND w.day_id = ?';
  const params = dayId === null ? [] : [dayId];
  const workouts = await db.getAllAsync<{ id: string; day_id: string; day_name: string; date: string; started_at: string }>(
    `SELECT w.id, w.day_id, d.name AS day_name, w.date, w.started_at
     FROM workout w JOIN day_basket d ON d.id = w.day_id
     WHERE w.status = 'completed'${dayFilter}`,
    ...params,
  );
  const sets = await db.getAllAsync<VolumeRow>(
    `${VOLUME_QUERY} JOIN workout w ON w.id = s.workout_id WHERE w.status = 'completed' AND s.is_warmup = 0${dayFilter}`,
    ...params,
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

export type DataSummary = { days: number; exercises: number; workouts: number; sets: number; lastBackup: string | null };

/** What is stored on the phone, for the More screen. */
export async function getDataSummary(db: SQLiteDatabase): Promise<DataSummary> {
  await endInactiveWorkouts(db);
  const row = await db.getFirstAsync<DataSummary>(
    `SELECT
       (SELECT COUNT(*) FROM day_basket) AS days,
       (SELECT COUNT(*) FROM exercise) AS exercises,
       (SELECT COUNT(*) FROM workout WHERE status = 'completed') AS workouts,
       (SELECT COUNT(*) FROM workout_set s JOIN workout w ON w.id = s.workout_id WHERE w.status = 'completed' AND ${LOGGED}) AS sets,
       (SELECT value FROM settings WHERE key = 'lastBackup') AS lastBackup`,
  );
  return row ?? { days: 0, exercises: 0, workouts: 0, sets: 0, lastBackup: null };
}

type ExportCell = string | number | null;

/**
 * The CSV export (SPEC.md 3.10): a header, then one row per logged set row
 * (empty rows are skipped) of every finished workout, oldest first, in exercise and set order, each normal set
 * followed by its intensifier rows. Weights are in the given unit.
 */
export async function getExportRows(db: SQLiteDatabase, unit: Unit): Promise<ExportCell[][]> {
  const sets = await db.getAllAsync<{
    id: string; workout_id: string; variation_id: string; date: string; day: string; exercise: string;
    variation: string; note: string | null; is_warmup: number; reps: number | null; weight: number | null;
  }>(
    `SELECT s.id, s.workout_id, s.variation_id, w.date, d.name AS day, e.name AS exercise, v.name AS variation,
            v.note, s.is_warmup, s.reps, s.weight
     FROM workout_set s
     JOIN workout w ON w.id = s.workout_id
     JOIN day_basket d ON d.id = w.day_id
     JOIN variation v ON v.id = s.variation_id
     JOIN exercise e ON e.id = v.exercise_id
     WHERE w.status = 'completed' AND s.intensifier_id IS NULL AND ${LOGGED}
     ORDER BY w.started_at, e.position, v.created_at, s.is_warmup DESC, s.position`,
  );
  const rows = await db.getAllAsync<{
    parent_set_id: string; type: IntensifierType; reps: number | null; weight: number | null;
    exercise: string; variation: string; note: string | null;
  }>(
    `SELECT i.parent_set_id, i.type, s.reps, s.weight, e.name AS exercise, v.name AS variation, v.note
     FROM intensifier i
     JOIN workout_set s ON s.intensifier_id = i.id
     JOIN variation v ON v.id = s.variation_id
     JOIN exercise e ON e.id = v.exercise_id
     JOIN workout w ON w.id = i.workout_id
     WHERE w.status = 'completed' AND ${LOGGED}
     ORDER BY i.position`,
  );
  const byParent = new Map<string, typeof rows>();
  for (const r of rows) byParent.set(r.parent_set_id, [...(byParent.get(r.parent_set_id) ?? []), r]);
  const weight = (kg: number | null) => (kg === null ? null : toDisplayWeight(kg, unit));
  const out: ExportCell[][] = [['date', 'day', 'exercise', 'variation', 'set', 'type', 'reps', 'weight', 'unit', 'note']];
  // Numbered within each workout and variation, warm-ups apart (W1, W2… then Set 1, Set 2…).
  const counts = new Map<string, number>();
  for (const s of sets) {
    const key = `${s.workout_id}:${s.variation_id}:${s.is_warmup}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    const setLabel = s.is_warmup ? `W${n}` : `Set ${n}`;
    out.push([s.date, s.day, s.exercise, s.variation, setLabel, s.is_warmup ? 'warm-up' : 'working', s.reps, weight(s.weight), unit, s.note]);
    for (const r of byParent.get(s.id) ?? []) {
      // Partial reps have no weight of their own.
      const w = r.type === 'partial' ? null : weight(r.weight);
      out.push([s.date, s.day, r.exercise, r.variation, setLabel, r.type, r.reps, w, unit, r.note]);
    }
  }
  return out;
}

export type StoredSettings = { theme: ThemeName | null; unit: Unit | null; restSeconds: number | null };

export async function getSettings(db: SQLiteDatabase): Promise<StoredSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const theme = map.get('theme');
  const unit = map.get('unit');
  const rest = Number(map.get('restSeconds'));
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : null,
    unit: unit === 'kg' || unit === 'lb' ? unit : null,
    restSeconds: Number.isInteger(rest) && rest >= MIN_REST_SECONDS && rest <= MAX_REST_SECONDS ? rest : null,
  };
}

export async function saveSetting(
  db: SQLiteDatabase,
  key: 'theme' | 'unit' | 'restSeconds' | 'lastBackup' | (typeof TARGET_KEYS)[keyof Numbers],
  value: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

/** The daily Targets, the same on every Date; null is a blank Target (a missing settings key). */
export type Targets = { [K in keyof Numbers]: number | null };
const TARGET_KEYS = { kcal: 'targetKcal', protein: 'targetProtein', carbs: 'targetCarbs', fat: 'targetFat' } as const;
const NUTRIENTS = Object.keys(TARGET_KEYS) as (keyof Numbers)[];
const isTarget = (v: number) => Number.isFinite(v) && v > 0;

export async function getTargets(db: SQLiteDatabase): Promise<Targets> {
  const keys = Object.values(TARGET_KEYS);
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(', ')})`,
    ...keys,
  );
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  const targets = {} as Targets;
  for (const n of NUTRIENTS) {
    const v = map.get(TARGET_KEYS[n]);
    targets[n] = v !== undefined && isTarget(v) ? v : null;
  }
  return targets;
}

export async function saveTargets(db: SQLiteDatabase, targets: Targets): Promise<void> {
  for (const n of NUTRIENTS) {
    const v = targets[n];
    if (v !== null && !isTarget(v)) throw new ValidationError('Targets must be numbers above 0.');
  }
  await db.withTransactionAsync(async () => {
    for (const n of NUTRIENTS) {
      const v = targets[n];
      if (v === null) await db.runAsync('DELETE FROM settings WHERE key = ?', TARGET_KEYS[n]);
      else await saveSetting(db, TARGET_KEYS[n], String(v));
    }
  });
}

// ---------------------------------------------------------------------------
// Nutrition: My foods

/** A Food's nutrition is per Serving; servingGrams is the Serving's weight when known. */
export type Food = { id: string; name: string; servingGrams: number | null } & Numbers;
/** A barcode, when given, is kept so the Food is found by it later (it is unique in My foods). */
export type FoodInput = Omit<Food, 'id'> & { barcode?: string | null };

const FOOD_COLUMNS = 'id, name, kcal, protein, carbs, fat, serving_grams AS servingGrams';

function validateFood(f: FoodInput) {
  if (f.name.trim() === '') throw new ValidationError('Enter a name.');
  for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) {
    if (!Number.isFinite(f[key]) || f[key] < 0) throw new ValidationError('Enter kcal, protein, carbs and fat, each 0 or more.');
  }
  if (f.servingGrams !== null && !(Number.isFinite(f.servingGrams) && f.servingGrams > 0)) {
    throw new ValidationError('Serving weight must be more than 0 g, or left blank.');
  }
}

export async function createFood(db: SQLiteDatabase, f: FoodInput): Promise<string> {
  validateFood(f);
  const id = randomUUID();
  const t = now();
  await db.runAsync(
    `INSERT INTO food (id, name, kcal, protein, carbs, fat, serving_grams, barcode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, f.name.trim(), f.kcal, f.protein, f.carbs, f.fat, f.servingGrams, f.barcode ?? null, t, t,
  );
  return id;
}

/** Edits a Food in My foods; Entries keep the numbers they were logged with. The barcode stays as it was. */
export async function updateFood(db: SQLiteDatabase, foodId: string, f: Omit<FoodInput, 'barcode'>): Promise<void> {
  validateFood(f);
  await db.runAsync(
    'UPDATE food SET name = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, serving_grams = ?, updated_at = ? WHERE id = ?',
    f.name.trim(), f.kcal, f.protein, f.carbs, f.fat, f.servingGrams, now(), foodId,
  );
}

/** Removes a Food from My foods; its past Entries stay, unlinked (ON DELETE SET NULL). */
export async function deleteFood(db: SQLiteDatabase, foodId: string): Promise<void> {
  await db.runAsync('DELETE FROM food WHERE id = ?', foodId);
}

/** My foods A–Z, keeping those whose name contains the filter (any case). */
export async function listFoods(db: SQLiteDatabase, filter: string): Promise<Food[]> {
  return db.getAllAsync<Food>(
    `SELECT ${FOOD_COLUMNS} FROM food WHERE instr(lower(name), lower(?)) > 0 ORDER BY lower(name)`,
    filter.trim(),
  );
}

export async function getFood(db: SQLiteDatabase, foodId: string): Promise<Food | null> {
  return db.getFirstAsync<Food>(`SELECT ${FOOD_COLUMNS} FROM food WHERE id = ?`, foodId);
}

export async function findFoodByBarcode(db: SQLiteDatabase, barcode: string): Promise<Food | null> {
  return db.getFirstAsync<Food>(`SELECT ${FOOD_COLUMNS} FROM food WHERE barcode = ?`, barcode);
}

// ---------------------------------------------------------------------------
// Nutrition: Entries and the Food log

export type NewEntry = { date: string; meal: Meal; foodId: string; amount: number; unit: AmountUnit };

/** Logs a Food into a Meal of a Date, copying its name and numbers so later edits to the Food leave this Entry as it was. */
export async function addEntry(db: SQLiteDatabase, e: NewEntry): Promise<string> {
  if (!(Number.isFinite(e.amount) && e.amount > 0)) throw new ValidationError('Enter an amount above 0.');
  if (e.date > localDateString(new Date())) throw new ValidationError('Future Dates can be viewed but not logged into.');
  const food = await getFood(db, e.foodId);
  if (!food) throw new Error('Food not found');
  if (e.unit === 'gram' && food.servingGrams === null) throw new ValidationError('This food has no Serving weight, so log it in Servings.');
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO food_entry (id, date, meal, food_id, name, kcal, protein, carbs, fat, serving_grams, amount, unit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, e.date, e.meal, food.id, food.name, food.kcal, food.protein, food.carbs, food.fat, food.servingGrams, e.amount, e.unit, now(),
  );
  return id;
}

/** Saves a new Food to My foods and logs it in one go (an Open Food Facts pick); a failed Entry leaves no Food behind. */
export async function addEntryWithNewFood(db: SQLiteDatabase, f: FoodInput, e: Omit<NewEntry, 'foodId'>): Promise<void> {
  await db.withTransactionAsync(async () => {
    const foodId = await createFood(db, f);
    await addEntry(db, { ...e, foodId });
  });
}

/** An Entry as logged: the Food's name and per-Serving numbers copied at the time, plus the amount eaten. */
export type Entry = { id: string; name: string; servingGrams: number | null; amount: number; unit: AmountUnit } & Numbers;

export async function getEntry(db: SQLiteDatabase, entryId: string): Promise<Entry | null> {
  return db.getFirstAsync<Entry>(
    'SELECT id, name, kcal, protein, carbs, fat, serving_grams AS servingGrams, amount, unit FROM food_entry WHERE id = ?',
    entryId,
  );
}

/** Changes the amount eaten; the Entry's copied numbers stay, so the Food's later edits never reach it. */
export async function updateEntry(db: SQLiteDatabase, entryId: string, amount: number, unit: AmountUnit): Promise<void> {
  if (!(Number.isFinite(amount) && amount > 0)) throw new ValidationError('Enter an amount above 0.');
  const entry = await getEntry(db, entryId);
  if (!entry) throw new Error('Entry not found');
  if (unit === 'gram' && entry.servingGrams === null) throw new ValidationError('This food has no Serving weight, so log it in Servings.');
  await db.runAsync('UPDATE food_entry SET amount = ?, unit = ? WHERE id = ?', amount, unit, entryId);
}

export async function deleteEntry(db: SQLiteDatabase, entryId: string): Promise<void> {
  await db.runAsync('DELETE FROM food_entry WHERE id = ?', entryId);
}

/** An Entry with the kcal and Macros of the amount eaten. */
export type LoggedEntry = { id: string; name: string; amount: number; unit: AmountUnit } & Numbers;
export type FoodLog = {
  meals: { meal: Meal; entries: LoggedEntry[]; totals: Numbers }[];
  totals: Numbers;
};

export async function getFoodLog(db: SQLiteDatabase, date: string): Promise<FoodLog> {
  const rows = await db.getAllAsync<
    { id: string; meal: Meal; name: string; servingGrams: number | null; amount: number; unit: AmountUnit } & Numbers
  >(
    `SELECT id, meal, name, kcal, protein, carbs, fat, serving_grams AS servingGrams, amount, unit
     FROM food_entry WHERE date = ? ORDER BY created_at, rowid`,
    date,
  );
  const entries = rows.map((r) => ({ meal: r.meal, id: r.id, name: r.name, amount: r.amount, unit: r.unit, ...entryNumbers(r, r.amount, r.unit, r.servingGrams) }));
  const meals = MEALS.map(({ meal }) => {
    const mine = entries.filter((e) => e.meal === meal).map(({ meal: _, ...e }) => e);
    return { meal, entries: mine, totals: sumNumbers(mine) };
  });
  return { meals, totals: sumNumbers(entries) };
}
