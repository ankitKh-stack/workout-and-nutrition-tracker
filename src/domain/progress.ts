// Pure progress rules from SPEC.md sections 5.7, 5.8 and 7.
// This file has no imports so it can be unit-tested with plain Node.

export type VolumeSetInput = {
  reps: number | null;
  weight: number | null;
  /** True when the set is the child row of a partial-reps intensifier. */
  isPartial: boolean;
  /** The parent set's weight; only used when isPartial is true. */
  parentWeight: number | null;
};

/** Volume of one set: reps × weight, with empty values counted as 0. */
export function setVolume(set: VolumeSetInput): number {
  const reps = set.reps ?? 0;
  // Partial reps have no weight of their own; they use the parent set's weight.
  const weight = (set.isPartial ? set.parentWeight : set.weight) ?? 0;
  return reps * weight;
}

/** Workout volume: the sum of every set's volume, including intensifier rows. */
export function workoutVolume(sets: VolumeSetInput[]): number {
  return sets.reduce((sum, set) => sum + setVolume(set), 0);
}

export type ChangeResult =
  | { kind: 'zero' }
  | { kind: 'first'; percent: 100 }
  | { kind: 'previousZero'; percent: 100; previousDate: string }
  | { kind: 'change'; percent: number; previousDate: string };

export type PreviousWorkout = { volume: number; date: string };

/**
 * Percentage change of a workout's volume against the previous completed
 * workout of the same day basket (SPEC.md 5.8).
 */
export function percentChange(volume: number, previous: PreviousWorkout | null): ChangeResult {
  // Zero volume always wins, even for a first workout.
  if (volume === 0) return { kind: 'zero' };
  if (previous === null) return { kind: 'first', percent: 100 };
  // Dividing by a zero previous volume is undefined, so it counts like a first workout.
  if (previous.volume === 0) return { kind: 'previousZero', percent: 100, previousDate: previous.date };
  return {
    kind: 'change',
    percent: ((volume - previous.volume) / previous.volume) * 100,
    previousDate: previous.date,
  };
}

/** 'none' = no workout; 'zero' = zero volume; 1–4 = progress levels, darkest is 4. */
export type ShadeLevel = 'none' | 'zero' | 1 | 2 | 3 | 4;

/** Maps a change result to a shade level using the exact bands in SPEC.md 7. */
export function shadeLevel(result: ChangeResult): ShadeLevel {
  if (result.kind === 'zero') return 'zero';
  const p = result.percent;
  if (p < 25) return 1; // includes any decrease
  if (p < 50) return 2;
  if (p < 100) return 3;
  return 4;
}

const LEVEL_RANK: Record<string, number> = { none: 0, zero: 1, '1': 2, '2': 3, '3': 4, '4': 5 };

/** The darker of two levels; used when one date holds several workouts. */
export function darkerLevel(a: ShadeLevel, b: ShadeLevel): ShadeLevel {
  return LEVEL_RANK[String(a)] >= LEVEL_RANK[String(b)] ? a : b;
}

export type CompletedWorkout = {
  id: string;
  dayId: string;
  date: string;
  startedAt: string;
  volume: number;
};

export type WorkoutProgress = { result: ChangeResult; level: ShadeLevel };

/**
 * Computes the change and shade for every completed workout, comparing each
 * one only with the previous completed workout of the same day basket.
 */
export function computeProgress(workouts: CompletedWorkout[]): Map<string, WorkoutProgress> {
  const byDay = new Map<string, CompletedWorkout[]>();
  for (const w of workouts) {
    const list = byDay.get(w.dayId) ?? [];
    list.push(w);
    byDay.set(w.dayId, list);
  }
  const out = new Map<string, WorkoutProgress>();
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
    list.forEach((w, i) => {
      const prev = i > 0 ? { volume: list[i - 1].volume, date: list[i - 1].date } : null;
      const result = percentChange(w.volume, prev);
      out.set(w.id, { result, level: shadeLevel(result) });
    });
  }
  return out;
}
