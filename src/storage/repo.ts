import type { Match } from '../domain/types';
import type { TennisDb } from './db';

export async function saveMatch(db: TennisDb, match: Match): Promise<void> {
  await db.matches.put(match);
}

export async function getMatch(db: TennisDb, id: string): Promise<Match | undefined> {
  return db.matches.get(id);
}

/** Newest first (by match date, then last change). */
export async function listMatches(db: TennisDb): Promise<Match[]> {
  const all = await db.matches.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
}

export async function deleteMatch(db: TennisDb, id: string): Promise<void> {
  await db.matches.delete(id);
}

export interface Settings {
  playerName: string;
  /** Match currently being charted; the app reopens it on launch. */
  activeMatchId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'Player',
  activeMatchId: null,
};

export async function getSetting<K extends keyof Settings>(db: TennisDb, key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return row ? (row.value as Settings[K]) : DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends keyof Settings>(db: TennisDb, key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

/**
 * Ask the browser not to evict our data under storage pressure. Home-screen apps on iOS are
 * already exempt from Safari's 7-day purge; this is belt and braces. Returns whether it was granted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
