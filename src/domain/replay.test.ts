import { describe, expect, it } from 'vitest';
import { replay, pointWinner } from './replay';
import { newMatch, play } from './test-helpers';
import type { Point } from './types';

describe('pointWinner', () => {
  it('derives the winner from how the point ended', () => {
    expect(pointWinner({ ending: 'ace', endedBy: 'player' })).toBe('player');
    expect(pointWinner({ ending: 'unreturned', endedBy: 'opponent' })).toBe('opponent');
    expect(pointWinner({ ending: 'winner', endedBy: 'player' })).toBe('player');
    expect(pointWinner({ ending: 'double_fault', endedBy: 'player' })).toBe('opponent');
    expect(pointWinner({ ending: 'forced_error', endedBy: 'opponent' })).toBe('player');
    expect(pointWinner({ ending: 'unforced_error', endedBy: 'player' })).toBe('opponent');
  });
});

describe('replay', () => {
  it('summarizes games, including tiebreaks', () => {
    const r = replay(play(newMatch(), 'gp go '.repeat(6) + 'p*7 go'));
    expect(r.games).toHaveLength(14);
    expect(r.games[12]).toMatchObject({ kind: 'tiebreak', server: 'player', winner: 'player', setNumber: 1 });
    expect(r.games[12]?.pointIndices).toHaveLength(7);
    expect(r.games[13]).toMatchObject({ kind: 'game', server: 'opponent', winner: 'opponent', setNumber: 2 });
  });

  it('marks the points that end games, sets and the match', () => {
    const r = replay(play(newMatch(), 'gp*12'));
    expect(r.points.filter((p) => p.endsGame)).toHaveLength(12);
    expect(r.points.filter((p) => p.endsSet).map((p) => p.index)).toEqual([23, 47]);
    expect(r.points.at(-1)?.endsMatch).toBe(true);
    expect(r.final.winner).toBe('player');
  });

  it('leaves an unfinished game open', () => {
    const r = replay(play(newMatch(), 'p p'));
    expect(r.games).toEqual([
      { number: 1, setNumber: 1, kind: 'game', server: 'player', winner: null, pointIndices: [0, 1] },
    ]);
  });

  it('derives the server from the rotation, ignoring a stale stored value', () => {
    const m = play(newMatch(), 'gp p');
    const tampered: Point[] = m.points.map((p) => ({ ...p, server: 'player' }));
    const r = replay({ ...m, points: tampered });
    expect(r.points[4]?.server).toBe('opponent');
  });

  it('ignores (and counts) points logged after the match ended', () => {
    const m = play(newMatch(), 'gp*12');
    const extra = { ...m.points[0]!, id: 'extra' };
    const r = replay({ ...m, points: [...m.points, extra] });
    expect(r.pointsAfterMatchEnd).toBe(1);
    expect(r.points).toHaveLength(48);
  });

  it('records the score before and after each point', () => {
    const r = replay(play(newMatch(), 'p o'));
    expect(r.points[1]?.before.points).toEqual({ player: 1, opponent: 0 });
    expect(r.points[1]?.after.points).toEqual({ player: 1, opponent: 1 });
  });
});
