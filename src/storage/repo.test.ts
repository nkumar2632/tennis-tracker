import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { newMatch, play } from '../domain/test-helpers';
import type { Match } from '../domain/types';
import { openDb, type TennisDb } from './db';
import {
  allSettings,
  deleteMatch,
  deletePlayer,
  getMatch,
  getSetting,
  listMatches,
  listPlayers,
  replaceAllData,
  saveMatch,
  savePlayer,
  setSetting,
} from './repo';

let db: TennisDb;
let n = 0;
const fresh = () => (db = openDb(`test-db-${++n}`));

afterEach(async () => {
  await db.delete();
});

describe('match storage', () => {
  it('round-trips a match with its point log', async () => {
    fresh();
    const m = play(newMatch(), 'A 2pW:fh D F');
    await saveMatch(db, m);
    expect(await getMatch(db, m.id)).toEqual(m);
  });

  it('overwrites on save, so auto-save after each point keeps the latest log', async () => {
    fresh();
    const m = play(newMatch(), 'p');
    await saveMatch(db, m);
    const later = play(m, 'o o');
    await saveMatch(db, later);
    expect((await getMatch(db, m.id))?.points).toHaveLength(3);
    expect(await db.matches.count()).toBe(1);
  });

  it('lists newest first and deletes', async () => {
    fresh();
    const a = { ...newMatch(), id: 'a', date: '2026-09-01' };
    const b = { ...newMatch(), id: 'b', date: '2026-10-01' };
    await saveMatch(db, a);
    await saveMatch(db, b);
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['b', 'a']);
    await deleteMatch(db, 'b');
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['a']);
  });
});

describe('settings', () => {
  it('returns defaults until a value is saved', async () => {
    fresh();
    expect(await getSetting(db, 'currentPlayerId')).toBeNull();
    expect(await getSetting(db, 'activeMatchId')).toBeNull();
    await setSetting(db, 'currentPlayerId', 'p1');
    await setSetting(db, 'activeMatchId', 'm1');
    expect(await getSetting(db, 'currentPlayerId')).toBe('p1');
    expect(await getSetting(db, 'activeMatchId')).toBe('m1');
  });
});

describe('players', () => {
  const sam = { id: 'p1', name: 'Sam', createdAt: 1 };
  const maya = { id: 'p2', name: 'Maya', createdAt: 2 };

  it('lists players in the order they were added and renames them', async () => {
    fresh();
    await savePlayer(db, maya);
    await savePlayer(db, sam);
    expect((await listPlayers(db)).map((p) => p.name)).toEqual(['Sam', 'Maya']);
    await savePlayer(db, { ...maya, name: 'Maya L' });
    expect((await listPlayers(db)).map((p) => p.name)).toEqual(['Sam', 'Maya L']);
  });

  it("deletes a player with all of their matches, and forgets their match being charted", async () => {
    fresh();
    await savePlayer(db, sam);
    await savePlayer(db, maya);
    await saveMatch(db, { ...newMatch(), id: 'sam-1' });
    await saveMatch(db, { ...newMatch(undefined, { playerId: 'p2' }), id: 'maya-1' });
    await saveMatch(db, { ...newMatch(undefined, { playerId: 'p2' }), id: 'maya-2' });
    await setSetting(db, 'activeMatchId', 'maya-2');
    await deletePlayer(db, 'p2');
    expect((await listPlayers(db)).map((p) => p.id)).toEqual(['p1']);
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['sam-1']);
    expect(await getSetting(db, 'activeMatchId')).toBeNull();
  });
});

describe('upgrade from one player (database version 1)', () => {
  /** A database exactly as version 1 of the app left it. */
  async function v1(name: string, matches: object[], settings: { key: string; value: unknown }[]) {
    const old = new Dexie(name);
    old.version(1).stores({ matches: 'id, date, status, updatedAt, opponentName', settings: 'key' });
    await old.table('matches').bulkPut(matches);
    await old.table('settings').bulkPut(settings);
    old.close();
  }
  const legacy = (id: string): object => {
    const { playerId: _, ...m } = { ...play(newMatch(), 'A D'), id, schemaVersion: 1 };
    return m;
  };

  it("gives every match to one player named from the old setting, keeping everything else", async () => {
    const name = `test-db-${++n}`;
    await v1(name, [legacy('a'), legacy('b')], [
      { key: 'playerName', value: ' Sam ' },
      { key: 'activeMatchId', value: 'b' },
      { key: 'lastSetup', value: { eventName: 'Fall Open' } },
    ]);
    db = openDb(name);
    const players = await listPlayers(db);
    expect(players.map((p) => p.name)).toEqual(['Sam']);
    const id = players[0]!.id;
    const matches = await listMatches(db);
    expect(matches.map((m) => [m.id, m.playerId, m.schemaVersion])).toEqual([
      ['b', id, 2],
      ['a', id, 2],
    ]);
    expect(matches[0]!.points).toHaveLength(2);
    expect(await db.matches.where('playerId').equals(id).count()).toBe(2);
    expect(await allSettings(db)).toEqual({ currentPlayerId: id, activeMatchId: 'b', lastSetup: { eventName: 'Fall Open' } });
    expect(await db.settings.get('playerName')).toBeUndefined();
  });

  it('names the player "Player" if no name was saved, and adds none to an empty app', async () => {
    const unnamed = `test-db-${++n}`;
    await v1(unnamed, [legacy('a')], []);
    const a = openDb(unnamed);
    expect((await listPlayers(a)).map((p) => p.name)).toEqual(['Player']);
    await a.delete();
    const empty = `test-db-${++n}`;
    await v1(empty, [], []);
    db = openDb(empty);
    expect(await listPlayers(db)).toEqual([]);
    expect(await allSettings(db)).toEqual({ currentPlayerId: null, activeMatchId: null, lastSetup: null });
  });
});

describe('restore', () => {
  const sam = { id: 'p1', name: 'Sam', createdAt: 1 };

  it('replaces all players, matches and settings, dropping the match being charted', async () => {
    fresh();
    await savePlayer(db, { id: 'old-p', name: 'Old', createdAt: 0 });
    await saveMatch(db, { ...newMatch(undefined, { playerId: 'old-p' }), id: 'old' });
    await setSetting(db, 'activeMatchId', 'old');
    await replaceAllData(db, { players: [sam], matches: [{ ...newMatch(), id: 'new' }], settings: { currentPlayerId: 'p1' } });
    expect(await listPlayers(db)).toEqual([sam]);
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['new']);
    expect(await allSettings(db)).toEqual({ currentPlayerId: 'p1', activeMatchId: null, lastSetup: null });
  });

  it('changes nothing if the restore fails part-way', async () => {
    fresh();
    await savePlayer(db, sam);
    await saveMatch(db, { ...newMatch(), id: 'keep' });
    const broken = { ...newMatch(), id: undefined } as unknown as Match;
    await expect(replaceAllData(db, { players: [], matches: [broken], settings: {} })).rejects.toThrow();
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['keep']);
    expect(await listPlayers(db)).toEqual([sam]);
  });
});
