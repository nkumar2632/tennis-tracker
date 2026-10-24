/** The players being charted: names, whose matches are whose, and bringing older data in. */
import { newId } from './ids';
import type { Match, Player } from './types';

export function newPlayer(name: string, now = Date.now(), id = newId()): Player {
  return { id, name: name.trim().replace(/\s+/g, ' '), createdAt: now };
}

/** Oldest first, so the order never changes as players are added. */
export function sortPlayers(players: readonly Player[]): Player[] {
  return [...players].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** The player's display name, or "Player" when it's blank or the player is gone. */
export function playerName(players: readonly Player[], id: string | undefined): string {
  return players.find((p) => p.id === id)?.name.trim() || 'Player';
}

export function matchesOf(all: readonly Match[], playerId: string): Match[] {
  return all.filter((m) => m.playerId === playerId);
}

/** The player's most recently recorded UTR (by match date), to prefill a new match. */
export function latestUtr(all: readonly Match[], playerId: string): number | undefined {
  let best: Match | undefined;
  for (const m of all) {
    if (m.playerId !== playerId || m.playerUtr === undefined) continue;
    if (!best || m.date > best.date || (m.date === best.date && m.updatedAt > best.updatedAt)) best = m;
  }
  return best?.playerUtr;
}

/**
 * A match saved before there were several players (schema 1) given to `playerId`. Used by the
 * database upgrade and when restoring an old backup.
 */
export function adoptMatch(match: Match, playerId: string): Match {
  return { ...match, playerId, schemaVersion: Math.max(match.schemaVersion, 2) };
}
