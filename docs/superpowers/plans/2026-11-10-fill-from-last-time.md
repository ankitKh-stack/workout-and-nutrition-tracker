# Fill from Last Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Use" button on each empty normal set copies last time's reps and weight into it, then starts the rest countdown.

**Architecture:**
- **Data:** one repository function fills only the empty columns.
- **Rest timer:** the provider gains a direct start, `startNow(owner)`.
- **Screen:** `SetBlock` on the logging screen shows the button and wires the two together.

**Tech Stack:** Expo SDK 58, React Native 0.88, expo-sqlite, and the Node test runner with node:sqlite.

**Spec:** `docs/superpowers/specs/2026-11-10-fill-from-last-time-design.md`

## Global Constraints

- **Scope:** normal sets only, never intensifier rows.
- **Overwriting:** never overwrite a stored value. Fill per column, only where it's NULL.
- **Units:** copy stored kg as is. No unit conversion in the write.
- **Rest:** a fill that leaves the set done, on a set with no intensifier rows, starts the countdown immediately with no prompt.
- **No schema change and no new packages.**
- **Before calling it done:** run `npx expo lint` (on the changed files), `npx tsc --noEmit` and `npm test`. Don't commit; the user commits.

## Review Focus

1. **A typed but unsaved value in a field when Use is tapped.** Expected: the typed value is kept, and only the other field is filled. Handled by `drainWrites()` before the write and pinned by the COALESCE test in Task 1.
2. **Last time's set has reps but no weight.** Expected: only reps are filled, and no rest starts. Pinned in Task 1, and Task 3 checks `done` from the returned row.
3. **A set with a drop or partial already added under it.** Expected: it fills, but no rest starts. Covered in Task 3's verification step.
4. **Tapping Use twice quickly.** Expected: the second tap changes nothing (COALESCE), and only one countdown runs, because a restart replaces the first.
5. **The unit set to lb.** Expected: the field shows last time's value converted, the same as the "Last" text. Covered in Task 3's verification step.

---

### Task 1: The `fillSetFromLast` repository function

**Files:**
- Modify: `src/data/repository.ts`: add the function next to `updateSetField`.
- Test: `tests/repository.test.ts`.

**Interfaces (produces):**
`export async function fillSetFromLast(db: SQLiteDatabase, setId: string, reps: number | null, weight: number | null): Promise<{ reps: number | null; weight: number | null }>`. It runs one UPDATE with `reps = COALESCE(reps, ?)`, `weight = COALESCE(weight, ?)` and `updated_at = now()`, then returns the row's values after the update.

- [ ] **Step 1: Write the failing tests.**

```ts
test('filling from last time fills empty fields and never overwrites', async () => {
  // specWorkout, finish, start next; addSet on benchVar -> empty set
  assert.deepEqual(await fillSetFromLast(db, empty, 10, 60), { reps: 10, weight: 60 });
  const half = await addSet(db, next, benchVar);
  await updateSetField(db, half, 'reps', 7);
  assert.deepEqual(await fillSetFromLast(db, half, 8, 60), { reps: 7, weight: 60 }); // typed reps win
  assert.deepEqual(await fillSetFromLast(db, empty, 1, 1), { reps: 10, weight: 60 }); // second tap: no change
});

test('filling from a last set with only reps fills only reps', async () => {
  const s = await addSet(db, next, benchVar);
  assert.deepEqual(await fillSetFromLast(db, s, 12, null), { reps: 12, weight: null });
});
```

- [ ] **Step 2: Run `npm test`.** Expected: it fails because `fillSetFromLast` is not exported.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run `npm test`.** Expected: all pass, 51 tests.

---

### Task 2: Start a countdown directly

**Files:**
- Modify: `src/lib/restTimer.tsx`.

**Interfaces (produces):** `RestTimerValue.startNow: (owner: RestOwner) => void`. It does what `start()` does, but without needing a prompt:
- clears any prompt and any "over" state;
- calls `setCountdown({ ...startCountdown(Date.now(), restSeconds), owner })`.

`start()` should become `prompt && startNow(prompt.owner)`, so there's a single code path.

- [ ] **Step 1: Implement it,** and add `startNow` to the type with a doc comment ("Starts the rest right away, without the prompt (Fill from last time).").
- [ ] **Step 2: Run `npx tsc --noEmit`.** Expected: clean.

---

### Task 3: The "Use" button on the logging screen, and the docs

**Files:**
- Modify: `src/app/(tabs)/workouts/log.tsx`: the `SetBlock` header row, and the props passed to it from `LogScreen`.
- Modify: `SPEC.md` 3.5: a bullet in "What the user sees" item 5 and in Actions.
- Modify: `docs/PRD-workout-gaps.md` 4.2: the heading gets ": BUILT 10 Nov 2026" and a pointer to the spec, the same as 4.7.

**Interfaces:**
- **Consumes:** `fillSetFromLast` (Task 1), `useRestTimer().startNow` (Task 2), `drainWrites` from `@/lib/writeQueue`, `offersRest` and `newlyDone` from `@/domain/restTimer`, and `Keyboard` from react-native.
- **New `SetBlock` prop:** `onFill: () => void`, passed only when `last` exists and both `set.reps` and `set.weight` are null.

**Behaviour:**
- **The header row:** right of the "Last {reps} × {weight} {unit}" text, render `<Button label="Use" variant="link" compact accessibilityLabel={`Use last time's ${last.reps ?? '—'} × ${formatWeight(last.weight, unit)} ${unit} for Set ${set.number}`} onPress={onFill} />` when `onFill` is set.
- **In `LogScreen`, `onFill` for a set:**
  1. calls `Keyboard.dismiss()`;
  2. calls `run(async () => { ... })`, which inside:
     - `await drainWrites()`;
     - `const row = await fillSetFromLast(db, set.setId, last.reps, last.weight)`;
     - if `newlyDone(false, 'normal', row.reps, row.weight) && offersRest(0, 1 + set.intensifiers.length)`, calls `rest.startNow({ dayId: data.dayId, workoutId })`.
  3. `run` already reloads, and shows the error banner on failure. The `SetBlock` key includes reps and weight, so it remounts with the filled values.

- [ ] **Step 1: Implement the button and the doc updates.**
- [ ] **Step 2: Verify in the web preview** at mobile size:
  - log a set on an exercise, finish, then start a new workout;
  - Set 1 shows "Last … Use";
  - tap Use: the fields fill, the "Use" button disappears, and the countdown bar runs;
  - add a set and type reps only: "Use" is gone (stored reps); do this with a blur first;
  - add a drop to an empty set, then tap Use: it fills and no countdown starts;
  - switch the unit to lb on More: the values show converted;
  - check the console for errors.
- [ ] **Step 3: Run lint on the changed files, then `npx tsc --noEmit` and `npm test`.** Expected: all clean and passing.
- [ ] **Step 4: Final review** by one reviewer subagent (Sonnet) on the diff, fix what's real, then report. Don't commit.
