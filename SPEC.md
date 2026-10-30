# Workout and Nutrition Tracker — Prototype Build Specification

This document is the complete brief for building the first working prototype. It is written for Claude Code (an AI coding agent) and for a human developer with basic React Native knowledge. Each feature starts with a short plain-language **Summary** that explains the intent, followed by **Technical** detail (data, state, storage) for the builder. Where a rule exists, the reason for it is given, so that edge cases not covered here can be resolved in the spirit of the rule.

The prototype is finished when a person can: create and name a day, add exercises, log a workout with sets, reps and weight, use each of the three intensifiers, swap to a different variation mid-workout (including creating a new one on the spot), see the GitHub-style calendar update, and force-close and reopen the app with all of that data still present.

---

## 1. Overview

Workout and Nutrition Tracker is a phone app (Android and iPhone) for people who lift weights and want a simple, private log of their training. The user groups exercises into named "days" (for example "Push Day"), logs the sets, reps and weight they lift in each workout, marks harder techniques such as drop sets, partial reps and supersets, and swaps between variations of an exercise when the gym is busy or equipment is missing. A GitHub-style calendar shows each workout as a shaded square, darker when the workout's total lifted volume grew more compared with the previous workout of the same day. All data stays on the phone. Nutrition tracking is a later phase; this prototype contains only a placeholder screen for it.

---

## 2. Glossary

These terms are used throughout the spec. They are defined for a reader who has never trained.

| Term | Meaning |
|---|---|
| **Exercise** | One movement the user performs, such as "Bicep curl" or "Bench press". In this app an exercise is a slot inside a day that holds one or more variations. |
| **Variation** | A specific way of doing an exercise, usually differing in equipment or body position. "Seated dumbbell curl", "Standing cable curl" and "Seated cable curl" are three variations of the curl exercise. The app keeps each variation's history separately. |
| **Dumbbell** | A short hand-held bar with a weight at each end, used one per hand. Appears only in example variation names. |
| **Cable / cable machine** | A gym machine where the user pulls a handle attached to a cable that runs over a pulley to a weight stack. Appears only in example variation names. |
| **Rep (repetition)** | One complete movement of an exercise, for example lifting the weight up and lowering it once. |
| **Set** | A group of reps done back to back without resting, for example "10 reps at 20 kg". A workout usually has several sets of each exercise. |
| **Normal set** | A set logged on its own, with reps and weight, that is not part of an intensifier. Intensifiers attach to normal sets. |
| **Weight** | The load lifted in a set, entered as a number. Shown and typed in kg or lb, chosen on the More tab (3.10); always stored in kg. |
| **Bodyweight exercise** | An exercise where the lifter moves their own body instead of an added weight, such as a push-up. Logged with weight empty or 0. |
| **Volume** | A simple measure of how much work was done: weight × reps. A set of 10 reps at 20 kg has a volume of 200. A workout's volume is the sum of the volume of every set in it. |
| **Intensifier** | A technique that makes a set harder than a normal set. The app supports exactly three: drop set, partial reps and superset. |
| **Drop set** | Immediately after finishing a set, the lifter lowers the weight and keeps going for more reps with no rest. In the app it is an extra row attached under a normal set, with its own reps and weight. |
| **Partial reps** | Extra reps done at the end of a set through only part of the full range of motion (for example only the top half of a curl), using the same weight. In the app it is an extra row under a normal set with reps only; the weight is taken from the parent set. |
| **Superset** | Two different exercises done back to back with no rest between them, for example a curl set followed immediately by a triceps set. In the app it links a normal set of one exercise to a set of a second exercise; each has its own reps and weight. |
| **Parent set** | The normal set that an intensifier row is attached to. |
| **Push day / Pull day / Leg day** | Common ways of grouping exercises into one training session. A push day trains muscles that push (chest, shoulders, triceps), a pull day trains muscles that pull (back, biceps), and a leg day trains the legs. In this app these are just example names for a day basket. |
| **Day / Day basket** | A user-named container of exercises, such as "Push Day" or "Monday Arms". The user's notes call it a "basket". The app's screens call it a "day". |
| **Workout** | One session in which the user performs and logs the exercises of one day basket on a particular date. |
| **Progression** | Getting stronger over time, usually seen as lifting more weight or doing more reps than last time. The app shows the last logged sets for each variation so the user can see their progression. |

---

## 3. Screens

### 3.0 Navigation structure

**Summary:** The app has four tabs at the bottom: Workouts, Calendar, Nutrition and More. Everything to do with days, exercises and logging lives under the Workouts tab as a stack of screens the user moves forward and back through.

**Technical:**
- Use `expo-router` (the default navigation in a new Expo project) with a bottom tab layout of four tabs: `Workouts`, `Calendar`, `Nutrition`, `More`. The app opens on the `Workouts` tab.
- Tab root screens (Home, Calendar, Nutrition, More) hide the navigation header and show a large page title with the weekday and date above it ("FRIDAY, OCTOBER 30"), following the reference screenshots.
- The app has a light and a dark theme (3.10). Colours come from one palette per theme in `src/theme/palette.ts`; screens never hard-code colours.
- Workouts stack, in push order: Home / Day list (3.1) → Day detail (3.3) → Exercise logging (3.5).
- Modal screens (presented over the current screen, dismissed with Cancel or the system back gesture): Name Your Day (3.2), Add exercise (3.4), Intensifier picker (3.6), Variation swap (3.7).
- Every screen follows the loose visual inspiration: items are presented as a vertical list, each row has one clear entry field or one clear button, and density is similar to a typical tracking app (several rows visible at once). No colours, fonts or spacing values are specified; use the platform defaults or plain styles.
- Every screen reads its data from storage when it gains focus, so that a change made on one screen is visible on any other screen the next time it is shown, with no manual refresh.

---

### 3.1 Home / Day list

**Summary:** The first screen. It lists every day basket the user has created, and has one button to create a new one. Tapping a day opens it.

**What the user sees:**
- Screen title: "Workouts".
- A vertical list, one row per day basket. A day with a workout in progress is listed first and highlighted with an outline in the data colour and the line "In progress · started 18:05" under its name, so the user can get back to it in one tap. The other days follow with the most recently changed day on top: any change inside a day (renaming it, adding or removing an exercise, swapping or creating a variation, starting or finishing a workout, adding, editing or removing a set or intensifier) moves it to the top. A newly created day also starts at the top.
- Each row shows: the day's name (for example "Push Day"); a second line with the number of exercises ("4 exercises") and the date of the last completed workout of this day ("Last workout: 28 Oct 2026") or "No workouts yet".
- A button at the bottom of the list (or top-right of the header): "+ New day".

**Fields and controls:**
- Day rows (tappable).
- "+ New day" button.

**Actions:**
- Tap a day row → opens Day detail (3.3) for that day.
- Tap "+ New day" → opens Name Your Day (3.2) in create mode.

**This week:** at the top of the screen, above the list of days, once any workout is completed, a card "This week" shows Monday to Sunday as seven squares in the calendar's shades, with "2 workouts · last 28 Oct" beside the heading. Tapping it opens the Calendar.

**Empty state:** Until the first workout is finished, a "Getting started" card lists four steps (name a day, add exercises, start a workout and log sets, finish it), each ticked from the real data, with "1 of 4 done". Under it: "Common splits: Push day, Pull day, Leg day, Upper, Lower, Full body."

**Error state:** If reading from storage fails, show "Could not load your days." with a "Try again" button that re-runs the read. (Reason: storage failure is rare but should never show a blank screen that looks like data loss.)

**Technical:** On focus, query all `DayBasket` records ordered by: in-progress workout first, then `lastChangedAt` descending, where `lastChangedAt` is the latest `updatedAt` of the day, its exercises, its workouts and the sets in those workouts. Deleting an exercise stamps the day, and removing a set or intensifier stamps its workout, so deletions also count as changes. For each, count its `Exercise` records and find the latest `Workout` with `status = completed` (by `startedAt`) and whether one with `status = in_progress` exists.

---

### 3.2 Name Your Day (create and rename)

**Summary:** A small modal with a single text field titled "Name Your Day". It is used both to create a new day and to rename an existing one. After creating, the app goes straight to the new day so the user can start adding exercises.

**What the user sees:**
- Title: "Name Your Day" (create mode) or "Rename Day" (rename mode).
- One text field, placeholder "e.g. Push Day". In rename mode it is pre-filled with the current name.
- Two buttons: "Cancel" and "Save".

**Fields and controls:**
- Name field: single line text, keyboard opens automatically when the modal opens, maximum 40 characters (further typing is ignored).
- "Save" button: disabled while the trimmed name is empty.
- "Cancel" button.

**Actions:**
- Save (create mode) → creates the day, closes the modal, and opens Day detail (3.3) for the new day.
- Save (rename mode) → updates the name, closes the modal, returns to Day detail showing the new name.
- Pressing the keyboard's return key does the same as Save.
- Cancel → closes the modal; nothing is saved.

**Empty state:** Not applicable (the field itself is the content). Save stays disabled until at least one non-space character is typed.

**Error states:**
- Name already used by another day (comparison ignores upper/lower case and leading/trailing spaces): show "You already have a day called 'Push Day'." under the field and do not save. (Reason: two days with identical names would be indistinguishable in the list and the calendar.)
- Storage write fails: show "Could not save. Try again." under the field; the modal stays open with the typed text kept.

**Technical:** Create mode inserts a `DayBasket` with a new UUID, `name` (trimmed), `createdAt` and `updatedAt` set to now. Rename mode updates only `name` and `updatedAt`; the day's `id` does not change, so every exercise, variation and workout that references the day keeps working and the history is kept.

---

### 3.3 Day detail (exercise list)

**Summary:** Shows one day basket: its name, its exercises as a list, and the controls to start and finish a workout. From here the user adds exercises, opens an exercise to log sets, and renames or deletes the day.

**What the user sees:**
- Header: the day's name, plus a "⋯" (more) button at the top-right.
- A status line under the header:
  - No workout in progress: "Last workout: 28 Oct 2026" or "No workouts yet".
  - Workout in progress: "Workout in progress — started 18:05".
- The exercise list, one row per exercise, in the order added. Each row shows: the exercise name, and a second line with the currently selected variation's name (only when it differs from the exercise name) and, during a workout, how many sets have been logged for that exercise in this workout ("3 sets logged").
- A row-style button at the end of the list: "+ Add exercise".
- A primary button at the bottom: "Start workout" (no workout in progress) or "Finish workout" (workout in progress).

**Fields and controls:**
- Exercise rows (tappable).
- "+ Add exercise" button.
- "Start workout" / "Finish workout" button.
- "⋯" menu with three items: "Rename day", "Remove exercises", "Delete day".

**Actions:**
- Tap "+ Add exercise" → opens Add exercise (3.4). Allowed with or without a workout in progress.
- Tap "Start workout" → creates an in-progress workout for this day dated today; the status line and button update immediately.
- Tap an exercise row while a workout is in progress → opens Exercise logging (3.5) for that exercise.
- Tap an exercise row while no workout is in progress → opens Exercise history (3.11), read-only. No workout is started and nothing is written. (Reason: the user often wants to check what they lifted last time without starting a workout; workouts start only from the "Start workout" button.)
- Tap "Finish workout":
  - If at least one set row exists in this workout: mark the workout completed and show a confirmation banner at the top of the screen for 3 seconds: "Workout saved". The button returns to "Start workout".
  - If no set rows exist: show a dialog "No sets were logged. Save this as a workout with zero volume?" with "Save" and "Cancel". Save completes the workout (it will show on the calendar in the faintest shade); Cancel leaves it in progress.
- "⋯" → "Rename day" → opens Name Your Day (3.2) in rename mode.
- "⋯" → "Remove exercises" → each exercise row shows a red "Remove" button instead of the "›" arrow, and a "Done" button appears above the list. Tapping "Remove" shows: "Remove 'Bench press'? This permanently removes 1 variation and 6 logged sets (including past workouts, so their volume and calendar shade will change). This cannot be undone." Remove deletes the exercise; Cancel closes the dialog. "Done" returns the rows to normal. The menu item is disabled when the day has no exercises.
- "⋯" → "Delete day" → shows a confirmation dialog: "Delete 'Push Day'? This permanently removes its 4 exercises and 12 logged workouts. This cannot be undone." with "Delete" (destructive style) and "Cancel". Delete removes the day and everything belonging to it and returns to Home (3.1). Cancel closes the dialog.

**Summary card:** at the top of the list, a card shows either "In progress · started 18:05" with the workout's volume so far and "Sets so far" (the same count as the rows below), or "Last workout 28 Oct 2026" with that workout's volume, or "No workouts yet" with a dash.

**Empty state:** When the day has no exercises, the list area shows "No exercises yet. Add your first exercise." above the "+ Add exercise" button. "Start workout" remains enabled (a zero-volume workout is a valid settled case).

**Error states:**
- Storage read fails: "Could not load this day." with "Try again".
- Remove exercise fails: "Could not remove this exercise. Nothing was removed."
- Delete fails: "Could not delete this day. Nothing was removed." (the delete runs in a single transaction, so a failure leaves all data intact).

**Technical:**
- Data: the `DayBasket`, its `Exercise` records ordered by `position`, and the day's `Workout` with `status = in_progress` if any (at most one per day).
- Start workout inserts `Workout { id, dayId, date: today as local YYYY-MM-DD, startedAt: now, finishedAt: null, status: in_progress }`.
- Finish workout sets `status = completed`, `finishedAt = now`, and stores `totalVolume` computed as in section 5.7.
- Delete day runs one transaction that deletes, in order: `Set` and `Intensifier` records of the day's workouts, the day's `Workout` records, `Variation` records of the day's exercises, the day's `Exercise` records, then the `DayBasket`.

---

### 3.4 Add exercise

**Summary:** A modal with one text field. The user types an exercise name and saves; the exercise appears in the day's list, ready for sets, reps and weight to be logged.

**What the user sees:**
- Title: "Add Exercise".
- One text field, placeholder "e.g. Seated dumbbell curl".
- Buttons "Cancel" and "Add".

**Fields and controls:**
- Name field: single line, keyboard opens automatically, maximum 60 characters.
- "Add" button: disabled while the trimmed name is empty.
- "Cancel".

**Actions:**
- Add (or keyboard return) → creates the exercise and its first variation, closes the modal, and returns to Day detail with the new exercise at the bottom of the list.
- Cancel → closes; nothing saved.

**Empty state:** Not applicable; Add stays disabled until text is entered.

**Error states:**
- Name already used by another exercise in this day (case- and space-insensitive): "This day already has an exercise called 'Bench press'." Not saved.
- Storage write fails: "Could not save. Try again."; modal stays open with text kept.

**Technical:** In one transaction insert `Exercise { id, dayId, name, position: (max position in day) + 1, createdAt }` and `Variation { id, exerciseId, name: same as exercise name, createdAt }`, then set `Exercise.defaultVariationId` to the new variation's id. (Reason: every exercise must always have at least one variation so that sets have something to attach to; using the typed name as the first variation means the user does not have to think about variations until they need one.) Sets, reps and weight fields appear on the logging screen (3.5), not as stored fields on the exercise.

---

### 3.5 Exercise logging

**Summary:** The screen where the user records what they lift. It shows the current variation of the exercise, what they did last time on that variation, and a list of set rows with reps and weight fields. Each set can have intensifiers attached (drop set, partial reps, superset), which appear as indented rows under it. A "Swap variation" button lets the user change variation without losing anything already logged.

**What the user sees, top to bottom:**
1. Header: the exercise name.
2. Variation line: "Variation: Seated dumbbell curl" with a "Swap" button next to it.
3. "Last time" line for the selected variation, read-only: "Last time (21 Oct): 10 × 20 kg, 10 × 20 kg, 8 × 20 kg". If this variation has no completed history: "No history for this variation yet". (Reason: the user's notes require the app to remember progression for all variations; this line is how that memory is shown.)
4. "Also logged this workout" line, shown only if other variations of this exercise already have sets in the current workout: "Also logged this workout: Standing cable curl (2 sets)". Tapping it switches the selected variation back to that one (same effect as choosing it in the swap screen).
5. The set list for the selected variation in this workout. Each normal set is a row:
   - Label "Set 1", "Set 2", … (numbered by order among normal sets of this variation in this workout).
   - "Reps" field (number).
   - "kg" field (number).
   - "+ Intensifier" button.
   - "Remove" button (icon or text).
   Under each normal set, its intensifier rows are shown indented, in the order added:
   - Drop set row: label "Drop", "Reps" field, "kg" field, "Remove".
   - Partial reps row: label "Partials", "Reps" field, and read-only text showing the parent set's weight ("@ 20 kg", or "@ — kg" if the parent weight is empty), "Remove". There is no weight field.
   - Superset row: label "Superset: Triceps pushdown" (the partner exercise's name, plus its variation name in brackets if it differs), "Reps" field, "kg" field, "Remove".
   - Superset partner sets that were started from another exercise (see below) appear in this exercise's list as normal-looking rows labelled "Superset with Bicep curl, Set 2", with "Reps" and "kg" fields, so they can be edited from either side.
6. "+ Add set" button at the end of the list.

**Fields and controls:**
- Reps fields: numeric keypad, whole numbers 0–999.
- Weight (kg) fields: decimal keypad, numbers 0–9999 with at most 2 decimal places.
- "Swap" button, "+ Intensifier" button per normal set, "Remove" button per row, "+ Add set" button, "Also logged this workout" link.
- Back navigation returns to Day detail.

**Actions:**
- "+ Add set" → appends a new empty normal set row for the selected variation. The new row's Reps field gets focus.
- Focusing a field while the keyboard is open, or opening the keyboard → the screen scrolls so the field sits just above the keyboard, and extra space equal to the keyboard's height is added at the end of the list so every row can be scrolled into view. (Reason: on Android the app is drawn edge to edge, so the keyboard otherwise covers the lower fields.)
- Typing in a field → the value is saved to storage within 500 ms of the last keystroke, and again when the field loses focus or the user leaves the screen. (Reason: the prototype must survive an app restart at any moment, including mid-workout.)
- "+ Intensifier" → opens the Intensifier picker (3.6) for that set.
- "Remove" on a normal set → removes the set and every intensifier row attached to it, after a confirmation "Remove Set 2 and its 1 intensifier?" when it has intensifiers; with no intensifiers it is removed immediately. Remaining sets renumber.
- "Remove" on an intensifier row → removes that row only, immediately.
- "Swap" → opens Variation swap (3.7).
- Tap "Also logged this workout" → switches to that variation; its sets from this workout reappear.

**Empty state:** When the selected variation has no sets in this workout, the set list shows one empty normal set row already created (Set 1, empty fields). (Reason: the user's notes say a newly typed exercise is "created with Sets and Reps fields", so fields should be visible immediately.) This auto-created row is only created when the screen is opened, not on every swap back; after a swap the settled rule applies (see 3.7).

**Error states:**
- A value outside the allowed range or not a number (for example pasted text): the field shows a red outline and the message "Enter a whole number from 0 to 999" (reps) or "Enter a number from 0 to 9999" (weight) directly under the row; the invalid value is not saved, and the last valid value (or empty) remains in storage.
- Empty fields are allowed and are stored as empty (null). They count as 0 in volume (section 5.7).
- Storage write fails: a line at the top of the screen "Last change was not saved. Try again." with a "Retry" button that re-sends the pending writes.

**Technical:**
- Screen state: `workoutId` (the day's in-progress workout), `exerciseId`, `selectedVariationId`.
- On open, `selectedVariationId` = the variation recorded for this exercise in `Workout.selectedVariations` if present, otherwise `Exercise.defaultVariationId`.
- The set list shows `Set` records where `workoutId = current` and `variationId = selectedVariationId` and `intensifierId = null`, ordered by `position`, each followed by its `Intensifier` records (ordered by `position`) and each intensifier's child `Set`. Superset partner sets from other exercises are child sets whose `variationId` belongs to this exercise; show them as described above.
- "Last time" = sets of the most recent completed workout that contains at least one set with `variationId = selectedVariationId`, listing that variation's normal sets as "reps × weight kg" (empty values shown as "—").
- Only workouts with `status = in_progress` can be edited. Completed workouts are read-only (see section 9).

---

**Last time beside each set (added in the restyle):** each normal set's card shows, at its top right, the set with the same number from the last completed workout on this variation ("Last 10 × 60 kg"), so the comparison sits beside the fields being filled in. The variation card then shows only "Last done 21 Oct · 3 sets". Each field has its label above it ("Reps", "Weight (kg)").

### 3.6 Intensifier picker

**Summary:** A small list that appears when the user taps "+ Intensifier" on a set. It offers exactly three choices — Drop set, Partial reps and Superset. Choosing one adds an indented row under that set.

**What the user sees:**
- Title: "Add intensifier to Set 2".
- Three rows, each with a one-line explanation:
  - "Drop set — lower the weight and keep going"
  - "Partial reps — extra short-range reps at the same weight"
  - "Superset — pair this set with a set of another exercise"
- "Cancel".

**Actions:**
- Drop set → closes the picker and adds an indented Drop row (empty Reps and kg) under the parent set. Reps field gets focus.
- Partial reps → closes and adds an indented Partials row (empty Reps, weight shown from the parent set).
- Superset → replaces the list with "Choose the other exercise": a list of every other exercise in the same day (each row showing the exercise name and its currently selected variation). Tapping one closes the picker and adds an indented Superset row (empty Reps and kg) bound to that exercise's currently selected variation.
- Cancel → closes; nothing added.

**Empty and error states:**
- Superset chosen but the day has only this one exercise: the partner list shows "Add a second exercise to this day to make a superset." with an "Add exercise" button that opens Add exercise (3.4) and, after the exercise is added, returns to the partner list with it shown.
- Superset chosen but this set already has a superset row: the Superset choice is shown disabled with the text "This set already has a superset". (Reason: the settled definition is that a superset combines exactly two exercises, so one set has at most one partner.)
- Intensifiers can only be attached to normal sets. The "+ Intensifier" button does not appear on intensifier rows or on superset partner rows. (Reason: the settled rule is that a drop set attaches to a normal set; attaching intensifiers to intensifiers would make the parent of a partial rep ambiguous.)
- Storage write fails: "Could not add. Try again." in the picker; nothing is added.

**Technical:** Each choice inserts, in one transaction, one `Intensifier { id, workoutId, type, parentSetId, partnerExerciseId (superset only), position }` and its one child `Set { id, workoutId, variationId, intensifierId, reps: null, weight: null, position: 0 }`.
- Drop: child `variationId` = parent set's variation; child stores reps and weight.
- Partial: child `variationId` = parent set's variation; child stores reps; child `weight` is always null, and the effective weight is read from the parent set whenever it is shown or used in volume. (Reason: the settled rule says partial reps use the same weight as their parent set, so if the user later corrects the parent weight, the partial row follows automatically.)
- Superset: child `variationId` = partner exercise's selected variation in this workout (from `Workout.selectedVariations`, else its `defaultVariationId`); child stores its own reps and weight.
- A normal set may have any number of drop and partial rows and at most one superset row.

---

### 3.7 Variation swap (with create on the spot)

**Summary:** While logging, the user can switch to another variation of the same exercise, for example from seated dumbbell curls to standing cable curls because the dumbbells are taken. Sets already logged stay with the original variation; the new variation starts with empty set fields. If none of the saved variations fits the equipment available, the user types a new variation name right here and it is selected immediately.

**What the user sees:**
- Title: "Swap variation — Bicep curl".
- A vertical list of every variation of this exercise, in the order they were created. Each row shows: the variation name; a second line "Last done 21 Oct 2026" or "Never done"; a check mark on the currently selected variation.
- At the end of the list: a text field with placeholder "New variation, e.g. Standing cable curl" and an "Add" button.
- "Cancel".

**Actions:**
- Tap a variation row (not the current one) → closes the screen and returns to Exercise logging with that variation selected. The sets already logged on the previous variation remain stored on it and are listed in the "Also logged this workout" line. If the chosen variation has no sets in this workout, its set list shows no rows, and the user taps "+ Add set" to start. If it already has sets in this workout (the user is swapping back), those sets are shown.
- Tap the current variation → closes the screen; nothing changes.
- Type a name and tap "Add" (or keyboard return) → creates the variation, closes the screen and returns to Exercise logging with the new variation selected and an empty set list.
- Cancel → closes; nothing changes.

**Empty state:** An exercise always has at least one variation, so the list is never empty. When it has only one, the list shows that one with its check mark and the text "No other variations yet. Add one below." above the text field.

**Error states:**
- New name empty: "Add" disabled.
- New name matches an existing variation of this exercise (case- and space-insensitive): "This variation already exists." under the field; nothing created. The user can tap the existing row instead.
- Name longer than 60 characters: further typing is ignored.
- Storage write fails: "Could not save. Try again."; the screen stays open with text kept.

**Technical:**
- Swapping does not move, copy or delete any `Set`. It writes `Workout.selectedVariations[exerciseId] = newVariationId` and `Exercise.defaultVariationId = newVariationId` (so the next workout opens on the variation used most recently), then the logging screen re-queries sets for the new `selectedVariationId`.
- "Create on the spot" inserts `Variation { id, exerciseId, name, createdAt }` and then performs the swap above, in one transaction.
- Superset rows already logged with this exercise as the partner keep their original `variationId`; a swap affects only sets added afterwards.
- Progression for every variation is kept because each `Set` permanently stores the `variationId` it was logged on; "Last time" and "Last done" are calculated per variation.

---

### 3.8 Calendar

**Summary:** One month at a time, laid out as a normal month calendar, with each day drawn as a GitHub-style shaded square. A date with a completed workout is shaded; the bigger the increase in that workout's volume compared with the previous workout of the same day, the stronger the shade. Arrow buttons move between months, and tapping a day shows its details.

**What the user sees:**
- Title: "Calendar".
- A month header: "‹" button, the month and year ("October 2026") with the number of days that have a workout underneath ("3 workout days" or "No workouts"), and a "›" button.
- Weekday labels M T W T F S S (Monday first), then the month's days as rounded squares in rows of seven, each showing its day number. Days before the 1st and after the last day of the month are blank. Today's number is bold.
- Days after today are shown faded, with no shade, and cannot be tapped.
- The app opens on the current month.
- A legend under the grid: "Less" followed by the six shade squares in order (no workout, zero volume, level 1–4) followed by "More".
- A detail area under the legend, initially showing "Tap a square to see that day."

**Fields and controls:**
- Each day square up to today is tappable.
- "‹" (Previous month) and "›" (Next month).

**Actions:**
- Tap a square with a completed workout → the detail area shows, for each completed workout on that date (newest first): the day basket's current name, total volume (for example "Volume: 4,250"), the change versus the previous workout of the same day ("+18% vs 21 Oct", "First workout — counted as +100%", "Zero volume", or "−12% vs 21 Oct"), and the shade level name ("Level 1"…"Level 4" or "Zero volume").
- Tap a square with no workout → the detail area shows the date and "No workout logged".
- The selected square is outlined.
- "‹" → shows the previous month and clears the selection. Disabled in the month of the first completed workout (or the current month when there are none).
- "›" → shows the next month and clears the selection. Disabled in the current month.

**Empty state:** No completed workouts at all: the current month is shown with every square in the "no workout" shade, both arrows are disabled, and the detail area reads "No workouts logged yet. Finish a workout to see it here."

**Error state:** Storage read fails: "Could not load the calendar." with "Try again".

**Technical:**
- On focus, load all `Workout` records with `status = completed`, compute each one's percentage change and shade level using sections 5.7–5.8 and 7, and group them by `date`. The grid redraws every time the Calendar tab gains focus, so a workout finished on Day detail is visible as soon as the user opens the Calendar tab, and a deleted day's squares disappear the same way.
- Percentage changes are computed on read rather than stored. (Reason: deleting a day removes workouts, and computing on read guarantees the remaining shades are always consistent with the data that exists.)
- When one date has more than one completed workout, the square uses the darkest shade among them (see section 9).

---

### 3.9 Nutrition (placeholder)

**Summary:** A single tab with a short message. Nutrition tracking comes in a later phase, after the workout prototype works.

**What the user sees:** Title "Nutrition" and the text "Nutrition tracking is coming in a later version." No fields, controls or actions.

**Empty and error states:** None; the screen has no data.

**Technical:** A static screen with no storage access.

---

### 3.10 More (settings)

**Summary:** A settings screen with two pill toggles: Theme (Light / Dark) and Weight (kg / lb). Both take effect immediately on every screen and are remembered after a restart. Switching the unit changes how weights are shown and typed; it never changes stored data.

**What the user sees:** Large title "More"; a card "Theme" with a Light | Dark pill toggle; a card "Weight" with a kg | lb pill toggle and the note "Switching converts every weight you see, including past workouts. Your logged data is not changed."

**Your data:** a third card shows counts of days, exercises, completed workouts and sets logged in them, with "Stored only on this phone. Nothing is uploaded."

**Empty and error states:** None. If saving a setting fails, the change still applies for this session and a warning is logged.

**Technical:**
- Settings are stored in the `settings` record (5.9) and loaded before the first screen renders, so the app never flashes the wrong theme. Until the user picks a theme, the phone's system appearance is used.
- Weights are stored in kg. Display value = kg ÷ 0.45359237 for lb, rounded to 2 decimals; a value typed in lb is stored as value × 0.45359237 at full precision, so it shows back exactly as typed. Volumes are computed in kg and converted for display, so percentage changes and shades do not depend on the unit.
- Field labels, placeholders, "Last time", partial-reps "@ … lb" text and calendar volumes all use the chosen unit.

### 3.11 Exercise history (read-only)

**Summary:** Opened by tapping an exercise when no workout is in progress. It shows what was lifted on that exercise in recent workouts, so the user can check last week's numbers without starting a workout. Nothing on this screen changes data.

**What the user sees:**
- Header: the exercise name.
- When the exercise has more than one variation: a row of pill chips, one per variation, with the current variation selected. Tapping a chip shows that variation's history; it does not change which variation the next workout opens on.
- Up to the 5 most recent completed workouts that logged sets on the selected variation, newest first. Each is a card with the date ("23 Oct 2026"), the volume of that variation in that workout ("Volume 920 kg", superset partner rows excluded because they belong to the other exercise), and each set ("Set 1   10 × 60 kg") followed by its intensifier rows, indented with the intensifier's colour ("Drop  8 × 40 kg", "Partials  4 @ 60 kg", "Superset: Triceps pushdown  12 × 25 kg").
- A closing hint: "To log sets, tap Start workout on the day screen."

**Empty state:** "No logged workouts for this variation yet."

**Error state:** "Could not load this exercise." with "Try again".

**Technical:** Reads only. Uses the same set-and-intensifier query as the logging screen (5.5, 5.6) for each listed workout; weights are shown in the chosen unit (3.10).

---

## 4. User flows

Each flow starts from a freshly opened app on the Workouts tab unless stated otherwise. "Expected end state" describes what a tester can check on screen and, where relevant, after force-closing and reopening the app.

### 4.1 Create a named day

1. On Home (3.1), tap "+ New day".
2. The "Name Your Day" modal opens with the keyboard showing.
3. Type "Push Day".
4. Tap "Save".
5. The modal closes and Day detail opens for "Push Day".

**Expected end state:** Day detail shows the header "Push Day", the status line "No workouts yet", the text "No exercises yet. Add your first exercise.", and the "+ Add exercise" and "Start workout" buttons. Going back to Home shows a row "Push Day — 0 exercises — No workouts yet". After force-closing and reopening the app, the row is still there.

### 4.2 Add a new exercise by typing its name

1. On Home, tap "Push Day".
2. On Day detail, tap "+ Add exercise".
3. Type "Bench press" and tap "Add".
4. The modal closes; "Bench press" appears as the last row of the exercise list.
5. Repeat steps 2–3 with "Triceps pushdown".

**Expected end state:** The exercise list shows "Bench press" then "Triceps pushdown". Each has one variation with the same name (visible later in the swap screen). Home shows "Push Day — 2 exercises". Trying to add "bench press" again shows "This day already has an exercise called 'bench press'." and nothing is added. Data remains after a restart.

### 4.3 Log a workout including a drop set, partial reps and a superset

Precondition: "Push Day" contains "Bench press" and "Triceps pushdown" and no workout is in progress.

1. On Day detail for "Push Day", tap "Start workout". The status line changes to "Workout in progress — started HH:MM" and the button changes to "Finish workout".
2. Tap "Bench press". Exercise logging opens with "Variation: Bench press", "No history for this variation yet", and one empty row "Set 1".
3. In Set 1, enter Reps 10, kg 60.
4. Tap "+ Add set"; in Set 2 enter Reps 8, kg 60.
5. On Set 2, tap "+ Intensifier" → "Drop set". An indented "Drop" row appears under Set 2. Enter Reps 6, kg 40.
6. On Set 2, tap "+ Intensifier" → "Partial reps". An indented "Partials" row appears under the Drop row, showing "@ 60 kg". Enter Reps 4.
7. On Set 1, tap "+ Intensifier" → "Superset" → choose "Triceps pushdown". An indented "Superset: Triceps pushdown" row appears under Set 1. Enter Reps 12, kg 25.
8. Go back to Day detail. "Bench press" shows "2 sets logged"; "Triceps pushdown" shows "1 set logged".
9. Tap "Triceps pushdown". Its logging screen shows a row "Superset with Bench press, Set 1" with Reps 12 and kg 25.
10. Go back and tap "Finish workout". The banner "Workout saved" appears; the status line shows "Last workout: <today>"; the button reads "Start workout".

**Expected end state:** The workout is completed with volume **1,860**, calculated as: Set 1 10 × 60 = 600; Set 2 8 × 60 = 480; Drop 6 × 40 = 240; Partials 4 × 60 (parent weight) = 240; Superset partner 12 × 25 = 300 → 600 + 480 + 240 + 240 + 300 = 1,860. The Calendar tab shows today's square at Level 4 (first workout counts as +100%), and tapping it shows "Push Day — Volume: 1,860 — First workout — counted as +100% — Level 4". Starting a new workout and opening "Bench press" shows "Last time (<today>): 10 × 60 kg, 8 × 60 kg". All values remain after a force-close and reopen, including if the app is closed between steps 3 and 10 (the in-progress workout and its rows reappear, and Day detail shows "Finish workout").

### 4.4 Swap to a different variation mid-workout and create a new variation on the spot

Precondition: "Arm Day" contains the exercise "Bicep curl", whose variations are "Seated dumbbell curl" (selected) and "Standing cable curl". No workout is in progress.

1. On Day detail for "Arm Day", tap "Start workout", then tap "Bicep curl".
2. Logging shows "Variation: Seated dumbbell curl". Enter Set 1: Reps 10, kg 12. Tap "+ Add set"; enter Set 2: Reps 10, kg 12.
3. The dumbbells are now taken. Tap "Swap". The swap screen lists "Seated dumbbell curl" (checked, "Last done …" or "Never done") and "Standing cable curl".
4. Tap "Standing cable curl". Logging returns showing "Variation: Standing cable curl", the line "Also logged this workout: Seated dumbbell curl (2 sets)", and no set rows.
5. Tap "+ Add set"; enter Set 1: Reps 12, kg 20.
6. The cable machine is also busy and there is no other matching equipment. Tap "Swap", type "Resistance band curl" in the new-variation field, tap "Add".
7. Logging returns showing "Variation: Resistance band curl", "No history for this variation yet", "Also logged this workout: Seated dumbbell curl (2 sets), Standing cable curl (1 set)", and no set rows.
8. Tap "+ Add set"; enter Set 1: Reps 15, kg 5.
9. Go back and tap "Finish workout".

**Expected end state:** The completed workout holds 2 sets on "Seated dumbbell curl" (10 × 12, 10 × 12), 1 set on "Standing cable curl" (12 × 20) and 1 set on "Resistance band curl" (15 × 5); total volume (120 + 120) + 240 + 75 = 555. Opening the swap screen in a later workout lists all three variations with "Last done <today>". Starting a new workout and opening "Bicep curl" opens on "Resistance band curl" (the last selected) with "Last time (<today>): 15 × 5 kg"; swapping to "Seated dumbbell curl" shows "Last time (<today>): 10 × 12 kg, 10 × 12 kg". Everything remains after a restart.

### 4.5 Rename a day

Precondition: "Push Day" exists and has at least one completed workout.

1. On Day detail for "Push Day", tap "⋯" → "Rename day".
2. The "Rename Day" modal opens with "Push Day" in the field.
3. Replace the text with "Chest & Shoulders" and tap "Save".

**Expected end state:** Day detail's header reads "Chest & Shoulders"; its exercises and "Last workout" date are unchanged. Home lists "Chest & Shoulders" in the same position. On the Calendar, the existing squares keep the same shades, and tapping one shows "Chest & Shoulders" as the day name. Starting a new workout and opening an exercise still shows its "Last time" sets from before the rename. All of this remains after a restart.

### 4.6 Delete a day

Precondition: "Leg Day" exists with 2 exercises and 3 completed workouts, and "Push Day" also exists with completed workouts.

1. On Day detail for "Leg Day", tap "⋯" → "Delete day".
2. The dialog reads "Delete 'Leg Day'? This permanently removes its 2 exercises and 3 logged workouts. This cannot be undone."
3. Tap "Delete".

**Expected end state:** The app returns to Home, where "Leg Day" no longer appears and "Push Day" is unchanged. On the Calendar, squares that held only Leg Day workouts now show the "no workout" shade; squares with Push Day workouts keep their previous shades (Push Day's percentages compare only against Push Day workouts, so they are unaffected). Creating a new day called "Leg Day" starts with no exercises and "No workouts yet". After a restart, none of the deleted data reappears. If step 3 is replaced by "Cancel", nothing changes.

### 4.7 Open the calendar and read a day's shade

Precondition: "Push Day" has three completed workouts: 14 Oct volume 1,000; 21 Oct volume 1,200; 28 Oct volume 2,500. Also, on 30 Oct a "Push Day" workout was finished with no values entered (volume 0).

1. Tap the "Calendar" tab.
2. The calendar shows October 2026 ("4 workout days"); the squares for 14, 21, 28 and 30 Oct are shaded. Tapping "‹" shows September 2026 only if a workout exists in or before September; here it is disabled.
3. Tap the 14 Oct square.
4. Tap the 21 Oct square.
5. Tap the 28 Oct square.
6. Tap the 30 Oct square.

**Expected end state:**
- 14 Oct: "Push Day — Volume: 1,000 — First workout — counted as +100% — Level 4"; darkest shade.
- 21 Oct: "Volume: 1,200 — +20% vs 14 Oct — Level 1"; lightest non-zero shade.
- 28 Oct: "Volume: 2,500 — +108% vs 21 Oct — Level 4"; darkest shade. (2,500 − 1,200 = 1,300; 1,300 ÷ 1,200 × 100 = 108.3%.)
- 30 Oct: "Volume: 0 — Zero volume"; faintest shade, lighter than Level 1 but visibly different from the "no workout" shade.
- Each tapped square is outlined, and the shades match the legend order.

---

## 5. Data model

**Summary:** The app stores six main kinds of record: day baskets, exercises, variations, workouts (the workout log), sets and intensifiers. A day holds exercises; an exercise holds variations; a workout belongs to a day and contains sets; every set remembers exactly which variation it was done on; and an intensifier joins an extra set to the normal set it belongs to. Volume and percentage change are calculated from these records whenever they are needed.

The record shapes below are loose descriptions, not a schema. Every record has an `id` (a UUID string generated on the phone with `expo-crypto`'s `randomUUID()`), `createdAt` and `updatedAt` (ISO 8601 timestamps). These common fields are not repeated below. (Reason: UUIDs created on the phone stay unique if a cloud backup is added later, so no ids need rewriting.)

### 5.1 DayBasket

- `name` — text, 1–40 characters, unique per user ignoring case and outer spaces.

Relation: a DayBasket has many Exercises and many Workouts; deleting it deletes all of them and everything that belongs to them.

### 5.2 Exercise

- `dayId` — the DayBasket it belongs to.
- `name` — text, 1–60 characters, unique within its day ignoring case and outer spaces.
- `position` — whole number giving list order within the day.
- `defaultVariationId` — the variation the logging screen opens on when a workout has no selection recorded for this exercise; updated on every swap.

Relation: an Exercise belongs to exactly one DayBasket and has one or more Variations.

### 5.3 Variation

- `exerciseId` — the Exercise it belongs to.
- `name` — text, 1–60 characters, unique within its exercise ignoring case and outer spaces.

Relation: a Variation belongs to exactly one Exercise, and every Set records the Variation it was performed on, which is how progression is kept for each variation separately.

Deleting an Exercise (3.3 "Remove exercises") deletes, in one transaction: intensifiers attached to its sets and superset intensifiers that paired with it (with their child sets), every set logged on its variations, its variations, then the exercise. Volumes are computed on read, so past workouts and the calendar reflect the removal immediately.

### 5.4 Workout (workout log)

- `dayId` — the DayBasket this workout was for.
- `date` — local calendar date (`YYYY-MM-DD`) of `startedAt`; this is the calendar square it appears on, even if it is finished after midnight.
- `startedAt`, `finishedAt` — timestamps; `finishedAt` is empty while in progress.
- `status` — `in_progress` or `completed`. At most one `in_progress` workout per DayBasket.
- `selectedVariations` — a map of `exerciseId → variationId` recording which variation is currently selected for each exercise in this workout, so the logging screen restores the right variation after a restart.
- `totalVolume` — number, written when the workout is completed (section 5.7); may be recomputed at any time from its sets.

Relation: a Workout belongs to exactly one DayBasket and has many Sets and Intensifiers; only `completed` workouts appear on the calendar and in "Last time".

### 5.5 Set

- `workoutId` — the Workout it was logged in.
- `variationId` — the Variation it was performed on. Never changed by a swap.
- `intensifierId` — empty for a normal set; for an intensifier row, the Intensifier it belongs to.
- `position` — order among normal sets of the same variation in the same workout (used for "Set 1, Set 2" numbering).
- `reps` — whole number 0–999, or empty.
- `weight` — number in kg, or empty; always empty for a partial reps row. The 0–9999, 2-decimal limit applies to the value typed in the chosen unit.

Relation: a Set belongs to one Workout and one Variation; a normal Set can be the parent of many Intensifiers, and an intensifier row Set belongs to exactly one Intensifier.

### 5.6 Intensifier

- `workoutId` — the Workout it belongs to.
- `type` — exactly one of `drop`, `partial`, `superset`.
- `parentSetId` — the normal Set it is attached to.
- `partnerExerciseId` — for `superset` only, the second exercise.
- `position` — order among intensifiers of the same parent set.

Relation: an Intensifier attaches to exactly one normal Set (its parent) and owns exactly one child Set (its row's values); deleting the parent Set deletes its Intensifiers and their child Sets.

| Type | Child set's variation | Child set stores | Weight used |
|---|---|---|---|
| `drop` | same as parent | reps, weight | child's own weight |
| `partial` | same as parent | reps only | parent set's weight, read at the time of use |
| `superset` | partner exercise's selected variation | reps, weight | child's own weight |

### 5.7 Computing a workout's volume

**Summary:** A workout's volume is the total of weight × reps over every set in it, including drop set, partial reps and superset rows. Empty fields count as zero.

**Technical, step by step:**
1. Collect every `Set` with `workoutId` = the workout, including intensifier child sets.
2. For each set, take `reps`; if empty, use 0.
3. For each set, find its weight:
   - If it is the child of a `partial` intensifier, use the parent set's `weight`.
   - Otherwise use its own `weight`.
   - If the weight is empty, use 0.
4. Set volume = reps × weight.
5. Workout volume = the sum of all set volumes. A workout with no sets, or whose sets are all empty or zero, has volume 0.

Worked example: sets 10 × 60 and 8 × 60, a drop row 6 × 40 on the second set, a partial row of 4 reps on the second set (parent weight 60), and a superset row 12 × 25 → 600 + 480 + 240 + 240 + 300 = **1,860**.

Note for bodyweight exercises (for example push-ups) logged with weight empty or 0: their volume is 0 under this rule (see section 9).

### 5.8 Computing the percentage change versus the previous workout

**Summary:** Each completed workout is compared with the previous completed workout of the same day basket. The change is the difference in volume as a percentage of the previous volume. The first workout of a day counts as a 100% change, and a workout with zero volume is always shown in the faintest shade regardless of the number.

**Technical, step by step,** for a completed workout W of day D:
1. Compute `V` = volume of W (section 5.7).
2. If `V = 0`: W's result is **zero volume**. Stop. (This applies even if the previous workout had volume, and even if W is the first workout. Reason: the settled rule says a logged workout with no weight or reps shows the faintest, lowest shade.)
3. Find `P` = the completed workout of D with the latest `startedAt` that is earlier than W's `startedAt`. Workouts of other days are ignored (see section 9).
4. If there is no `P`: W is the first workout of D, and its percentage change is **100%**. Stop.
5. Compute `Vp` = volume of P.
6. If `Vp = 0`: the percentage change is **100%** (treated like a first workout, because dividing by zero is undefined; see section 9). Stop.
7. Otherwise: percentage change = `(V − Vp) ÷ Vp × 100`. The result may be negative. Do not round before choosing the shade; display it rounded to the nearest whole number with a sign ("+18%", "−12%").

Examples: Vp 1,000, V 1,200 → +20%. Vp 1,200, V 2,500 → +108.3%. Vp 1,000, V 900 → −10%. V 0 → zero volume.

---

### 5.9 Settings

- `key` — `theme` or `unit`.
- `value` — `light` / `dark`, or `kg` / `lb`.

Relation: settings are global to the app and link to no other record. Added in schema version 2; the upgrade only creates this table and keeps all existing data.

---

## 6. Storage and persistence

**Summary:** All data is stored in a small database file on the phone, so it is still there after the app is closed, the phone restarts, or the developer reloads the app. Every change is written as it happens, not only when a workout is finished, so nothing is lost if the app is closed mid-workout. A cloud backup can be added later without changing the records.

**Technical:**
- **Storage option:** use `expo-sqlite`. It fits because the data is a set of linked records (days → exercises → variations, workouts → sets → intensifiers) that need related-record queries and all-or-nothing deletes, which a relational on-device database provides directly and which a key-value store such as AsyncStorage would have to re-implement by hand.
- **Location:** a single database file in the app's private storage, opened once at app start with `openDatabaseAsync('workout-tracker.db')`. The file persists across app restarts, phone restarts and Expo reloads; it is removed only if the app is uninstalled or its data is cleared.
- **Setup:** on first open, create the tables if they do not exist and store a schema version number (start at 1) so later versions can migrate the data. Turn on foreign keys (`PRAGMA foreign_keys = ON`).
- **Write timing:** creates, renames, deletes, swaps, and intensifier additions are written immediately when the user taps the control. Reps and weight edits are written within 500 ms of the last keystroke, on field blur, and when leaving the screen. A screen shows a value only after reading it from storage or after the write succeeds, so the screen never shows data that is not stored.
- **Transactions:** multi-record actions (add exercise with its first variation, create variation and swap, add intensifier with its child set, delete set with its intensifiers, delete day with everything under it) each run in one transaction, so a failure leaves no half-written data.
- **Restoring after restart:** nothing is kept only in memory. On launch the app reads everything from the database; an in-progress workout is restored from its `Workout` record (`status = in_progress`), its sets, and `selectedVariations`. Navigation position is not restored; the app opens on Home, and Day detail shows "Finish workout" for the day with a workout in progress.
- **Repository layer:** all reads and writes go through one module (for example `src/data/repository.ts`) with functions such as `createDay`, `renameDay`, `deleteDay`, `addExercise`, `addVariation`, `startWorkout`, `finishWorkout`, `addSet`, `updateSet`, `removeSet`, `addIntensifier`, `swapVariation`, `getCalendarData`. Screens never write SQL directly. (Reason: this keeps the data model independent of the storage engine.)
- **Where a cloud backup would slot in later (not built now):** a backup would be a second implementation behind the same repository layer, or a separate sync step that reads all records and uploads them. Because every record already has a phone-generated UUID and `createdAt` / `updatedAt` timestamps, records can be uploaded, compared and restored without changing their fields or ids. No backup code, server, or account is part of this prototype.

---

## 7. Calendar shading

**Summary:** Each completed workout gets one of five shade levels from its percentage change versus the previous workout of the same day. Bigger increases are darker. The first workout of a day counts as +100% (darkest), and a zero-volume workout gets the faintest shade. Dates with no workout show a neutral empty square.

**Technical — the rule:** compute the result for the workout using section 5.8, then choose the level from this table, checking rows from top to bottom and using the first that matches. `p` is the unrounded percentage change.

| Level | Condition | Shade |
|---|---|---|
| No workout | No completed workout on this date | Neutral empty square (not part of the progress scale) |
| Zero volume | Workout volume is 0 | Faintest shade of the progress colour |
| Level 1 | `p < 25` (this includes any decrease, that is negative `p`) | Light |
| Level 2 | `25 ≤ p < 50` | Medium |
| Level 3 | `50 ≤ p < 100` | Dark |
| Level 4 | `p ≥ 100` (includes the first workout of a day, counted as 100) | Darkest |

**Rules for drawing:**
- Use one progress colour in five steps from faintest (zero volume) to darkest (Level 4), plus a separate neutral colour for "no workout". The exact colour values are left to the builder; the only requirements are that each of the six shades is visibly different from its neighbours and that they get darker in the order of the table.
- In the dark theme the scale runs from dim to bright green instead (the brightest square is Level 4), because "more intense" reads as brighter on a dark background. The level order and bands are unchanged.
- Band edges are exact: 24.9% is Level 1, 25% is Level 2, 49.9% is Level 2, 50% is Level 3, 99.9% is Level 3, 100% is Level 4.
- If one date has several completed workouts, the square shows the darkest level among them, and the detail area lists each one (see section 9).
- Shades are recomputed every time the Calendar gains focus, so finishing, renaming or deleting is reflected the next time the Calendar is shown.

---

## 8. Out of scope

The prototype must not include the following. Each is excluded for the reason given.

| Excluded | Reason |
|---|---|
| Any nutrition feature beyond the single placeholder screen (food logging, calories, macros, targets) | Nutrition is a later phase, to be discussed after the workout prototype works. |
| Backend services, servers, cloud sync or a built cloud backup | Data lives on the phone for the prototype; section 6 only describes where a backup would fit later. |
| User accounts, login, sign-up, passwords | Not needed for on-device data and adds work that does not prove the workout loop. |
| Billing, subscriptions, payments, ads | Not part of proving the prototype. |
| Polished visual design beyond the light/dark palettes (custom fonts, logo, animations) | The prototype proves behaviour first; layout follows the reference screenshots loosely. |
| A built-in exercise library or preset exercise lists | The user creates exercises by typing a name; presets were not requested. |
| Intensifiers other than drop set, partial reps and superset, or user-defined intensifier types | The settled decision is exactly three intensifiers. |
| Rest timers, workout timers, reminders, notifications | Not requested. |
| Charts, graphs, statistics screens or best-lift tracking beyond the calendar and the "Last time" line | Not requested; the calendar is the requested progress view. |
| Workout templates, planned sets or rep targets | Not requested. |
| Data export or import, sharing, social features | Not requested. |
| Reordering days or exercises by drag and drop | Not requested; lists use creation order. |
| A web version | The fixed stack targets Android and iPhone. |
| Writing the app code in this document | This document is the specification only; Claude Code builds the code from it. |

---

## 9. Open questions

The brief left the points below undecided. The provisional defaults were reviewed with the user on 2026-10-30 and kept, so each is now a confirmed decision for the prototype and the rest of this spec already follows it. They are kept here so a later phase can revisit them.

### 9.1 Confirmed defaults

1. "The previous logged workout" for percentage change means the previous completed workout of the **same day basket**, not of any day.
2. A decrease in volume is shaded as **Level 1**, together with increases under 25%.
3. When the previous workout had zero volume and the current one has volume, the change counts as **100%**.
4. Partial reps **count toward volume**, using the parent set's weight.
5. When two or more workouts are completed on the same date, the square shows the **darkest** of their levels, and the detail area lists each one.
6. Bodyweight exercises logged with no weight contribute **0** to volume (weight × reps); no special handling.
7. ~~Weight is labelled kg with no conversion.~~ Superseded: weight is shown in **kg or lb**, chosen on the More tab, and stored in kg (3.10).
8. Completed workouts are **read-only**; their sets cannot be edited or deleted, and a completed workout cannot be deleted on its own (only by deleting its day).
9. Exercises **can be removed** (3.3), which also removes their logged sets. Variations still cannot be renamed or deleted, and exercises cannot be renamed.
10. Each exercise and its variations **belong to one day basket**; progression is not shared between days.
11. An in-progress workout **can only be finished**, not discarded.
12. The calendar week starts on **Monday**. ~~20 weeks are visible.~~ Superseded: the calendar shows **one month at a time** with month arrows (3.8).
13. Duplicate day names are **blocked**, ignoring case and outer spaces.

### 9.2 Conflicts between the user's notes and the settled decisions

14. The user's notes describe "custom exercise intensifiers" with "a field open for that", which suggests free-text intensifiers; the settled decision of exactly three fixed intensifiers was followed.
15. The user's notes say a new exercise is created with "Sets and Reps fields"; the settled definition of a working prototype adds weight, so each set row has reps and weight fields.
