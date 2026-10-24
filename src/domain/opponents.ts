import type { Handedness, Match } from './types';

export interface OpponentInfo {
  /** Name as last entered. */
  name: string;
  /** Most recently recorded UTR and handedness, if any match had them. */
  utr?: number;
  hand?: Handedness;
  lastDate: string;
  matches: number;
}

/** Case- and spacing-insensitive key, so "Lee  Park" and "lee park" are the same opponent. */
export function opponentKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Everyone played (by any player), most recent first, for autocomplete and UTR prefill. */
export function pastOpponents(matches: readonly Match[]): OpponentInfo[] {
  const newestFirst = [...matches].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  const byKey = new Map<string, OpponentInfo>();
  for (const m of newestFirst) {
    const key = opponentKey(m.opponentName);
    if (!key) continue;
    let info = byKey.get(key);
    if (!info) {
      info = { name: m.opponentName.trim().replace(/\s+/g, ' '), lastDate: m.date, matches: 0 };
      byKey.set(key, info);
    }
    info.matches += 1;
    if (info.utr === undefined && m.opponentUtr !== undefined) info.utr = m.opponentUtr;
    if (info.hand === undefined && m.opponentHand !== undefined) info.hand = m.opponentHand;
  }
  return [...byKey.values()];
}

export function findOpponent(list: readonly OpponentInfo[], name: string): OpponentInfo | undefined {
  const key = opponentKey(name);
  return key ? list.find((o) => opponentKey(o.name) === key) : undefined;
}
