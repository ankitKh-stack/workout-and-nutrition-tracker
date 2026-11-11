# Personal records: design (short)

Feature 4 of the workout gaps build order (docs/PRD-workout-gaps.md 4.3). Approved in conversation on 11 Nov 2026.

## Decisions (Ankit's)

- **When PRs show:** after finishing a workout.
- **What counts:** a set is a PR when its reps × weight is higher than last workout's.
- **What it's compared with:** the same set number, on the same variation, in the last completed workout that had that variation. That's the set the "Last 5 × 70" line shows while logging.

## Approaches

- **Same set number (chosen).** It matches the "Last" line, and several sets can be PRs.
- **Best set against best set (rejected).** At most one PR per exercise.

## Behaviour

- **Ties aren't PRs.**
- **Only normal sets count.** Drop, partial and superset rows are left out.
- **No PR when there's nothing to beat** *(my call)*: there was no set at that number last time, or last time's set lacked reps or weight.
- **Where it shows** *(my call)*:
  - after a successful Finish, a card appears on the day screen: "N PR(s) this workout";
  - it has one line per PR, for example "Bench Set 2 · 8 × 70 kg (was 5 × 70)", in the chosen unit;
  - it closes with × or by leaving the screen;
  - there's no card when there are no PRs.
- **Resume:** resuming and finishing again recomputes the PRs.

## Data

No schema change. A new repository function:

`getWorkoutPRs(db, workoutId): Promise<{ label: string; setNumber: number; reps: number; weight: number; lastReps: number; lastWeight: number }[]>`

- **Order:** the day's exercise order, then set number.
- **Label:** the existing `variationLabel`.
- **"Last workout":** worked out exactly as in `getLoggingData`, excluding this workout.

## Non-goals

- Records on exercise history, charts, a PR badge while logging, PRs on past workouts in History, and estimated 1RM.

## Left to the builder

- **Tests:**
  - a PR is found;
  - a tie isn't a PR;
  - there's no PR without a last set;
  - intensifier rows are ignored;
  - only the most recent previous workout counts.
- **Docs:** SPEC.md 3.3 (the day screen after Finish) and PRD 4.3, marked "BUILT".
