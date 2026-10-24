/** Full backup of all data as one JSON file, and the checks run before restoring one. */
import { validateFormat } from './format';
import { SCHEMA_VERSION } from './match';
import { adoptMatch, newPlayer } from './players';
import { replay } from './replay';
import type { Match, Player } from './types';
import { RALLY_ENDINGS, SERVE_ENDINGS, SIDES } from './types';

/** 2: players. Version 1 backups (a single player, named in the settings) still restore. */
export const BACKUP_VERSION = 2;

export interface Backup {
  app: 'tennis-tracker';
  kind: 'backup';
  version: number;
  exportedAt: string;
  players: Player[];
  matches: Match[];
  /** Settings worth keeping (last-used setup, chosen player); never the match being charted. */
  settings: Record<string, unknown>;
}

export function makeBackup(players: Player[], matches: Match[], settings: Record<string, unknown>, now = new Date()): Backup {
  return {
    app: 'tennis-tracker',
    kind: 'backup',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    players,
    matches,
    settings,
  };
}

/** e.g. tennis-tracker-backup-2026-10-21.json (local date). */
export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `tennis-tracker-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ENDINGS = [...SERVE_ENDINGS, ...RALLY_ENDINGS] as string[];

function matchProblem(m: unknown, version: number, playerIds: ReadonlySet<string>): string | null {
  if (!isObject(m)) return 'not a match';
  if (typeof m.id !== 'string' || !m.id) return 'missing id';
  if (version >= 2 && !playerIds.has(m.playerId as string)) return 'unknown player';
  if (typeof m.schemaVersion !== 'number' || m.schemaVersion > SCHEMA_VERSION) {
    return 'made by a newer version of the app';
  }
  if (typeof m.date !== 'string' || typeof m.opponentName !== 'string') return 'missing date or opponent';
  if (!SIDES.includes(m.firstServer as never)) return 'missing first server';
  if (!isObject(m.format) || validateFormat(m.format as never).length > 0) return 'invalid format';
  if (!Array.isArray(m.points)) return 'missing point log';
  for (const p of m.points) {
    if (!isObject(p) || typeof p.id !== 'string' || (p.serve !== 1 && p.serve !== 2)) return 'invalid point';
    if (!ENDINGS.includes(p.ending as string) || !SIDES.includes(p.endedBy as never)) return 'invalid point';
  }
  try {
    if (replay(m as unknown as Match).pointsAfterMatchEnd > 0) return 'points after the end of the match';
  } catch {
    return 'point log cannot be scored';
  }
  return null;
}

/** Parse and check a backup file before anything is replaced. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a backup (it isn't valid JSON)." };
  }
  if (!isObject(data) || data.app !== 'tennis-tracker' || data.kind !== 'backup') {
    return { ok: false, error: "That file isn't a Tennis Tracker backup." };
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    return { ok: false, error: 'That backup was made by a newer version of the app. Update the app first.' };
  }
  if (!Array.isArray(data.matches)) return { ok: false, error: 'That backup has no match list.' };
  const settings = isObject(data.settings) ? { ...data.settings } : {};

  let players: Player[];
  if (data.version >= 2) {
    if (!Array.isArray(data.players)) return { ok: false, error: 'That backup has no player list.' };
    players = [];
    for (const [i, p] of data.players.entries()) {
      const ok = isObject(p) && typeof p.id === 'string' && p.id && typeof p.name === 'string' && typeof p.createdAt === 'number';
      if (!ok || players.some((q) => q.id === p.id)) return { ok: false, error: `Player ${i + 1} in the backup is damaged.` };
      players.push({ id: p.id as string, name: p.name as string, createdAt: p.createdAt as number });
    }
  } else {
    // One player, named by the old single name setting.
    const name = typeof settings.playerName === 'string' ? settings.playerName : '';
    players = name.trim() || data.matches.length > 0 ? [newPlayer(name.trim() || 'Player', 0)] : [];
    delete settings.playerName;
    if (players[0]) settings.currentPlayerId = players[0].id;
  }

  const playerIds = new Set(players.map((p) => p.id));
  const ids = new Set<string>();
  for (const [i, m] of data.matches.entries()) {
    const problem = matchProblem(m, data.version, playerIds);
    if (problem) return { ok: false, error: `Match ${i + 1} in the backup is damaged (${problem}).` };
    const id = (m as Match).id;
    if (ids.has(id)) return { ok: false, error: `Match ${i + 1} in the backup is a duplicate.` };
    ids.add(id);
  }
  const matches = data.version >= 2 ? (data.matches as Match[]) : (data.matches as Match[]).map((m) => adoptMatch(m, players[0]!.id));
  return {
    ok: true,
    backup: {
      app: 'tennis-tracker',
      kind: 'backup',
      version: data.version,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
      players,
      matches,
      settings,
    },
  };
}
