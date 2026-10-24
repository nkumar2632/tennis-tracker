import { describe, expect, it } from 'vitest';
import { backupFileName, makeBackup, parseBackup } from './backup';
import { newMatch, play } from './test-helpers';

const match = play(newMatch(), 'gp A 2pW:fh D');
const sam = { id: 'p1', name: 'Sam', createdAt: 1 };
const good = () => makeBackup([sam], [match], { currentPlayerId: 'p1' }, new Date('2026-10-21T12:00:00Z'));

describe('backup', () => {
  it('round-trips through JSON', () => {
    const parsed = parseBackup(JSON.stringify(good()));
    expect(parsed).toEqual({ ok: true, backup: good() });
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 9, 21))).toBe('tennis-tracker-backup-2026-10-21.json');
  });

  it('rejects files that are not backups', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false, error: expect.stringMatching(/valid JSON/) });
    expect(parseBackup('{"hello": 1}')).toMatchObject({ ok: false, error: expect.stringMatching(/isn't a Tennis Tracker backup/) });
    expect(parseBackup(JSON.stringify({ ...good(), version: 99 }))).toMatchObject({ ok: false, error: expect.stringMatching(/newer version/) });
    expect(parseBackup(JSON.stringify({ ...good(), matches: 'x' }))).toMatchObject({ ok: false });
  });

  it('rejects damaged matches without restoring anything', () => {
    const bad = (m: object) => parseBackup(JSON.stringify({ ...good(), matches: [m] }));
    expect(bad({ ...match, points: [{ ...match.points[0], ending: 'lob' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/Match 1 .*invalid point/) });
    expect(bad({ ...match, format: { ...match.format, gamesPerSet: 0 } })).toMatchObject({ ok: false, error: expect.stringMatching(/invalid format/) });
    expect(bad({ ...match, schemaVersion: 99 })).toMatchObject({ ok: false, error: expect.stringMatching(/newer version/) });
    expect(bad({ ...match, id: '' })).toMatchObject({ ok: false });
    const finished = play(newMatch(), 'gp*12');
    expect(bad({ ...finished, points: [...finished.points, { ...finished.points[0]!, id: 'extra' }] })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/after the end/),
    });
  });

  it('rejects damaged players and matches of unknown players', () => {
    expect(parseBackup(JSON.stringify({ ...good(), players: undefined }))).toMatchObject({ ok: false, error: expect.stringMatching(/no player list/) });
    expect(parseBackup(JSON.stringify({ ...good(), players: [{ id: 'p1' }] }))).toMatchObject({ ok: false, error: expect.stringMatching(/Player 1/) });
    expect(parseBackup(JSON.stringify({ ...good(), players: [sam, sam] }))).toMatchObject({ ok: false, error: expect.stringMatching(/Player 2/) });
    expect(parseBackup(JSON.stringify({ ...good(), matches: [{ ...match, playerId: 'p9' }] }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/unknown player/),
    });
  });

  it('restores a backup from before players: one player, named from the old setting', () => {
    const { playerId: _, ...legacy } = { ...match, schemaVersion: 1 };
    const v1 = { app: 'tennis-tracker', kind: 'backup', version: 1, exportedAt: 'x', matches: [legacy], settings: { playerName: 'Sam', lastSetup: null } };
    const parsed = parseBackup(JSON.stringify(v1));
    if (!parsed.ok) throw new Error(parsed.error);
    const [player] = parsed.backup.players;
    expect(parsed.backup.players).toHaveLength(1);
    expect(player!.name).toBe('Sam');
    expect(parsed.backup.matches).toEqual([{ ...match, playerId: player!.id }]);
    expect(parsed.backup.settings).toEqual({ lastSetup: null, currentPlayerId: player!.id });
    // No name saved: "Player". Nothing at all: no players.
    const unnamed = parseBackup(JSON.stringify({ ...v1, settings: {} }));
    expect(unnamed.ok && unnamed.backup.players.map((p) => p.name)).toEqual(['Player']);
    const empty = parseBackup(JSON.stringify({ ...v1, matches: [], settings: {} }));
    expect(empty.ok && empty.backup.players).toEqual([]);
  });

  it('rejects duplicate matches', () => {
    expect(parseBackup(JSON.stringify({ ...good(), matches: [match, match] }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/duplicate/),
    });
  });
});
