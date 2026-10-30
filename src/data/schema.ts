import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'workout-tracker.db';
const SCHEMA_VERSION = 2;

/**
 * Creates the tables on first launch and records the schema version so later
 * versions can migrate existing data instead of recreating it (SPEC.md 6).
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version === null) throw new Error('Could not read the database schema version');
  if (version.user_version > SCHEMA_VERSION) {
    throw new Error('Database schema is newer than this app supports');
  }
  if (version.user_version === SCHEMA_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (version.user_version < 1) {
      await db.execAsync(`
        CREATE TABLE day_basket (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE exercise (
          id TEXT PRIMARY KEY NOT NULL,
          day_id TEXT NOT NULL REFERENCES day_basket(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          position INTEGER NOT NULL,
          default_variation_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE variation (
          id TEXT PRIMARY KEY NOT NULL,
          exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE workout (
          id TEXT PRIMARY KEY NOT NULL,
          day_id TEXT NOT NULL REFERENCES day_basket(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
          selected_variations TEXT NOT NULL DEFAULT '{}',
          total_volume REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE workout_set (
          id TEXT PRIMARY KEY NOT NULL,
          workout_id TEXT NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
          variation_id TEXT NOT NULL REFERENCES variation(id) ON DELETE CASCADE,
          intensifier_id TEXT REFERENCES intensifier(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          reps INTEGER,
          weight REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE intensifier (
          id TEXT PRIMARY KEY NOT NULL,
          workout_id TEXT NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('drop', 'partial', 'superset')),
          parent_set_id TEXT NOT NULL REFERENCES workout_set(id) ON DELETE CASCADE,
          partner_exercise_id TEXT REFERENCES exercise(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_exercise_day ON exercise(day_id);
        CREATE INDEX idx_variation_exercise ON variation(exercise_id);
        CREATE INDEX idx_workout_day ON workout(day_id);
        CREATE INDEX idx_set_workout ON workout_set(workout_id);
        CREATE INDEX idx_set_variation ON workout_set(variation_id);
        CREATE INDEX idx_set_intensifier ON workout_set(intensifier_id);
        CREATE INDEX idx_intensifier_parent ON intensifier(parent_set_id);
      `);
    }
    if (version.user_version < 2) {
      // App preferences (theme, weight unit) as key/value pairs.
      await db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}
