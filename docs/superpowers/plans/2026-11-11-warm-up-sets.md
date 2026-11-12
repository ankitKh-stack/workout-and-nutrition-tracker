# Warm-up Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** You can log warm-up sets that sit above the working sets, are numbered W1, W2…, are left out of volume, PRs and rest, and still get "Last" and Use.

**Architecture:**
- **Data:** an `is_warmup` flag on `workout_set` (schema v5).
- **One choke point:** `normalSets` orders warm-ups first and every reader numbers each group separately.
- **Volume** filters warm-ups out in SQL.
- **The logging screen** gains the Add set chooser and warm-up styling.

**Tech Stack:** Expo SDK 58, React Native, expo-sqlite, and the Node test runner with node:sqlite.

**Spec:** `docs/superpowers/specs/2026-11-11-warm-up-sets-design.md`

## Global Constraints

- **Existing sets** stay working sets (`DEFAULT 0`), so past volumes don't change.
- **Warm-ups:** no volume, no PRs, no rest, no intensifiers. They still count as logged sets.
- **Matching:** W*n* matches last time's W*n*, and Set *n* matches last time's Set *n*.
- **No new packages.** Don't commit; the user commits.

## Review Focus

1. **Warm-ups only, then Finish:** this counts as logged, so there's no zero-volume question, and volume is 0. That's per the spec; check that it's consistent with auto-end (it's logged, so it's saved).
2. **Last time had warm-ups, this time has none:** Set 1 still matches last time's Set 1, not W1. Pinned in Task 1.
3. **Superset label numbering with warm-ups present:** "Superset with Bench, Set 1" refers to the first working set. Pinned in Task 1.
4. **The opening set:** an exercise opened with no sets still gets a working set.
5. **The unit set to lb:** warm-up values convert like any other set.

---

### Task 1: Data (schema v5, ordering, numbering, volume, PRs)

**Files:** `src/data/schema.ts`, `src/data/repository.ts`, `tests/repository.test.ts`.

**Produces:**
- `addSet(db, workoutId, variationId, warmup = false): Promise<string>`, which writes `is_warmup`.
- `NormalSetRow.warmup: boolean`. `number` is counted within the row's group (warm-ups 1.., working 1..).
- `LoggingData.lastTime.sets: { reps; weight; warmup: boolean; number: number }[]`.

**Changes:**
- **`SetRow`:** add `is_warmup: number`.
- **`normalSets`:** `ORDER BY is_warmup DESC, position ASC`.
- **Numbering:** a private `numbered(sets)` helper gives each row its in-group number. Use it in `setsWithIntensifiers` and in `lastTime`.
- **Working sets only:** filter `!is_warmup` in `getWorkoutPRs` (both sides), in partner-set numbering in `getLoggingData`, and in `getIntensifierPickerData`.
- **Volume:**
  - `VOLUME_QUERY` callers get `AND s.is_warmup = 0`, in both `computeWorkoutVolume` and `completedWorkouts`;
  - exercise history's volume skips warm-up sets.

- [ ] **Step 1: Write the failing tests.**

```ts
test('warm-ups are numbered apart, sit above working sets and add no volume', ...)
// working 8×60 added first, then warm-ups 10×20 and 8×40.
// getLoggingData sets -> [{warmup:true,number:1},{warmup:true,number:2},{warmup:false,number:1}]; computeWorkoutVolume = 480.
test('last time matches warm-ups with warm-ups and working sets with working sets', ...)
// W1 last time + Set 1 last time; this time only Set 1 -> lastTime has both, Set 1 finds number 1 working.
test('warm-ups never count as PRs', ...)        // last W1 5×20, now W1 10×20 -> [].
test('a v4 database gains warm-ups with every old set a working set', ...) // drop column, user_version 4, re-init.
```

- [ ] **Step 2: Run `npm test`.** Expected: it fails because `addSet` ignores the warm-up argument and there's no `warmup` field.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run `npm test`.** Expected: all pass, including the existing 56.

---

### Task 2: The logging screen, history lines and docs

**Files:** `src/app/(tabs)/workouts/log.tsx`, `src/components/SetLines.tsx`, `SPEC.md` 3.5, 3.11 and 5.5, and `docs/PRD-workout-gaps.md` 4.4.

**Behaviour:**
- **The Add set chooser:** "Add set" toggles a small card with two buttons, "Working set" (first) and "Warm-up set". Either one adds the set (`addSet(..., warmup)`), closes the card and focuses the new row's Reps field.
- **`SetBlock` for a warm-up:**
  - the title is `W{number}`;
  - the card has `marginLeft: 16`;
  - the "Reps"/"Weight (unit)" labels use `colors.faint` in place of the label colour, so `FieldPair` gets a `muted` prop;
  - there's no "+ Intensifier" button;
  - `onDone` is undefined, so there's no rest.
- **"Last" lookup:** `last = lastTime.sets.find(l => l.warmup === set.warmup && l.number === set.number)`, used for both the "Last" text and `fillFor`.
- **`fillFor`:** never calls `startNow` for a warm-up.
- **`SetLines`:** warm-up rows read `W{n}` in `styles.muted` for both label and value.

- [ ] **Step 1: Implement the screen, the history lines and the docs.**
- [ ] **Step 2: Verify in the web preview.**
  - Add set → Warm-up set: the row appears at the top as W1, indented with lighter labels.
  - A second warm-up becomes W2, above Set 1.
  - Typing values offers no rest.
  - The day volume excludes warm-ups.
  - After Finish and a new workout, W1 shows "Last … Use".
  - History shows the W lines.
  - The console is clean.
- [ ] **Step 3: Run `npx expo lint`, `npx tsc --noEmit` and `npm test`.**
- [ ] **Step 4: Final review** by one Sonnet reviewer, fix what's real, then report. Don't commit.
