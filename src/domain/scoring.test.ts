import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS } from './format';
import { replay } from './replay';
import {
  initialScore,
  isBreakPoint,
  isPressurePoint,
  pointScoreLabel,
  scorePoint,
  serverOf,
  setScoreLine,
  setsWon,
  type ScoreState,
} from './scoring';
import { newMatch, play } from './test-helpers';
import type { MatchFormat, Side } from './types';

const AD = FORMAT_PRESETS.bestOf3;
const NO_AD: MatchFormat = { ...FORMAT_PRESETS.bestOf3, noAd: true };
const MTB = FORMAT_PRESETS.twoSetsMatchTiebreak;
const PRO = FORMAT_PRESETS.proSet8;

/** Apply point winners from a string like "ppoo" (p = player, o = opponent). */
function run(format: MatchFormat, seq: string, start: ScoreState = initialScore(format, 'player')): ScoreState {
  let s = start;
  for (const c of seq.replace(/\s+/g, '')) s = scorePoint(format, s, c === 'p' ? 'player' : 'opponent').state;
  return s;
}

/** Every game won with four straight points; one char per game. */
const games = (seq: string) => seq.split('').map((c) => c.repeat(4)).join('');

describe('game scoring (advantage)', () => {
  it('wins a game with four straight points', () => {
    const s = run(AD, 'pppp');
    expect(s.games).toEqual({ player: 1, opponent: 0 });
    expect(s.points).toEqual({ player: 0, opponent: 0 });
  });

  it('labels the score from either side', () => {
    expect(pointScoreLabel(run(AD, ''), 'player')).toBe('0-0');
    expect(pointScoreLabel(run(AD, 'p'), 'player')).toBe('15-0');
    expect(pointScoreLabel(run(AD, 'ppo'), 'player')).toBe('30-15');
    expect(pointScoreLabel(run(AD, 'ppo'), 'opponent')).toBe('15-30');
    expect(pointScoreLabel(run(AD, 'pppoo'), 'player')).toBe('40-30');
  });

  it('goes deuce, advantage, back to deuce, then needs two in a row', () => {
    let s = run(AD, 'pppooo');
    expect(pointScoreLabel(s, 'player')).toBe('40-40');
    s = run(AD, 'p', s);
    expect(pointScoreLabel(s, 'player')).toBe('AD-40');
    s = run(AD, 'o', s);
    expect(pointScoreLabel(s, 'player')).toBe('40-40');
    s = run(AD, 'o', s);
    expect(pointScoreLabel(s, 'player')).toBe('40-AD');
    expect(s.games).toEqual({ player: 0, opponent: 0 });
    s = run(AD, 'o', s);
    expect(s.games).toEqual({ player: 0, opponent: 1 });
  });
});

describe('no-ad scoring', () => {
  it('decides the game on the point at 40-40', () => {
    let s = run(NO_AD, 'pppooo');
    expect(pointScoreLabel(s, 'player')).toBe('40-40');
    s = run(NO_AD, 'o', s);
    expect(s.games).toEqual({ player: 0, opponent: 1 });
  });

  it('treats the deciding point as a break point for the receiver', () => {
    const s = run(NO_AD, 'pppooo');
    expect(isBreakPoint(NO_AD, s)).toBe(true);
    expect(isBreakPoint(AD, run(AD, 'pppooo'))).toBe(false);
  });

  it('does not change tiebreaks (still win by two)', () => {
    let s = run(NO_AD, games('popopopopopo'));
    expect(s.tiebreak?.kind).toBe('set');
    s = run(NO_AD, 'pppppp oooooo p', s);
    expect(s.tiebreak).not.toBeNull();
    s = run(NO_AD, 'p', s);
    expect(s.completedSets).toHaveLength(1);
    expect(s.completedSets[0]!.tiebreak).toEqual({ player: 8, opponent: 6 });
  });
});

describe('sets', () => {
  it('wins a set 6-4 and 7-5 but not 6-5', () => {
    expect(run(AD, games('pppppoooop')).completedSets[0]?.games).toEqual({ player: 6, opponent: 4 });
    const at65 = run(AD, games('pppppooooop')); // 5-5, then 6-5
    expect(at65.completedSets).toHaveLength(0);
    expect(at65.games).toEqual({ player: 6, opponent: 5 });
    expect(run(AD, 'pppp', at65).completedSets[0]?.games).toEqual({ player: 7, opponent: 5 });
  });

  it('plays a 7-point tiebreak at 6-6, won by two', () => {
    let s = run(AD, games('popopopopopo'));
    expect(s.games).toEqual({ player: 6, opponent: 6 });
    expect(s.tiebreak).toEqual({ kind: 'set', firstServer: 'player', target: 7 });
    s = run(AD, 'pppppp oooooo', s);
    expect(pointScoreLabel(s, 'player')).toBe('6-6');
    s = run(AD, 'po', s); // 7-7: not over
    expect(s.completedSets).toHaveLength(0);
    s = run(AD, 'pp', s);
    expect(s.completedSets[0]).toMatchObject({
      games: { player: 7, opponent: 6 },
      tiebreak: { player: 9, opponent: 7 },
      winner: 'player',
    });
  });

  it('formats the set score line with tiebreak and match tiebreak points', () => {
    let s = run(MTB, games('pppppoooop')); // 6-4
    s = run(MTB, games('popopopopopo'), s); // 6-6
    s = run(MTB, 'ooooo pp oo', s); // tiebreak 2-7 to the opponent
    s = run(MTB, 'ppppppppp oooooooo p', s); // match tiebreak 10-8
    expect(s.winner).toBe('player');
    expect(setScoreLine(s, 'player')).toBe('6-4 6-7(2) [10-8]');
    expect(setScoreLine(s, 'opponent')).toBe('4-6 7-6(2) [8-10]');
  });

  it('ends a best-of-3 match after two sets to one player', () => {
    const s = run(AD, games('pppppp') + games('pppppp'));
    expect(s.winner).toBe('player');
    expect(() => scorePoint(AD, s, 'player')).toThrow();
  });

  it('plays a full third set when there is no match tiebreak', () => {
    const s = run(AD, games('pppppp') + games('oooooo'));
    expect(s.tiebreak).toBeNull();
    expect(s.winner).toBeNull();
    expect(setsWon(s)).toEqual({ player: 1, opponent: 1 });
    expect(run(AD, games('oooooo'), s).winner).toBe('opponent');
  });
});

describe('match tiebreak', () => {
  it('replaces the third set with a 10-point tiebreak at one set all', () => {
    const s = run(MTB, games('pppppp') + games('oooooo'));
    expect(s.tiebreak).toEqual({ kind: 'match', firstServer: s.gameServer, target: 10 });
  });

  it('is won by two points and records the result as a set', () => {
    let s = run(MTB, games('pppppp') + games('oooooo'));
    s = run(MTB, 'ppppppppp ooooooooo', s); // 9-9
    s = run(MTB, 'p', s); // 10-9: not over
    expect(s.winner).toBeNull();
    s = run(MTB, 'p', s);
    expect(s.winner).toBe('player');
    expect(s.completedSets[2]).toMatchObject({
      matchTiebreak: true,
      games: { player: 1, opponent: 0 },
      tiebreak: { player: 11, opponent: 9 },
      winner: 'player',
    });
    expect(setScoreLine(s, 'player')).toBe('6-0 0-6 [11-9]');
  });

  it('respects a custom match tiebreak length', () => {
    const seven: MatchFormat = { ...MTB, matchTiebreakPoints: 7 };
    const s = run(seven, games('pppppp') + games('oooooo') + 'ppppppp');
    expect(s.winner).toBe('player');
  });
});

describe('8-game pro set', () => {
  it('is won 8-6 but 8-7 continues, with a tiebreak at 8-8', () => {
    expect(run(PRO, games('pppppppoooooop')).winner).toBe('player'); // 8-6
    const at87 = run(PRO, games('popopopopopopop')); // 8-7
    expect(at87.winner).toBeNull();
    const at88 = run(PRO, games('o'), at87);
    expect(at88.games).toEqual({ player: 8, opponent: 8 });
    expect(at88.tiebreak).toMatchObject({ kind: 'set', target: 7 });
    const done = run(PRO, 'ppppppp', at88);
    expect(done.winner).toBe('player');
    expect(done.completedSets[0]?.games).toEqual({ player: 9, opponent: 8 });
  });

  it('supports a custom tiebreak score (e.g. 7-7)', () => {
    const tbAt7: MatchFormat = { ...PRO, tiebreakAt: 7 };
    const s = run(tbAt7, games('popopopopopopo'));
    expect(s.games).toEqual({ player: 7, opponent: 7 });
    expect(s.tiebreak?.kind).toBe('set');
  });
});

describe('server rotation', () => {
  function serversOf(format: MatchFormat, seq: string, first: Side = 'player'): Side[] {
    const servers: Side[] = [];
    let s = initialScore(format, first);
    for (const c of seq) {
      servers.push(serverOf(s));
      s = scorePoint(format, s, c === 'p' ? 'player' : 'opponent').state;
    }
    return servers;
  }

  it('alternates every game, continuing across sets', () => {
    expect(serverOf(run(AD, games('pppppoooo')))).toBe('opponent'); // game 10
    const afterSet = run(AD, games('pppppoooop')); // 6-4 after 10 games
    expect(afterSet.completedSets).toHaveLength(1);
    expect(serverOf(afterSet)).toBe('player'); // game 11 opens set 2
    expect(serverOf(run(AD, games('ppppppo')))).toBe('opponent'); // 6-0, then one game of set 2
  });

  it('in a tiebreak: first server serves one point, then two each', () => {
    // 12 games with the player serving first, so the player serves first in the tiebreak.
    const servers = serversOf(AD, games('popopopopopo') + 'pppppp oooooo'.replace(' ', '')).slice(48);
    const P = 'player';
    const O = 'opponent';
    expect(servers).toEqual([P, O, O, P, P, O, O, P, P, O, O, P]);
  });

  it('after a set tiebreak, the player who received first serves the next set', () => {
    const s = run(AD, games('popopopopopo') + 'ppppppp');
    expect(s.completedSets).toHaveLength(1);
    expect(s.gameServer).toBe('opponent');
    const s2 = run(AD, games('popopopopopo') + 'ppppppp', initialScore(AD, 'opponent'));
    expect(s2.gameServer).toBe('player');
  });

  it('uses the same rotation in a match tiebreak', () => {
    // 12 games, so the player (who served game 1) serves first in the match tiebreak.
    const servers = serversOf(MTB, games('pppppp') + games('oooooo') + 'pppppp').slice(48);
    const P = 'player';
    const O = 'opponent';
    expect(servers).toEqual([P, O, O, P, P, O]);
  });

  it('starts from the chosen first server', () => {
    expect(serversOf(AD, 'pppp', 'opponent')).toEqual(['opponent', 'opponent', 'opponent', 'opponent']);
    expect(serverOf(run(AD, 'pppp', initialScore(AD, 'opponent')))).toBe('player');
  });
});

describe('break points and pressure points', () => {
  const at = (seq: string) => run(AD, seq); // player serving
  it('flags break points only when the receiver can win the game', () => {
    expect(isBreakPoint(AD, at('ooo'))).toBe(true); // 0-40
    expect(isBreakPoint(AD, at('pooo'))).toBe(true); // 15-40
    expect(isBreakPoint(AD, at('ppooo'))).toBe(true); // 30-40
    expect(isBreakPoint(AD, at('pppoooo'))).toBe(true); // 40-AD
    expect(isBreakPoint(AD, at('pppooo'))).toBe(false); // deuce
    expect(isBreakPoint(AD, at('pppo'))).toBe(false); // 40-15
  });

  it('flags 30-30, deuce, either advantage and break points as pressure', () => {
    expect(isPressurePoint(AD, at('ppoo'))).toBe(true); // 30-30
    expect(isPressurePoint(AD, at('pppooo'))).toBe(true); // deuce
    expect(isPressurePoint(AD, at('pppooop'))).toBe(true); // AD-40 (server's advantage)
    expect(isPressurePoint(AD, at('pooo'))).toBe(true); // 15-40
    expect(isPressurePoint(AD, at('ppo'))).toBe(false); // 30-15
    expect(isPressurePoint(AD, at('pppoo'))).toBe(false); // 40-30
    expect(isPressurePoint(AD, at(''))).toBe(false);
  });

  it('flags every tiebreak point as pressure but never as a break point', () => {
    const tb = run(AD, games('popopopopopo'));
    expect(isPressurePoint(AD, tb)).toBe(true);
    expect(isBreakPoint(AD, run(AD, 'oooooo', tb))).toBe(false);
  });
});

describe('late start (joining a match in progress)', () => {
  it('starts from the entered sets and games with the chosen server', () => {
    const s = initialScore(AD, 'opponent', {
      completedSets: [{ games: { player: 6, opponent: 4 } }],
      games: { player: 2, opponent: 1 },
    });
    expect(s.completedSets[0]).toMatchObject({ winner: 'player', charted: false });
    expect(s.games).toEqual({ player: 2, opponent: 1 });
    expect(serverOf(s)).toBe('opponent');
  });

  it('starts in a tiebreak at 6-6 and in the match tiebreak at one set all', () => {
    expect(initialScore(AD, 'player', { completedSets: [], games: { player: 6, opponent: 6 } }).tiebreak).toEqual({
      kind: 'set',
      firstServer: 'player',
      target: 7,
    });
    const mtb = initialScore(MTB, 'opponent', {
      completedSets: [{ games: { player: 6, opponent: 3 } }, { games: { player: 4, opponent: 6 } }],
      games: { player: 0, opponent: 0 },
    });
    expect(mtb.tiebreak).toEqual({ kind: 'match', firstServer: 'opponent', target: 10 });
  });

  it('numbers charted sets after the late-start sets', () => {
    const m = play(
      newMatch(AD, {
        startingScore: { completedSets: [{ games: { player: 3, opponent: 6 } }], games: { player: 0, opponent: 0 } },
      }),
      'gp',
    );
    const r = replay(m);
    expect(r.points.every((p) => p.setNumber === 2)).toBe(true);
    expect(r.games[0]?.setNumber).toBe(2);
  });
});
