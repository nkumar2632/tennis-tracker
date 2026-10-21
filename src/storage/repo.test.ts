import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newMatch, play } from '../domain/test-helpers';
import { openDb, type TennisDb } from './db';
import { allSettings, deleteMatch, getMatch, getSetting, listMatches, replaceAllData, saveMatch, setSetting } from './repo';

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
    expect(await getSetting(db, 'playerName')).toBe('');
    expect(await getSetting(db, 'activeMatchId')).toBeNull();
    await setSetting(db, 'playerName', 'Sam');
    await setSetting(db, 'activeMatchId', 'm1');
    expect(await getSetting(db, 'playerName')).toBe('Sam');
    expect(await getSetting(db, 'activeMatchId')).toBe('m1');
  });
});

describe('restore', () => {
  it('replaces all matches and settings, dropping the match being charted', async () => {
    fresh();
    await saveMatch(db, { ...newMatch(), id: 'old' });
    await setSetting(db, 'playerName', 'Old');
    await setSetting(db, 'activeMatchId', 'old');
    await replaceAllData(db, [{ ...newMatch(), id: 'new' }], { playerName: 'Sam' });
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['new']);
    expect(await allSettings(db)).toEqual({ playerName: 'Sam', activeMatchId: null, lastSetup: null });
  });

  it('changes nothing if the restore fails part-way', async () => {
    fresh();
    await saveMatch(db, { ...newMatch(), id: 'keep' });
    const broken = { ...newMatch(), id: undefined } as unknown as ReturnType<typeof newMatch>;
    await expect(replaceAllData(db, [broken], {})).rejects.toThrow();
    expect((await listMatches(db)).map((m) => m.id)).toEqual(['keep']);
  });
});
