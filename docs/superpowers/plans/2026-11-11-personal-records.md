# Personal Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Finish, the day screen lists each set whose reps × weight beat the same set last time.

**Architecture:**
- **Data:** one read function in `repository.ts`, reusing `normalSets` and the existing "last workout on this variation" query.
- **Screen:** the day screen calls it after a successful Finish and shows a dismissible card.

**Tech Stack:** Expo SDK 58, React Native, expo-sqlite, and the Node test runner with node:sqlite.

**Spec:** `docs/superpowers/specs/2026-11-11-personal-records-design.md`

## Global Constraints

- **The rule:** a PR is a set with `reps * weight > lastReps * lastWeight`, compared with the same set number on the same variation in the last completed workout with that variation, excluding this one. A tie isn't a PR.
- **Normal sets only:** rows with `intensifier_id IS NULL`.
- **No PR when there's nothing to beat:** no set at that number last time, or any of the four values is null.
- **No schema change and no new packages.** Don't commit; the user commits.

## Review Focus

1. **A variation done in two earlier workouts.** Expected: only the most recent one is compared. This is pinned in Task 1.
2. **A set with weight 0** (bodyweight): 10 × 0 against last time's 8 × 0 is 0 against 0, so it isn't a PR. This falls out of the rule, so no extra code.
3. **A workout that auto-ended or was already ended:** `finishWorkout` returns false, so no card shows. Task 2 only shows the card on success.
4. **Swapping variation mid-workout:** each variation's sets are compared with that variation's own history. Covered by grouping by `variation_id`.
5. **The unit set to lb:** the card shows converted values through `formatWeight`, like the rest of the screen.

---

### Task 1: `getWorkoutPRs`

**Files:**
- Modify: `src/data/repository.ts`: add the function after `getWorkoutDetail`.
- Test: `tests/repository.test.ts`.

**Produces:**

```ts
export type SetPR = { label: string; setNumber: number; reps: number; weight: number; lastReps: number; lastWeight: number };
export async function getWorkoutPRs(db: SQLiteDatabase, workoutId: string): Promise<SetPR[]>
```

How it works:
- Take each variation with normal sets in this workout, using the same query and order as `getWorkoutDetail` (exercise position, then variation created_at).
- Find its last completed workout with `w.id != workoutId`, ordered by `started_at DESC`. This is the same SQL as `lastWorkout` in `getLoggingData`, so pull it into a private helper `lastWorkoutWith(db, variationId, excludeWorkoutId)` and use it from both places.
- Compare the two `normalSets` lists by index.

- [ ] **Step 1: Write the failing tests.**

```ts
test('a set that beats the same set last time is a PR; a tie is not', async () => {
  // Push day, Bench. W1: 10×60, 5×70. Finish.
  // W2: 10×60 (tie), 8×70 (PR), plus a third set 12×50 (no set 3 last time). Finish.
  assert.deepEqual(await getWorkoutPRs(db, w2), [
    { label: 'Bench', setNumber: 2, reps: 8, weight: 70, lastReps: 5, lastWeight: 70 },
  ]);
});

test('PRs ignore intensifier rows, empty last sets and older workouts', async () => {
  // W1: Bench 8×100. W2: Bench 5×60, with a drop of 20×40 on it. W3: Bench 6×60.
  // W3 is compared with W2 only: 6×60=360 > 5×60=300 is a PR (W1's 800 doesn't matter, the drop doesn't count).
  // A W4 set compared with an empty W3 set gives no PR.
});

test('a first workout has no PRs', async () => { /* one finished workout -> [] */ });
```

- [ ] **Step 2: Run `npm test`.** Expected: it fails because `getWorkoutPRs` isn't exported.
- [ ] **Step 3: Implement it,** including the `lastWorkoutWith` refactor in `getLoggingData`.
- [ ] **Step 4: Run `npm test`.** Expected: all pass.

---

### Task 2: The PR card on the day screen, and the docs

**Files:**
- Modify: `src/app/(tabs)/workouts/day/[dayId].tsx`.
- Modify: `SPEC.md` 3.3, the Finish action.
- Modify: `docs/PRD-workout-gaps.md` 4.3: the heading gets ": BUILT 11 Nov 2026" plus a pointer to the spec.

**Consumes:** `getWorkoutPRs` and `SetPR` from Task 1, and `formatWeight` and `plural`.

**Behaviour:**
- **State:** `const [prs, setPrs] = useState<SetPR[]>([])`.
- **In `onFinish`:** after `finishWorkout` returns true, call `setPrs(await getWorkoutPRs(db, fresh.workout.id))`. Wrap only that call in its own try/catch that leaves `prs` empty on failure: the workout is already saved, so a PR read failure must not show "Could not save the workout".
- **Clearing:** clear `prs` when Start or Resume succeeds.
- **The card:** a `styles.card` under the banner area, inside the ScrollView, above the summary card, shown when `prs.length > 0`.
  - The header row is `"🏆 {plural(n, 'PR')} this workout"` (`styles.bodyStrong`) with a × `Pressable`, `accessibilityLabel="Dismiss personal records"`.
  - Then one `styles.body` line per PR: `{label} Set {setNumber} · {reps} × {formatWeight(weight, unit)} {unit} (was {lastReps} × {formatWeight(lastWeight, unit)})`.
- **Leaving the screen** unmounts the state, so the card is gone when you come back.

- [ ] **Step 1: Implement the card and the doc updates.**
- [ ] **Step 2: Verify in the web preview:**
  - on a day whose exercise has a finished workout, start a workout and log a heavier Set 1;
  - Finish: the card lists it with the old values;
  - tap × and it hides;
  - finish a workout with no improvement: there's no card;
  - check the console for errors.
- [ ] **Step 3: Run `npx expo lint`, `npx tsc --noEmit` and `npm test`.** Expected: all clean.
- [ ] **Step 4: Final review** by one Sonnet reviewer on the diff, fix what's real, then report.
