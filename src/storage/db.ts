import { Dexie, type EntityTable } from 'dexie';
import type { Match } from '../domain/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

/** All of the user's GitHub Pages sites share one origin, so the database name must be specific. */
export const DB_NAME = 'tennis-tracker-match-charting';

export type TennisDb = Dexie & {
  matches: EntityTable<Match, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

export function openDb(name = DB_NAME): TennisDb {
  const db = new Dexie(name) as TennisDb;
  // Schema changes add a new version here (with an upgrade function); never edit an old one.
  db.version(1).stores({
    matches: 'id, date, status, updatedAt, opponentName',
    settings: 'key',
  });
  return db;
}

export const db = openDb();
