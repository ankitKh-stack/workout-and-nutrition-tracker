# Variation notes: design

Feature 2 of the workout gaps build order (docs/PRD-workout-gaps.md 4.7). Approved in conversation on 8 Nov 2026.

## Intent

Some things about an exercise can't be written as reps and weight: the bench height on an incline Smith press, a seat position, a grip. Ankit wants to write these down once and read them each time before the first set.

## Decisions (Ankit's)

- **One note per variation.** It carries over from workout to workout until it's edited. "Incline Smith Press" and "Incline DB Press" each have their own note.
- **No set notes and no workout notes.** The variation note replaces both. This supersedes the PRD table's "per set as well".
- **Where it lives:** on the logging screen, the Variation card's **Swap** button becomes a **⋮ menu** with:
  - **Swap**, which goes to the swap-variation screen as today;
  - **Write**, when the variation has no note;
  - **Edit**, when it has one.
- **The window:** a small popup over the screen. It shows the note to read, with a **pen icon** that makes it editable.
- **Saving is explicit:** a change is saved only by tapping Save.
- **Shown on exercise history too.**

## Approaches

- **A. Popup over the logging screen (chosen).** A centred card with the screen dimmed behind it. It's the "small window" Ankit described, and you never leave your sets. Cost: a new component that has to stay clear of the keyboard itself.
- **B. A separate sheet screen**, like Swap variation. It reuses an existing pattern and gets keyboard handling for free, but it covers the whole logging screen, which doesn't fit a quick glance. Rejected.
- Storing notes in the settings key/value table was not considered further: notes belong to a variation and must go when it does.

## Behaviour

**The ⋮ menu (logging screen)**
- Tapping ⋮ opens a small menu card under the Variation card, in the same style as the day screen's ⋮ menu.
- Its items are: Swap; then Write or Edit.
- Tapping the ⋮ again, or picking an item, closes it.

**The popup**
- **Opened with Write:** it opens already in edit mode with an empty box and the keyboard up.
- **Opened with Edit:** it opens in read mode. You see the full note text and a ✎ in the corner. Tap ✎ to edit, with the text in a multi-line box and the cursor at the end.
- **In edit mode:** there are **Cancel** and **Save** buttons, and a counter appears near the 500-character limit (input stops at 500).
- **Saving:**
  - Save trims the text and stores it.
  - Saving empty text removes the note, so the menu shows Write again.
  - After saving, the popup returns to read mode, or closes if the note was removed.
- **Closing:** tapping outside, or Android Back, closes the popup in read mode.
  - In edit mode with unsaved changes, it asks "Discard changes?" first. *(My call: protects a half-typed note, and keeps saving explicit.)*
  - Cancel in edit mode follows the same rule, then returns to read mode, or closes if there was no note.
- **The keyboard:** it never covers the box or the buttons.

**Exercise history**
- When the selected variation has a note, a card at the top shows it, with a "Note" label and up to 3 lines. Tap it to open the same popup.
- The popup can be edited there too. *(My call; Ankit didn't decide. Setup details are often fixed between workouts, when no workout is in progress.)*
- Switching variation with the segmented control shows that variation's note.
- No note means no card. A note can still be written from the logging screen.

**Other rules**
- Plain text, up to 500 characters, with line breaks allowed.
- Renaming an exercise keeps the note, because the note belongs to the variation.
- Deleting an exercise deletes its variations and their notes, through the cascade that's already there.
- Writing a note counts as a change to the day, so it moves the day up on Home like other edits. *(My call: SPEC 3.1 says any change inside a day moves it to the top. It does not count as workout activity for auto-end.)*

## Data

- **Schema v4:** `ALTER TABLE variation ADD COLUMN note TEXT;`. NULL means no note.
- **Repository:**
  - `setVariationNote(db, variationId, note | null)` stamps `variation.updated_at` so the day's ordering picks it up. Check `listDays` includes variations; add them if not.
  - `getLoggingData` returns `selectedVariationNote`.
  - `getExerciseHistory` returns the selected variation's `note`.

## Non-goals

- Set notes, workout notes, and notes in a CSV export (they arrive with feature 6, if wanted then).
- Rich text, photos, and note history.

## Left to the builder

- The popup component's name and file (a shared component in `src/components/`).
- Exact styling, within the existing theme.
- Tests:
  - repository tests for set, clear and read through both queries;
  - the migration on an existing v3 database.
- SPEC.md: update 3.5 (logging), the exercise history section, 5.x (Variation entity), 6 (migrations), and PRD 4.7's status.
