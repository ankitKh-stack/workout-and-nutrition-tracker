# Fill from last time: design (short)

Feature 3 of the workout gaps build order (docs/PRD-workout-gaps.md 4.2). Approved in conversation on 10 Nov 2026.

## Intent

Each set already shows "Last 8 × 60 kg". Ankit taps a button *after* doing a set the same as last time, so the numbers don't have to be typed twice.

## Decisions (Ankit's)

- **A button, not automatic pre-fill** (PRD decisions table).
- **Normal sets only.** Drop, partial and superset rows never get the button.
- **It counts as finishing the set,** so filling starts the rest timer.

## Approaches

- **Button beside the existing "Last" line (chosen).** Last time's sets are already loaded by `getLoggingData`. It needs one repository function and no schema change.
- **Automatic grey placeholders that become real on tap.** Rejected by Ankit: it's easier to log something by accident.

## Behaviour

- **Where it appears:**
  - A small **"Use"** button sits on the set's header row, right of "Last 8 × 60 kg".
  - It shows only when the set has a last-time match and **both** of its stored values are empty.
  - "Last time" keeps its current meaning: the same set number, on the same variation, in the last completed workout.
- **Tapping Use:**
  - Pending field typing is saved first.
  - Then each field is filled **only if it is still empty in storage**, so typed values always win and nothing is overwritten.
  - If last time had only one of the two values, only that one is filled.
  - The stored kg value is copied as is, so no unit rounding happens.
  - The keyboard is dismissed.
  - The screen reloads and shows the filled values.
- **The rest timer** *(my call: no prompt, Ankit can override)*:
  - **When it starts:** if the fill leaves the set done (reps and weight both present) and the set is the last row of its group (it has no intensifier rows; the same rule as `offersRest`), the countdown **starts straight away** with the More setting's length. Tapping Use already means "I did this set", so no "Start rest?" prompt is shown.
  - **Otherwise no rest starts,** in either of two cases: the set has intensifier rows under it, or the fill leaves the set incomplete.
- **Errors:** a failed write shows the screen's existing "Last change was not saved. Try again." banner.

## Data

None. There is no schema change.

New repository function: `fillSetFromLast(db, setId, reps, weight)`. It writes `reps = COALESCE(reps, ?)` and `weight = COALESCE(weight, ?)`, stamps `updated_at`, and returns the row's resulting `{ reps, weight }`.

## Non-goals

- Filling intensifier rows, filling all sets at once, and copying last time's sets *count* (it only fills sets that already exist).

## Left to the builder

- **The rest timer method:** `useRestTimer` needs a way to start a countdown directly for an owner. Today `start()` only works from a prompt.
- **Exact styling of "Use":** the existing compact link button style.
- **Tests:** repository tests for filling empty fields, never overwriting a filled field, and a half-empty last set; and the existing rest-timer pure tests, if a pure helper is added.
- **SPEC.md 3.5 and PRD 4.2:** update both to "BUILT".
