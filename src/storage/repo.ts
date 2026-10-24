import { sortPlayers } from '../domain/players';
import type { EventType, Match, MatchFormat, Player, Surface } from '../domain/types';
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

/**
 * Match setup fields remembered from the last new match, to prefill the next one. (The player's
 * UTR comes from their own latest match instead.)
 */
export interface SetupDefaults {
  eventName: string;
  eventType: EventType;
  surface: Surface;
  indoor: boolean;
  format: MatchFormat;
}

export interface Settings {
  /** The player Home and Season show; falls back to the first player when unset or deleted. */
  currentPlayerId: string | null;
  /** Match currently being charted; the app reopens it on launch. */
  activeMatchId: string | null;
  lastSetup: SetupDefaults | null;
}

export const DEFAULT_SETTINGS: Settings = {
  currentPlayerId: null,
  activeMatchId: null,
  lastSetup: null,
};

/** Settings that go into a backup (never the match being charted). */
export const BACKED_UP_SETTINGS = ['currentPlayerId', 'lastSetup'] as const satisfies readonly (keyof Settings)[];

/** Oldest first. */
export async function listPlayers(db: TennisDb): Promise<Player[]> {
  return sortPlayers(await db.players.toArray());
}

export async function savePlayer(db: TennisDb, player: Player): Promise<void> {
  await db.players.put(player);
}

/** Delete a player and all of their matches, in one transaction. */
export async function deletePlayer(db: TennisDb, id: string): Promise<void> {
  await db.transaction('rw', db.players, db.matches, db.settings, async () => {
    await db.matches.where('playerId').equals(id).delete();
    await db.players.delete(id);
    const active = await db.settings.get('activeMatchId');
    if (active?.value && !(await db.matches.get(active.value as string))) await db.settings.put({ key: 'activeMatchId', value: null });
  });
}

export async function allSettings(db: TennisDb): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in out) (out as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return out;
}

/** Restore: replace every player, match and backed-up setting in one transaction (all or nothing). */
export async function replaceAllData(
  db: TennisDb,
  data: { players: Player[]; matches: Match[]; settings: Partial<Record<(typeof BACKED_UP_SETTINGS)[number], unknown>> },
): Promise<void> {
  const { players, matches, settings } = data;
  await db.transaction('rw', db.players, db.matches, db.settings, async () => {
    await db.players.clear();
    await db.matches.clear();
    await db.settings.clear();
    await db.players.bulkPut(players);
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
