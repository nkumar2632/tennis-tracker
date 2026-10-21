/**
 * The latest version of each open match, kept in memory so a screen opened right after a tap never
 * reads an older copy from IndexedDB. Saves are queued so they land in order.
 */
import type { Match } from '../domain/types';
import { db } from '../storage/db';
import { getMatch, saveMatch } from '../storage/repo';

const cache = new Map<string, Match>();
let queue: Promise<unknown> = Promise.resolve();

export function peekMatch(id: string): Match | undefined {
  return cache.get(id);
}

export async function loadMatch(id: string): Promise<Match | undefined> {
  return cache.get(id) ?? getMatch(db, id);
}

/** Remember the new version now and save it after any earlier saves. */
export function commitMatch(match: Match): Promise<void> {
  cache.set(match.id, match);
  const saved = queue.then(() => saveMatch(db, match));
  queue = saved.catch(() => undefined);
  return saved;
}

export function forgetMatch(id: string): void {
  cache.delete(id);
}

export function forgetAllMatches(): void {
  cache.clear();
}

/** Resolves once every queued save has finished. */
export function whenSaved(): Promise<unknown> {
  return queue;
}
