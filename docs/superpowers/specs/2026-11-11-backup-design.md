# Backup, restore and CSV export: design (short)

Feature 6 of the workout gaps build order (docs/PRD-workout-gaps.md 4.5). Approved in conversation on 11 Nov 2026.

## Decisions (Ankit's)

- **What's in it:** CSV export, a backup on More → Your data, and **restore** in this version.
- **No backup reminder.**

## Approaches

- **Backup = the database file (chosen).** `db.serializeAsync()` writes the bytes to a `.db` file, which goes through the share sheet. Restore does `deserializeDatabaseAsync(bytes)`, checks the result, then `backupDatabaseAsync` copies it into the live database. It's exact: every table, setting and note comes across.
- **A JSON dump of every table (rejected).** It's more code to write and to keep in step with the schema.

## Behaviour

- **Back up:**
  - saves `lastBackup` = now in settings;
  - serialises the database and writes `workout-backup-YYYY-MM-DD.db` to the cache;
  - opens the share sheet.
  - The Your data card shows "Last backup 11 Nov 2026" *(my call)*.
  - A workout in progress is included as is.
- **Export CSV:**
  - writes `workouts-YYYY-MM-DD.csv` and opens the share sheet;
  - one row per set row, oldest workout first, then exercise order, then set order;
  - columns: `date, day, exercise, variation, set, type, reps, weight, unit, note`;
    - `set` is `W1` or `Set 1` (intensifier rows repeat their parent's set);
    - `type` is `working | warm-up | drop | partial | superset`;
    - `weight` is in the current unit, rounded like the screen, and empty for partials;
    - `note` is the variation's note;
  - fields with `,`, `"` or a newline are quoted, RFC 4180 style;
  - completed workouts only *(my call: a workout in progress is unfinished)*.
- **Restore:**
  - pick a file;
  - load it into memory;
  - refuse it if it isn't a backup from this app ("This file isn't a backup from this app." when there's no `day_basket` / `workout_set` table) or if it's from a newer version ("This backup is from a newer version of the app. Update the app first.");
  - confirm: "Replace everything on this phone with the backup from {lastBackup date, or 'an unknown date'}? This includes any workout in progress and can't be undone." (Restore / Cancel);
  - copy it into the live database and run the normal migrations (an older backup is upgraded);
  - reload the settings, clear any rest timer, and go to Home *(my call)*.
- **Web:** the share sheet can't share local files, so the three actions are replaced by "Backup and export work in the phone app." *(my call)*.
- **Errors:** "Could not back up / export / restore. Nothing was changed." *(my call)*.

## Native

`expo-file-system`, `expo-sharing` and `expo-document-picker` go in via `npx expo install`. All three are in Expo Go and need no config plugin. **A new EAS build is needed** on the phone.

## Non-goals

- Automatic or scheduled backups, reminders, cloud sync, and importing a CSV.
