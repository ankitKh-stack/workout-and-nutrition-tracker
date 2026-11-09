# Variation Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each variation gets one note, written and read from a ⋮ menu on the logging screen and from a card on exercise history.

**Architecture:**
- **Data:** a nullable `variation.note` column (schema v4). It's read through the existing `getLoggingData` and `getExerciseHistory`, and written by a new `setVariationNote`.
- **Popup:** one shared `NoteWindow` component, a transparent React Native `Modal` with a read mode and an edit mode, used by both screens.

**Tech Stack:** Expo SDK 58, React Native 0.88, expo-router, expo-sqlite, and the Node test runner with node:sqlite.

**Spec:** `docs/superpowers/specs/2026-11-08-variation-notes-design.md`

## Global Constraints

- **The note:** plain text, at most 500 characters (`NOTE_MAX_LENGTH = 500`), line breaks allowed. It's stored trimmed; empty after trimming means NULL, which means no note.
- **Saving:** only Save writes. Closing with unsaved changes asks "Discard changes?" first, through `confirmAsync`.
- **Menu labels:** exactly "Swap", "Write" (no note) and "Edit" (has a note).
- **No new native modules.** It must run in Expo Go and on web.
- **Before calling it done:** run `npx expo lint`, `npx tsc --noEmit` and `npm test`.
- **Commits:** the user commits themselves. Don't commit; the plan's commit steps become "stop and report".

## Review Focus

1. **The keyboard covering the box or the Save button** in the popup on Android. Expected: both stay visible. Verify on web at phone size and describe Android's `KeyboardAvoidingView` behaviour in the hand-off.
2. **A pasted note over 500 characters.** Expected: the box caps it at 500 (`maxLength`), and the repository rejects anything longer with `ValidationError`. Pinned in Task 1.
3. **A note that is only spaces or newlines.** Expected: treated as no note. Pinned in Task 1.
4. **Swapping variation while the menu is open.** Expected: the menu closes, and Write/Edit then reflects the newly selected variation's note. Covered by Task 3's verification step.
5. **An existing v3 database on your phone.** Expected: the migration adds the column and keeps all data. Pinned in Task 1.

---

### Task 1: Data layer (schema v4 and notes in the repository)

**Files:**
- Modify: `src/data/schema.ts`: set `SCHEMA_VERSION = 4` and add a `version < 4` block, `ALTER TABLE variation ADD COLUMN note TEXT;`, with a one-line comment.
- Modify: `src/data/repository.ts`.
- Test: `tests/repository.test.ts`.

**Interfaces (produces):**
- `export const NOTE_MAX_LENGTH = 500;` in repository.ts.
- `export async function setVariationNote(db: SQLiteDatabase, variationId: string, note: string): Promise<void>`:
  - trims the note;
  - stores NULL when it's empty;
  - throws `ValidationError('A note can be at most 500 characters.')` when it's longer than `NOTE_MAX_LENGTH` after trimming;
  - stamps `updated_at` with one timestamp on both the variation and its exercise. The exercise is stamped so `listDays` moves the day up; `listDays` doesn't look at variations, and the workout is not touched, so auto-end is unaffected.
- `LoggingData.selectedVariationNote: string | null`.
- `HistoryData.note: string | null`, the selected variation's note.

- [ ] **Step 1: Write the failing tests** in `tests/repository.test.ts`, importing `setVariationNote`. The `ex` and `variation` values below are the same shapes the existing tests use: `getDayDetail` gives the exercise's variation id. Follow the existing tests' way of getting `variationId`.

```ts
test('a variation note is saved trimmed, shown while logging and on history, and kept across workouts', async () => {
  // day with exercise Bench; start workout w1
  await setVariationNote(db, variationId, '  Bench at notch 3\nseat 2  ');
  assert.equal((await getLoggingData(db, w1, exerciseId))!.selectedVariationNote, 'Bench at notch 3\nseat 2');
  assert.equal((await getExerciseHistory(db, exerciseId, null))!.note, 'Bench at notch 3\nseat 2');
  // finish w1, start w2
  assert.equal((await getLoggingData(db, w2, exerciseId))!.selectedVariationNote, 'Bench at notch 3\nseat 2');
});

test('each variation has its own note', async () => {
  // note on the original variation; createVariationAndSwap to 'Incline DB'
  assert.equal((await getLoggingData(db, w, exerciseId))!.selectedVariationNote, null);
  assert.equal((await getExerciseHistory(db, exerciseId, originalVariationId))!.note, 'notch 3');
});

test('a blank note removes it, and a note over 500 characters is refused', async () => {
  await setVariationNote(db, variationId, 'x');
  await setVariationNote(db, variationId, '  \n ');
  assert.equal((await getExerciseHistory(db, exerciseId, null))!.note, null);
  await assert.rejects(setVariationNote(db, variationId, 'a'.repeat(501)), ValidationError);
  await setVariationNote(db, variationId, 'a'.repeat(500)); // exactly 500 is fine
});

test('writing a note moves its day to the top', async () => {
  // threeDays; Bench on push; tick; renameDay(pull) so Pull is on top; tick
  await setVariationNote(db, benchVariationId, 'notch 3');
  assert.equal((await dayOrder(db))[0], 'Push');
});

test('a v3 database gains notes and keeps its data', async () => {
  const db = await openTestDb();
  // day + exercise + finished workout with one logged set
  await db.execAsync('ALTER TABLE variation DROP COLUMN note; PRAGMA user_version = 3;');
  await initializeDatabase(db);
  // the logged set is still in getWorkoutDetail; setVariationNote works; user_version is 4
});
```

- [ ] **Step 2: Run the tests and check that they fail.** Run `npm test`. Expected: the new tests fail, because `setVariationNote` is not exported and the `note` fields don't exist yet.
- [ ] **Step 3: Implement.**
  - Add the schema block.
  - Add `NOTE_MAX_LENGTH` and `setVariationNote`. Use `withTransactionAsync` for the two UPDATEs. The exercise is found with `UPDATE exercise SET updated_at = ? WHERE id = (SELECT exercise_id FROM variation WHERE id = ?)`.
  - `getLoggingData`: select `name, note` for the selected variation and return `selectedVariationNote: selectedVar?.note ?? null`.
  - `getExerciseHistory`: select `id, name, note` for the variations, and return `note` for the selected one. Leave `variations` typed as `{ id; name }` in `HistoryData`, and map the note out.
- [ ] **Step 4: Run the tests and check that they pass.** Run `npm test`. Expected: all pass, the 44 existing tests plus the 5 new ones.
- [ ] **Step 5: Stop and report.** Don't commit.

---

### Task 2: The `NoteWindow` popup

**Files:**
- Create: `src/components/NoteWindow.tsx`.

**Interfaces:**
- **Consumes:** `NOTE_MAX_LENGTH` from Task 1, `confirmAsync` from `@/lib/dialogs`, `Button` from `@/components/ui`, and `useTheme`.
- **Produces:**

```ts
export function NoteWindow(props: {
  visible: boolean;
  /** Shown as the window's title, e.g. the variation name. */
  title: string;
  /** The saved note, or null when there is none. */
  note: string | null;
  /** Open straight into editing (Write). */
  startEditing: boolean;
  /** Saves the trimmed text; '' removes the note. Rejects on failure (window stays open, shows "Could not save the note."). */
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}): JSX.Element
```

**Behaviour.** Every point here is fixed by the spec.
- **The window:** a transparent `Modal` (`animationType="fade"`) with a dimmed backdrop, containing a centred card. The card is `styles.card`, with a max width of about 420 and 16 px side gutters, wrapped in a `KeyboardAvoidingView`: `behavior="padding"` on iOS and `"height"` on Android.
- **The header row:** the title (`styles.title`). In read mode only, a ✎ button (`Ionicons "create-outline"`, accessibilityLabel "Edit note") sits beside it.
- **Read mode:** the note in `styles.body`, scrollable when it's long (max height about 50% of the window).
- **Edit mode:**
  - a multiline `TextInput` with `autoFocus`, `maxLength={NOTE_MAX_LENGTH}`, and a minimum height of about 120;
  - placeholder "Bench height, seat position, grip…";
  - the cursor at the end;
  - a counter, "{n}/500", shown once n ≥ 450;
  - a `buttonRow` with Cancel (quiet) and Save.
- **Save:**
  - calls `onSave(draft.trim())`;
  - on success with non-empty text, returns to read mode;
  - with empty text, it calls `onClose`;
  - it's disabled while saving.
- **Leaving with unsaved changes:**
  - Cancel, Android back (`onRequestClose`) and a backdrop tap all check: if the draft differs from `note ?? ''`, ask `confirmAsync('Discard changes?', 'Your changes to this note will be lost.', 'Discard', true)` first.
  - Then Cancel returns to read mode, or closes when `note` is null.
  - Back and a backdrop tap close.
- **Resetting:** when `visible` turns true, reset the mode from `startEditing` and the draft from `note`.

- [ ] **Step 1: Implement the component** as specified above. No unit test is needed: it's pure UI, and it's verified in Task 3.
- [ ] **Step 2: Typecheck.** Run `npx tsc --noEmit`. Expected: no errors.

---

### Task 3: The ⋮ menu on the logging screen

**Files:**
- Modify: `src/app/(tabs)/workouts/log.tsx`, the Variation card (currently the `Swap` `Button`).

**Interfaces:**
- **Consumes:** `setVariationNote` and `LoggingData.selectedVariationNote` from Task 1, and `NoteWindow` from Task 2.

**Behaviour:**
- **The ⋮ button:** replace the Swap button with a `Pressable` showing `Ionicons "ellipsis-vertical"`, size 22, with accessibilityLabel "Variation options". It sits in the same spot, with a 44 px hit area.
- **The menu:** tapping ⋮ toggles a menu card right under the Variation card, styled like the day screen's menu (`styles.card`, `padding: 8, gap: 4`, `Button variant="link"`, left-aligned). It has:
  - **"Swap"** (icon `swap-horizontal`): closes the menu and pushes `/swap-variation` as today;
  - **"Write"** (icon `create-outline`) when `selectedVariationNote` is null, or **"Edit"** (icon `document-text-outline`) otherwise. It closes the menu and opens `NoteWindow`, with `startEditing` true for Write.
- **The window:** `NoteWindow` gets `title = data.selectedVariationName` and `note = data.selectedVariationNote`. Its `onSave` runs `setVariationNote(db, data.selectedVariationId, text)` and then `reload()`.
- **Closing the menu:** close it on any reload where `selectedVariationId` changed, for example after coming back from Swap.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the web preview** at mobile size:
  - start a workout and open an exercise;
  - ⋮ → Write → type → Save: it shows read mode;
  - close, then ⋮ shows "Edit";
  - Edit → ✎ → change → backdrop tap: the confirm appears;
  - clear the text → Save: the menu shows "Write" again;
  - Swap to another variation, then ⋮ shows "Write";
  - check the console for errors;
  - take a screenshot.

---

### Task 4: The note card on exercise history, and the docs

**Files:**
- Modify: `src/app/(tabs)/workouts/history.tsx`.
- Modify: `SPEC.md`:
  - the logging section (3.5): the Variation card's ⋮ menu and the note window;
  - the exercise history section: the note card;
  - the Variation entity in 5.x: `note`;
  - section 6: schema v4.
- Modify: `docs/PRD-workout-gaps.md`: the decisions table row 2 becomes "One note per variation (replaces set and workout notes)", and 4.7 becomes "BUILT 8 Nov 2026", with a pointer to the spec.

**Behaviour:**
- **The card:** when `data.note` is set, a `Pressable` `styles.card` sits under the variation selector and above the "Last N workouts" line. It shows the label "Note" (`styles.label`) and the note (`styles.body`, `numberOfLines={3}`). Its accessibilityLabel is "Note, {note}", and its accessibilityHint is "Opens the note".
- **Tapping it** opens `NoteWindow` (`startEditing` false, title is the selected variation's name). `onSave` runs `setVariationNote` and then `reload()`.
- **No note:** no card.
- **The header comment:** update the "Nothing on this screen writes to storage" comment to say only the note can be edited here.

- [ ] **Step 1: Implement the card and the doc updates.**
- [ ] **Step 2: Verify in the web preview:**
  - with no workout running, open an exercise that has a note: the card shows;
  - tap it, then ✎, then Save: the card updates;
  - switch variation: its own note shows, or no card.
- [ ] **Step 3: Run `npx expo lint`, `npx tsc --noEmit` and `npm test`.** Expected: lint and typecheck are clean, and all 49 tests pass.
- [ ] **Step 4: Final review** by one fresh reviewer subagent on the whole diff, then report to the user. Don't commit.
