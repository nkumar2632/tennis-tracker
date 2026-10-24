import { Dexie, type EntityTable } from 'dexie';
import { adoptMatch, newPlayer } from '../domain/players';
import type { Match, Player } from '../domain/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

/** All of the user's GitHub Pages sites share one origin, so the database name must be specific. */
export const DB_NAME = 'tennis-tracker-match-charting';

export type TennisDb = Dexie & {
  matches: EntityTable<Match, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
  players: EntityTable<Player, 'id'>;
};

export function openDb(name = DB_NAME): TennisDb {
  const db = new Dexie(name) as TennisDb;
  // Schema changes add a new version here (with an upgrade function); never edit an old one.
  db.version(1).stores({
    matches: 'id, date, status, updatedAt, opponentName',
    settings: 'key',
  });
  // 2: several players. Everything charted so far belongs to one player, named from the old
  // single "playerName" setting.
  db.version(2)
    .stores({
      matches: 'id, date, status, updatedAt, opponentName, playerId',
      settings: 'key',
      players: 'id',
    })
    .upgrade(async (tx) => {
      const settings = tx.table<SettingRow, string>('settings');
      const matches = tx.table<Match, string>('matches');
      const row = await settings.get('playerName');
      const name = typeof row?.value === 'string' ? row.value.trim() : '';
      await settings.delete('playerName');
      if (!name && (await matches.count()) === 0) return;
      const player = newPlayer(name || 'Player');
      await tx.table<Player, string>('players').add(player);
      await settings.put({ key: 'currentPlayerId', value: player.id });
      await matches.toCollection().modify((m, ref) => {
        ref.value = adoptMatch(m, player.id);
      });
    });
  return db;
}

export const db = openDb();
