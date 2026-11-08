// Pure rest timer rules (docs/superpowers/specs/2026-11-08-rest-timer-design.md).
// This file has no imports so it can be unit-tested with plain Node.

export const DEFAULT_REST_SECONDS = 120;
export const REST_STEP_SECONDS = 15;
export const MIN_REST_SECONDS = 30;
export const MAX_REST_SECONDS = 300;

/**
 * A running countdown, kept as its end time (epoch ms) rather than as ticks,
 * so it stays correct after the phone sleeps.
 */
export type Countdown = { endsAt: number };

export function startCountdown(now: number, seconds: number): Countdown {
  return { endsAt: now + seconds * 1000 };
}

/** Adds or removes time; the end is never before now, so time left never goes negative. */
export function adjustCountdown(c: Countdown, deltaSeconds: number, now: number): Countdown {
  return { endsAt: Math.max(now, c.endsAt + deltaSeconds * 1000) };
}

/** Whole seconds left, rounded up, never below 0. */
export function remainingSeconds(c: Countdown, now: number): number {
  return Math.max(0, Math.ceil((c.endsAt - now) / 1000));
}

/** 120 -> "2:00", 5 -> "0:05". */
export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The More stepper: one 15 s step, kept between 0:30 and 5:00. */
export function stepRest(current: number, direction: 1 | -1): number {
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, current + direction * REST_STEP_SECONDS));
}

export type RowKind = 'normal' | 'drop' | 'partial' | 'superset';

/**
 * A row is newly done the first time it has its values: reps and weight, or
 * reps alone for partial reps (they use the parent set's weight).
 */
export function newlyDone(wasDone: boolean, kind: RowKind, reps: number | null, weight: number | null): boolean {
  return !wasDone && reps !== null && (kind === 'partial' || weight !== null);
}

/**
 * Whether finishing this row offers a rest. Row 0 is the set and rows 1..n are
 * its drop, partial and superset rows; they are done without rest, so the rest
 * comes after the last row of the set.
 */
export function offersRest(rowIndex: number, rowCount: number): boolean {
  return rowIndex === rowCount - 1;
}
