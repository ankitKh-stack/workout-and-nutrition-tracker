// A fresh in-memory SQLite database with the app's schema, behind the small
// part of expo-sqlite's API that src/data uses. Backed by Node's node:sqlite,
// so the real SQL runs without a phone.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { initializeDatabase } from '../src/data/schema.ts';

export async function openTestDb(): Promise<SQLiteDatabase> {
  const raw = new DatabaseSync(':memory:');
  // node:sqlite rows have a null prototype; copy them so deepEqual compares plain objects.
  const plain = (row: unknown) => (row ? { ...(row as object) } : null);
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    getFirstAsync: async (sql: string, ...params: SQLInputValue[]) => plain(raw.prepare(sql).get(...params)),
    getAllAsync: async (sql: string, ...params: SQLInputValue[]) => raw.prepare(sql).all(...params).map(plain),
    runAsync: async (sql: string, ...params: SQLInputValue[]) => raw.prepare(sql).run(...params),
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as SQLiteDatabase;
  await initializeDatabase(db);
  return db;
}

/** Waits a few milliseconds so the next write gets a later timestamp. */
export const tick = () => new Promise((resolve) => setTimeout(resolve, 3));
