import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS } from './format';
import { MatchLogError } from './log';
import { setupOf, updateSetup, validateSetup } from './match';
import { findOpponent, opponentKey, pastOpponents } from './opponents';
import { replay } from './replay';
import { newMatch, play } from './test-helpers';

describe('updateSetup', () => {
  it('changes details and keeps the log', () => {
    const m = play(newMatch(), 'gp p');
    const next = updateSetup(m, { ...setupOf(m), opponentName: 'Lee Park', opponentUtr: 7.4, notes: 'windy' }, 50);
    expect(next).toMatchObject({ id: m.id, opponentName: 'Lee Park', opponentUtr: 7.4, notes: 'windy', updatedAt: 50 });
    expect(next.points).toEqual(m.points);
  });

  it('removes optional fields that were cleared', () => {
    const m = newMatch(FORMAT_PRESETS.bestOf3, { opponentUtr: 7 });
    const { opponentUtr: _, ...rest } = setupOf(m);
    expect(updateSetup(m, rest)).not.toHaveProperty('opponentUtr');
  });

  it('re-scores the log when the first server or format changes', () => {
    const m = play(newMatch(), 'p p p o o o o');
    expect(replay(m).final.games).toEqual({ player: 0, opponent: 0 }); // 40-AD with advantage scoring
    const noAd = updateSetup(m, { ...setupOf(m), format: { ...m.format, noAd: true } });
    expect(replay(noAd).final.games).toEqual({ player: 0, opponent: 1 }); // deciding point won by opponent
    const swapped = updateSetup(m, { ...setupOf(m), firstServer: 'opponent' });
    expect(swapped.points.every((p) => p.server === 'opponent')).toBe(true);
  });

  it('refuses a format change that would end the match before the last point', () => {
    const m = play(newMatch(), 'gp*8'); // 6-0, 2-0 in best of 3
    const proSet6 = { ...FORMAT_PRESETS.proSet8, gamesPerSet: 6, tiebreakAt: 6 };
    expect(() => updateSetup(m, { ...setupOf(m), format: proSet6 })).toThrow(MatchLogError);
  });

  it('refuses an invalid format or late-start score', () => {
    const m = newMatch();
    expect(validateSetup({ ...setupOf(m), format: { ...m.format, tiebreakPoints: 0 } })).not.toEqual([]);
    expect(() =>
      updateSetup(m, { ...setupOf(m), startingScore: { completedSets: [], games: { player: 6, opponent: 1 } } }),
    ).toThrow();
  });

  it('keeps a retirement when the log is unchanged', () => {
    const m = { ...play(newMatch(), 'gp'), status: 'retired' as const, retiredSide: 'opponent' as const };
    expect(updateSetup(m, { ...setupOf(m), notes: 'cramp' })).toMatchObject({ status: 'retired', retiredSide: 'opponent' });
  });
});

describe('pastOpponents', () => {
  const at = (date: string, opponentName: string, extra: object = {}) => ({
    ...newMatch(FORMAT_PRESETS.bestOf3, { opponentName, ...extra }),
    id: `${date}-${opponentName}`,
    date,
  });

  it('lists each opponent once, most recent first, with their latest UTR and hand', () => {
    const list = pastOpponents([
      at('2026-09-01', 'Lee Park', { opponentUtr: 6.8, opponentHand: 'left' }),
      at('2026-10-01', 'lee  park'),
      at('2026-09-15', 'Ana Ruiz', { opponentUtr: 7.2 }),
      at('2026-09-20', '  '),
    ]);
    expect(list.map((o) => [o.name, o.matches, o.utr, o.hand])).toEqual([
      ['lee park', 2, 6.8, 'left'],
      ['Ana Ruiz', 1, 7.2, undefined],
    ]);
    expect(list[0]?.lastDate).toBe('2026-10-01');
  });

  it('finds an opponent regardless of case and spacing', () => {
    const list = pastOpponents([at('2026-09-01', 'Lee Park', { opponentUtr: 6.8 })]);
    expect(findOpponent(list, '  lee   PARK ')?.utr).toBe(6.8);
    expect(findOpponent(list, 'Someone else')).toBeUndefined();
    expect(findOpponent(list, '')).toBeUndefined();
    expect(opponentKey(' A  B ')).toBe('a b');
  });
});
