// Backup, restore and CSV export (SPEC.md 3.10). Phone only: the share sheet
// can't share local files on web, where More shows a note instead.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupDatabaseAsync, deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { getExportRows, saveSetting } from '@/data/repository';
import { backupProblem, initializeDatabase } from '@/data/schema';
import { toCsv } from '@/domain/csv';
import { localDateString, type Unit } from '@/lib/format';
import { drainWrites } from '@/lib/writeQueue';

const NOT_A_BACKUP = "This file isn't a backup from this app.";

/** A fresh file in the cache; the same name twice on one day replaces the first. */
function cacheFile(name: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  return file;
}

/** Saves a copy of the whole database and opens the share sheet for it. */
export async function backUp(db: SQLiteDatabase): Promise<void> {
  await drainWrites(); // set edits still being saved go in the backup
  const previous = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'lastBackup'");
  // Stamped before the copy, so the backup itself knows when it was taken; put back if it fails.
  await saveSetting(db, 'lastBackup', new Date().toISOString());
  try {
    const file = cacheFile(`workout-backup-${localDateString(new Date())}.db`);
    file.write(await db.serializeAsync());
    // shortcut: a cancelled share sheet can't be detected, so it still counts as backed up; revisit if it misleads.
    await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Save backup' });
  } catch (e) {
    if (previous) await saveSetting(db, 'lastBackup', previous.value);
    else await db.runAsync("DELETE FROM settings WHERE key = 'lastBackup'");
    throw e;
  }
}

/** Writes every finished workout's sets as CSV and opens the share sheet for it. */
export async function exportCsv(db: SQLiteDatabase, unit: Unit): Promise<void> {
  await drainWrites();
  const file = cacheFile(`workouts-${localDateString(new Date())}.csv`);
  file.write(toCsv(await getExportRows(db, unit)));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export workouts' });
}

export type PickedBackup = { backup: SQLiteDatabase; backupDate: string | null } | { problem: string } | null;

/**
 * Lets the user pick a backup file, checks it and upgrades it to this app's
 * schema in memory, so the live data is only touched by the final copy.
 * Null when the picker was cancelled.
 */
export async function pickBackup(): Promise<PickedBackup> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (picked.canceled) return null;
  let backup: SQLiteDatabase | null = null;
  try {
    // Any bytes deserialize; a file that isn't SQLite fails at the first query instead.
    backup = await deserializeDatabaseAsync(await new File(picked.assets[0].uri).bytes());
    return await checkAndUpgrade(backup);
  } catch {
    await backup?.closeAsync().catch(() => undefined);
    return { problem: NOT_A_BACKUP };
  }
}

async function checkAndUpgrade(backup: SQLiteDatabase): Promise<PickedBackup> {
  const version = await backup.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const tables = (await backup.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map(
    (t) => t.name,
  );
  const problem = backupProblem(version?.user_version ?? 0, tables);
  if (problem) {
    await backup.closeAsync();
    return { problem };
  }
  const stamp = tables.includes('settings')
    ? await backup.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'lastBackup'")
    : null;
  // An older backup is upgraded here, before it replaces anything.
  await initializeDatabase(backup);
  return { backup, backupDate: stamp?.value ?? null };
}

/** Replaces the live database with the picked (already upgraded) backup in one all-or-nothing copy. */
export async function restoreFrom(backup: SQLiteDatabase, db: SQLiteDatabase): Promise<void> {
  try {
    await drainWrites(); // no set edit lands half-way through the copy
    await backupDatabaseAsync({ sourceDatabase: backup, sourceDatabaseName: 'main', destDatabase: db, destDatabaseName: 'main' });
  } finally {
    await backup.closeAsync();
  }
}
