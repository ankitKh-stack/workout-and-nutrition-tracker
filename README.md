# Workout and Nutrition Tracker

A private, on-device training log for Android and iPhone, built with React Native and Expo.

Group your exercises into named days ("Push day", "Pull day"), log sets, reps and weight, mark drop sets, partial reps and supersets, and swap to another variation when the gym is busy. A GitHub-style calendar shades each day by how much your training volume grew. Everything is stored on the phone; there is no account and nothing is uploaded.

Nutrition tracking is planned for a later version; the Nutrition tab is a placeholder for now.

## Features

- **Days and exercises.** Create a day, add exercises by typing a name, rename or delete days, rename or remove exercises, and touch and hold a day or exercise to drag it into a new order.
- **Logging.** Each set has reps and weight fields that save as you type, so closing the app mid-workout loses nothing. Every set shows what you did on the same set last time ("Last 10 × 60 kg").
- **Intensifiers.** Drop sets (own reps and weight), partial reps (reps only, at the parent set's weight) and supersets (pairs a set with another exercise in the day).
- **Variations.** Swap variations mid-workout or create a new one on the spot. Sets already logged stay on the variation they were done on, so each variation keeps its own history.
- **History without starting a workout.** Tap an exercise when no workout is running to see its last five workouts.
- **Calendar.** One month at a time, each day shaded by the change in volume (weight × reps) against the previous workout of the same day. Home shows the current week in the same shading.
- **Settings.** Light or dark theme, and weights in kg or lb. Weights are always stored in kg, so switching never changes your data.

## Getting started

You need Node.js 22.18 or later (the tests run TypeScript directly with Node's built-in type stripping).

```bash
npm install
```

```bash
npx expo start
```

Then scan the QR code with **Expo Go** on your phone (Android or iOS), or press `w` to open it in a browser. All the libraries used are included in Expo Go, so no custom build is needed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Starts the Expo dev server |
| `npm run android` / `npm run ios` / `npm run web` | Starts and opens on that platform |
| `npm run typecheck` | Type-checks the project (`tsc --noEmit`) |
| `npm test` | Runs the unit tests for volume, progress shading and unit conversion (Node's built-in test runner) |
| `npx expo-doctor` | Checks dependency versions and config |

## Tech stack

- **Expo SDK 58** with **Expo Router** (file-based navigation, bottom tabs)
- **expo-sqlite** for local storage, with versioned schema migrations
- **TypeScript**, **Inter** typeface (`@expo-google-fonts/inter`) and Ionicons

## Project structure

```
src/
  app/            Screens (Expo Router: every file is a route)
    (tabs)/       Workouts, Calendar, Nutrition and More tabs
      workouts/   Day list, day detail, logging and history screens
    *.tsx         Modals: name a day, add exercise, intensifier picker, swap variation
  components/     Shared UI (buttons, rows, fields, week strip)
  data/           schema.ts (tables and migrations), repository.ts (all reads and writes)
  domain/         progress.ts: volume, percentage change and shade rules (pure, tested)
  lib/            Formatting, unit conversion, dialogs, data-loading hooks
  theme/          Light and dark palettes, type, shared styles, settings provider
tests/            Unit tests
SPEC.md           The full build specification
```

Screens never write SQL directly; everything goes through `src/data/repository.ts`, which keeps the data model independent of the storage engine.

## How progress is shaded

1. A workout's **volume** is the sum of reps × weight over all its sets, including drop sets, partial reps (at the parent set's weight) and superset rows. Empty fields count as 0.
2. It is compared with the **previous completed workout of the same day**: change = (volume − previous) ÷ previous × 100.
3. The first workout of a day counts as +100%. A workout with zero volume gets the faintest shade.

| Shade | Change |
| --- | --- |
| Zero volume | volume is 0 |
| Level 1 | under 25% (including any drop) |
| Level 2 | 25% to under 50% |
| Level 3 | 50% to under 100% |
| Level 4 | 100% or more |

`SPEC.md` sections 5 and 7 have the full rules and edge cases.

## Specification

[SPEC.md](SPEC.md) is the source of truth for behaviour: screens, user flows, data model, storage and the decisions made so far. Update it alongside any change in behaviour.
