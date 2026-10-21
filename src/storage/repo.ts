import type { EventType, Match, MatchFormat, Surface } from '../domain/types';
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

/** Match setup fields remembered from the last new match, to prefill the next one. */
export interface SetupDefaults {
  eventName: string;
  eventType: EventType;
  surface: Surface;
  indoor: boolean;
  format: MatchFormat;
  playerUtr?: number;
}

export interface Settings {
  /** The son's name; empty until entered on first launch. */
  playerName: string;
  /** Match currently being charted; the app reopens it on launch. */
  activeMatchId: string | null;
  lastSetup: SetupDefaults | null;
}

export const DEFAULT_SETTINGS: Settings = {
  playerName: '',
  activeMatchId: null,
  lastSetup: null,
};

/** Settings that go into a backup (never the match being charted). */
export const BACKED_UP_SETTINGS = ['playerName', 'lastSetup'] as const satisfies readonly (keyof Settings)[];

export async function allSettings(db: TennisDb): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in out) (out as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return out;
}

/** Restore: replace every match and the backed-up settings in one transaction (all or nothing). */
export async function replaceAllData(
  db: TennisDb,
  matches: Match[],
  settings: Partial<Record<(typeof BACKED_UP_SETTINGS)[number], unknown>>,
): Promise<void> {
  await db.transaction('rw', db.matches, db.settings, async () => {
    await db.matches.clear();
    await db.settings.clear();
    await db.matches.bulkPut(matches);
    for (const key of BACKED_UP_SETTINGS) {
      if (settings[key] !== undefined) await db.settings.put({ key, value: settings[key] });
    }
  });
}

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
