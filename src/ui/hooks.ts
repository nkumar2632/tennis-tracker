import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { playerName } from '../domain/players';
import type { BySide, Match, Player } from '../domain/types';
import { db } from '../storage/db';
import { DEFAULT_SETTINGS, allSettings, listMatches, listPlayers, type Settings } from '../storage/repo';
import { commitMatch, loadMatch, peekMatch } from './store';

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface AppData {
  settings: Settings;
  /** Oldest first. */
  players: Player[];
}

const AppDataContext = createContext<AppData>({ settings: DEFAULT_SETTINGS, players: [] });

/**
 * Loads settings and players once for the whole app (and keeps them live), rendering nothing until
 * they're ready, so no screen ever flashes a placeholder name.
 */
export function SettingsGate({ children }: { children: ReactNode }) {
  const data = useLiveQuery(
    () => db.transaction('r', db.settings, db.players, async () => ({ settings: await allSettings(db), players: await listPlayers(db) })),
    [],
  );
  return data ? createElement(AppDataContext.Provider, { value: data }, children) : null;
}

export function useSettings(): Settings {
  return useContext(AppDataContext).settings;
}

export function usePlayers(): Player[] {
  return useContext(AppDataContext).players;
}

/** The player Home and Season show: the one last chosen, else the first; undefined before any is added. */
export function useCurrentPlayer(): Player | undefined {
  const { settings, players } = useContext(AppDataContext);
  return players.find((p) => p.id === settings.currentPlayerId) ?? players[0];
}

/** All matches, newest first; undefined while loading. */
export function useMatches(): Match[] | undefined {
  return useLiveQuery(() => listMatches(db), []);
}

/** The two names shown for a match: its player and the opponent. */
export function namesFor(players: readonly Player[], match: Pick<Match, 'playerId' | 'opponentName'> | null | undefined): BySide<string> {
  return {
    player: playerName(players, match?.playerId),
    opponent: match?.opponentName.trim() || 'Opponent',
  };
}

/**
 * One match, editable. `apply` runs a domain operation, shows the result at once and saves it.
 * Domain errors (e.g. an edit that would end the match early) land in `error` instead of throwing.
 */
export function useMatchEditor(id: string) {
  const [match, setMatch] = useState<Match | null | undefined>(() => peekMatch(id));
  const current = useRef(match);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (current.current?.id === id) return;
    let alive = true;
    void loadMatch(id).then((m) => {
      if (!alive) return;
      current.current = m ?? null;
      setMatch(m ?? null);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const apply = useCallback((fn: (m: Match) => Match): Match | null => {
    const before = current.current;
    if (!before) return null;
    let next: Match;
    try {
      next = fn(before);
    } catch (e) {
      setError(errorMessage(e));
      return null;
    }
    current.current = next;
    setMatch(next);
    setError(null);
    commitMatch(next).catch((e) => setError(`Couldn't save: ${errorMessage(e)}`));
    return next;
  }, []);

  return { match, error, setError, apply };
}
