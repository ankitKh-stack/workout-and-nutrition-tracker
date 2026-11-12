# Warm-up sets: design (short)

Feature 5 of the workout gaps build order (docs/PRD-workout-gaps.md 4.4). Approved in conversation on 11 Nov 2026.

## Decisions (Ankit's)

- **Warm-ups can be logged, and they don't count toward volume.** There's no failure tag.
- **Left out of PRs.**
- **Kept for "Last" and Use,** because warm-ups don't change from one workout to the next.
- **The look:** a warm-up set is the same colour, but its "Reps" and "Weight" labels are lighter and the whole box is indented.
- **No rest timer** after warm-up sets.
- **Adding:** "Add set" offers two choices, **Working set** on top and **Warm-up set** below. A warm-up goes to the top, after any existing warm-ups and before the working sets.

## Approaches

- **A warm-up flag on the set row (chosen).** Everything else about a set stays the same.
- **A separate warm-up table (rejected).** It would duplicate all of the set handling.

## Behaviour (my calls marked)

- **Numbering** *(my call)*:
  - warm-ups are numbered W1, W2… and working sets Set 1, Set 2…, separately;
  - "Last" and Use match W1 with last time's W1, and Set 1 with last time's Set 1, so adding warm-ups never shifts the working-set comparison.
- **Counts:**
  - warm-ups are left out of every volume: the workout, the calendar shade, the % change, History, and exercise history's per-variation volume;
  - warm-ups are left out of PRs;
  - superset labels ("Set 2") and the intensifier picker count working sets only.
- **The opening set** *(my call)*: the empty set that appears when you open an exercise is a working set.
- **No intensifiers on warm-ups** *(my call)*: "+ Intensifier" is hidden on them.
- **History** *(my call)*: History and exercise history show warm-ups as "W1 · 10 × 20 kg", in lighter text, above the working sets.
- **Logged counts** *(my call)*: a typed warm-up counts as a logged set in "sets logged" and for the Finish zero-volume check.
- **Rest:** a warm-up never offers rest, whether typed or filled with Use.

## Data

- **Schema v5:** `ALTER TABLE workout_set ADD COLUMN is_warmup INTEGER NOT NULL DEFAULT 0`. Every existing set becomes a working set, so past volumes are unchanged.
- **Sets are ordered** warm-ups first, then working sets, each group by position.

## Non-goals

- Changing an existing set between warm-up and working, a failure tag, and warm-up sets on superset partner rows.
