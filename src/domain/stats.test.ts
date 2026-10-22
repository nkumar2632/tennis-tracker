import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS } from './format';
import { describePoint } from './labels';
import { replay } from './replay';
import {
  aggregateStats,
  chartedSetNumbers,
  computeStats,
  firstServeByServiceGame,
  pct,
  type MatchStats,
} from './stats';
import { HAND_CHARTED as FIXTURE, newMatch, play } from './test-helpers';

const fixture = play(newMatch(), FIXTURE);
const r = replay(fixture);
const stats = computeStats(r);
const P = stats.player;
const O = stats.opponent;

describe('hand-charted fixture', () => {
  it('scores as expected', () => {
    expect(r.final.games).toEqual({ player: 2, opponent: 2 });
    expect(r.games.map((g) => [g.server, g.winner])).toEqual([
      ['player', 'player'],
      ['opponent', 'player'],
      ['player', 'opponent'],
      ['opponent', 'opponent'],
    ]);
  });

  it('counts points won', () => {
    expect(stats.totalPoints).toBe(28);
    expect(P.pointsWon).toBe(13);
    expect(O.pointsWon).toBe(15);
  });

  it('computes serve stats', () => {
    expect(P.serve).toEqual({
      firstServeIn: { num: 10, den: 14 },
      firstServePointsWon: { num: 5, den: 10 },
      secondServePointsWon: { num: 2, den: 4 },
      aces: 1,
      unreturnedServes: 1,
      doubleFaults: 1,
      doubleFaultsOnPressure: 0,
      serviceGamesHeld: { num: 1, den: 2 },
    });
    expect(O.serve).toEqual({
      firstServeIn: { num: 11, den: 14 },
      firstServePointsWon: { num: 7, den: 11 },
      secondServePointsWon: { num: 1, den: 3 },
      aces: 4,
      unreturnedServes: 1,
      doubleFaults: 1,
      doubleFaultsOnPressure: 0,
      serviceGamesHeld: { num: 1, den: 2 },
    });
  });

  it('computes return stats, treating Return-stroke errors as returns not in play', () => {
    expect(P.return).toEqual({
      // 13 serves in; not in play: 4 aces, 1 unreturned, 2 return errors (points 10 and 14)
      returnInPlay: { num: 6, den: 13 },
      pointsWonVsFirstServe: { num: 4, den: 11 },
      pointsWonVsSecondServe: { num: 2, den: 3 },
      returnGamesWon: { num: 1, den: 2 },
    });
    expect(O.return).toEqual({
      // 13 serves in; not in play: 1 ace, 1 unreturned. O's return winner (point 5) is in play.
      returnInPlay: { num: 11, den: 13 },
      pointsWonVsFirstServe: { num: 5, den: 10 },
      pointsWonVsSecondServe: { num: 2, den: 4 },
      returnGamesWon: { num: 1, den: 2 },
    });
  });

  it('computes rally stats', () => {
    expect(P.rally).toEqual({ winners: 4, unforcedErrors: 3, forcedErrors: 1, winnersMinusUnforcedErrors: 1 });
    expect(O.rally).toEqual({ winners: 5, unforcedErrors: 5, forcedErrors: 1, winnersMinusUnforcedErrors: 0 });
  });

  it('computes break points saved and converted', () => {
    expect(P.breakPoints).toEqual({ saved: { num: 2, den: 3 }, converted: { num: 1, den: 3 } });
    expect(O.breakPoints).toEqual({ saved: { num: 2, den: 3 }, converted: { num: 1, den: 3 } });
  });

  it('computes pressure points vs all other points', () => {
    // Pressure points: 7, 8, 13-18, 22-24 (11). P won 7, 8, 16, 17, 18, 22, 23.
    expect(P.pressure).toEqual({ pressurePointsWon: { num: 7, den: 11 }, otherPointsWon: { num: 6, den: 17 } });
    expect(O.pressure).toEqual({ pressurePointsWon: { num: 4, den: 11 }, otherPointsWon: { num: 11, den: 17 } });
  });

  it('computes consolidation and break-back', () => {
    expect(P.response).toEqual({ consolidation: { num: 0, den: 1 }, breakBack: { num: 0, den: 1 } });
    expect(O.response).toEqual({ consolidation: { num: 1, den: 1 }, breakBack: { num: 1, den: 1 } });
  });

  it('breaks down winners and unforced errors by stroke (untagged points are left out)', () => {
    expect(stats.strokesRecorded).toBe(true);
    expect(P.strokes.winners).toMatchObject({ forehand: 2, backhand: 1, return: 0 });
    expect(P.strokes.unforcedErrors).toMatchObject({ forehand: 1, backhand: 1, return: 1 });
    expect(O.strokes.winners).toMatchObject({ forehand: 1, volley: 1, return: 1 });
    expect(O.strokes.unforcedErrors).toMatchObject({ forehand: 1, backhand: 2 });
  });

  it('computes first serve % for each service game', () => {
    const byGame = firstServeByServiceGame(r);
    expect(byGame.player.map((g) => [g.game.number, g.firstServeIn])).toEqual([
      [1, { num: 5, den: 8 }],
      [3, { num: 5, den: 6 }],
    ]);
    expect(byGame.opponent.map((g) => [g.game.number, g.firstServeIn])).toEqual([
      [2, { num: 7, den: 10 }],
      [4, { num: 4, den: 4 }],
    ]);
  });

  it('describes points in plain language', () => {
    const names = { player: 'Sam', opponent: 'Lee' };
    const text = (i: number) => describePoint(r.points[i]!, names);
    expect(text(0)).toBe('Sam: ace');
    expect(text(1)).toBe('Sam: forehand winner (2nd serve)');
    expect(text(2)).toBe('Sam: double fault');
    expect(text(3)).toBe('Lee: backhand unforced error');
    expect(text(9)).toBe('Sam: return unforced error');
    expect(text(27)).toBe('Lee: unreturned serve');
  });
});

describe('stat edge cases', () => {
  it('counts double faults on pressure points', () => {
    const s = computeStats(replay(play(newMatch(), 'p o p o D'))); // DF at 30-30
    expect(s.player.serve.doubleFaults).toBe(1);
    expect(s.player.serve.doubleFaultsOnPressure).toBe(1);
  });

  it('reports no stroke data when none was recorded', () => {
    const s = computeStats(replay(play(newMatch(), 'gp go')));
    expect(s.strokesRecorded).toBe(false);
  });

  it('excludes tiebreaks from hold/break and break points', () => {
    const m = play(newMatch(), 'gp go '.repeat(6) + 'pW oW pW');
    const s = computeStats(replay(m));
    expect(s.player.serve.serviceGamesHeld).toEqual({ num: 6, den: 6 });
    expect(s.opponent.serve.serviceGamesHeld).toEqual({ num: 6, den: 6 });
    expect(s.player.breakPoints.converted.den + s.opponent.breakPoints.converted.den).toBe(0);
    // All 3 tiebreak points are pressure points.
    expect(s.player.pressure.pressurePointsWon).toEqual({ num: 2, den: 3 });
  });

  it('counts consolidation across a set boundary', () => {
    // Player breaks at 5-4 to win the set 6-4, then holds the first game of set 2.
    const m = play(newMatch(), 'gp go gp go gp go gp go gp gp gp');
    const s = computeStats(replay(m));
    expect(s.player.response.consolidation).toEqual({ num: 1, den: 1 });
    expect(s.opponent.response.breakBack).toEqual({ num: 0, den: 1 });
    // Per set, the chance belongs to the set where the break happened.
    expect(computeStats(replay(m), { setNumber: 1 }).player.response.consolidation).toEqual({ num: 1, den: 1 });
    expect(computeStats(replay(m), { setNumber: 2 }).player.response.consolidation).toEqual({ num: 0, den: 0 });
  });

  it('does not count a consolidation chance when the next game is a match tiebreak', () => {
    // Set 1: all holds, player wins the tiebreak. Set 2: opponent breaks in the last game (6-4), then the match tiebreak.
    const m = play(
      newMatch(FORMAT_PRESETS.twoSetsMatchTiebreak),
      'gp go '.repeat(6) + 'p*7 ' + 'go gp go gp go gp go gp go go p',
    );
    const r2 = replay(m);
    expect(r2.final.tiebreak?.kind).toBe('match');
    const s = computeStats(r2);
    expect(s.opponent.serve.serviceGamesHeld.den).toBeGreaterThan(0);
    expect(s.opponent.return.returnGamesWon).toEqual({ num: 1, den: 11 });
    expect(s.opponent.response.consolidation).toEqual({ num: 0, den: 0 });
    expect(s.player.response.breakBack).toEqual({ num: 0, den: 0 });
  });
});

describe('per-set stats', () => {
  const m = play(newMatch(), 'gp*6 A 2pW');
  const rr = replay(m);

  it('lists the sets that have charted points', () => {
    expect(chartedSetNumbers(rr)).toEqual([1, 2]);
  });

  it('only counts points in the chosen set', () => {
    const set1 = computeStats(rr, { setNumber: 1 });
    const set2 = computeStats(rr, { setNumber: 2 });
    expect(set1.totalPoints).toBe(24);
    expect(set1.player.serve.aces).toBe(0);
    expect(set2.totalPoints).toBe(2);
    expect(set2.player.serve.aces).toBe(1);
    expect(set2.player.serve.firstServeIn).toEqual({ num: 1, den: 2 });
    expect(computeStats(rr).totalPoints).toBe(26);
  });
});

describe('season aggregation', () => {
  it('pools percentages over every point and averages counts per match', () => {
    const a = stats;
    const b = computeStats(replay(play(newMatch(), 'A A A A')));
    const season = aggregateStats([a, b])!;
    expect(season.matches).toBe(2);
    expect(season.player.serve.firstServeIn).toEqual({ num: 10 + 4, den: 14 + 4 });
    expect(season.player.serve.aces).toBe((1 + 4) / 2);
    expect(season.player.rally.winnersMinusUnforcedErrors).toBe((1 + 0) / 2);
    expect(season.totalPoints).toBe((28 + 4) / 2);
    expect(season.strokesRecorded).toBe(true);
  });

  it('returns null for no matches', () => {
    expect(aggregateStats([] as MatchStats[])).toBeNull();
  });
});

describe('pct', () => {
  it('turns a ratio into a percentage, or null when there is no data', () => {
    expect(pct({ num: 1, den: 4 })).toBe(25);
    expect(pct({ num: 0, den: 0 })).toBeNull();
  });
});
