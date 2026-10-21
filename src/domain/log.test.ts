import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS } from './format';
import {
  appendPoint,
  canUndo,
  deletePoint,
  editPoint,
  endMatchEarly,
  insertPoint,
  MatchLogError,
  recordFault,
  resumeMatch,
  setStroke,
  suspendMatch,
  undo,
} from './log';
import { matchOutcome } from './match';
import { replay } from './replay';
import { pointScoreLabel, serverOf, setScoreLine } from './scoring';
import { newMatch, play } from './test-helpers';

const score = (m: ReturnType<typeof newMatch>) => {
  const r = replay(m);
  return {
    sets: setScoreLine(r.final, 'player'),
    games: r.final.games,
    points: pointScoreLabel(r.final, 'player'),
    server: serverOf(r.final),
  };
};

describe('logging points', () => {
  it('derives the server and serve number', () => {
    let m = newMatch(FORMAT_PRESETS.bestOf3, { firstServer: 'opponent' });
    m = appendPoint(m, { ending: 'winner', endedBy: 'player' });
    expect(m.points[0]).toMatchObject({ server: 'opponent', serve: 1, ending: 'winner', endedBy: 'player' });
    m = recordFault(m);
    expect(m.pendingFault).toBe(true);
    m = appendPoint(m, { ending: 'unforced_error', endedBy: 'player', stroke: 'backhand' });
    expect(m.points[1]).toMatchObject({ serve: 2, stroke: 'backhand' });
    expect(m.pendingFault).toBe(false);
  });

  it('credits serve endings to the server, whatever endedBy says', () => {
    const m = appendPoint(newMatch(), { ending: 'ace', endedBy: 'opponent' });
    expect(m.points[0]?.endedBy).toBe('player');
  });

  it('rejects impossible input', () => {
    const m = newMatch();
    expect(() => appendPoint(m, { ending: 'double_fault' })).toThrow(MatchLogError); // no fault yet
    expect(() => appendPoint(m, { ending: 'winner' })).toThrow(MatchLogError); // who?
    expect(() => appendPoint(m, { ending: 'ace', stroke: 'forehand' })).toThrow(MatchLogError);
    expect(() => recordFault(recordFault(m))).toThrow(MatchLogError);
  });

  it('completes the match and refuses further points', () => {
    const m = play(newMatch(FORMAT_PRESETS.proSet8), 'gp*8');
    expect(m.status).toBe('completed');
    expect(matchOutcome(m)).toEqual({ status: 'completed', winner: 'player', countsInRecord: true });
    expect(() => appendPoint(m, { ending: 'ace' })).toThrow(MatchLogError);
    expect(() => recordFault(m)).toThrow(MatchLogError);
  });
});

describe('undo', () => {
  it('clears a pending fault first, then removes the last point', () => {
    let m = play(newMatch(), 'p F');
    expect(m.pendingFault).toBe(true);
    m = undo(m);
    expect(m.pendingFault).toBe(false);
    expect(m.points).toHaveLength(1);
    m = undo(m);
    expect(m.points).toHaveLength(0);
    expect(canUndo(m)).toBe(false);
    expect(undo(m)).toBe(m);
  });

  it('returns to the second serve when undoing a second-serve point or double fault', () => {
    const afterDf = play(newMatch(), 'D');
    expect(undo(afterDf)).toMatchObject({ pendingFault: true, points: [] });
    const after2nd = play(newMatch(), '2pW');
    expect(undo(after2nd)).toMatchObject({ pendingFault: true, points: [] });
    const after1st = play(newMatch(), 'pW');
    expect(undo(after1st).pendingFault).toBe(false);
  });

  it('undoes across a game boundary', () => {
    const m = play(newMatch(), 'gp');
    expect(score(m)).toMatchObject({ games: { player: 1, opponent: 0 }, server: 'opponent' });
    expect(score(undo(m))).toMatchObject({ games: { player: 0, opponent: 0 }, points: '40-0', server: 'player' });
  });

  it('undoes across a set boundary', () => {
    const m = play(newMatch(), 'gp*6');
    expect(score(m).sets).toBe('6-0');
    expect(score(undo(m))).toMatchObject({ sets: '', games: { player: 5, opponent: 0 }, points: '40-0' });
  });

  it('undoes out of a finished tiebreak back into the tiebreak', () => {
    const m = play(newMatch(), 'gp go '.repeat(6) + 'p*7');
    expect(score(m).sets).toBe('7-6(0)');
    const back = replay(undo(m)).final;
    expect(back.tiebreak?.kind).toBe('set');
    expect(back.points).toEqual({ player: 6, opponent: 0 });
  });

  it('undoes the match-winning point and makes the match resumable', () => {
    const m = play(newMatch(FORMAT_PRESETS.twoSetsMatchTiebreak), 'gp*6 go*6 p*10');
    expect(m.status).toBe('completed');
    const back = undo(m);
    expect(back.status).toBe('in_progress');
    expect(replay(back).final.winner).toBeNull();
    expect(replay(back).final.points).toEqual({ player: 9, opponent: 0 });
  });
});

describe('editing past points', () => {
  it('changes a point and re-scores everything after it', () => {
    let m = play(newMatch(), 'gp o o o o'); // 1-1 after the opponent holds
    expect(score(m).games).toEqual({ player: 1, opponent: 1 });
    // The game-winning point of game 1 actually went to the opponent.
    const fourth = m.points[3]!;
    m = editPoint(m, fourth.id, { serve: 1, ending: 'winner', endedBy: 'opponent' });
    // 40-15 → opponent wins 4 more points: 40-30, deuce, 40-AD, game opponent. Still game 1.
    expect(score(m).games).toEqual({ player: 0, opponent: 1 });
    // Points 5-8 are now in the player's service game.
    expect(m.points.slice(4).map((p) => p.server)).toEqual(['player', 'player', 'player', 'player']);
  });

  it('moves serve endings to the re-derived server', () => {
    let m = play(newMatch(), 'gp A'); // ace by the opponent, serving game 2
    expect(m.points[4]).toMatchObject({ server: 'opponent', endedBy: 'opponent' });
    m = editPoint(m, m.points[3]!.id, { serve: 1, ending: 'unforced_error', endedBy: 'player' });
    // Game 1 continues (40-15), so the ace now belongs to the player, serving.
    expect(m.points[4]).toMatchObject({ server: 'player', endedBy: 'player' });
    expect(score(m).games).toEqual({ player: 1, opponent: 0 });
  });

  it('refuses an edit that would end the match before the last point', () => {
    const m = play(newMatch(FORMAT_PRESETS.proSet8), 'gp*7 p p p o o p');
    expect(m.status).toBe('completed');
    const firstLoss = m.points.at(-3)!;
    expect(() => editPoint(m, firstLoss.id, { serve: 1, ending: 'winner', endedBy: 'player' })).toThrow(
      /end the match before the last logged point/,
    );
  });

  it('can turn a completed match back into one in progress', () => {
    const m = play(newMatch(FORMAT_PRESETS.proSet8), 'gp*8');
    const last = m.points.at(-1)!;
    const edited = editPoint(m, last.id, { serve: 1, ending: 'winner', endedBy: 'opponent' });
    expect(edited.status).toBe('in_progress');
  });

  it('sets and clears the optional stroke', () => {
    let m = play(newMatch(), 'pW');
    const id = m.points[0]!.id;
    m = setStroke(m, id, 'volley');
    expect(m.points[0]?.stroke).toBe('volley');
    m = setStroke(m, id, undefined);
    expect(m.points[0]).not.toHaveProperty('stroke');
    expect(() => setStroke(play(newMatch(), 'A'), 'pt-missing', 'volley')).toThrow(MatchLogError);
  });

  it('rejects a stroke on a serve ending', () => {
    const m = play(newMatch(), 'A');
    expect(() => setStroke(m, m.points[0]!.id, 'forehand')).toThrow(MatchLogError);
  });

  it('clears a stroke when an edit changes the point to a serve ending', () => {
    let m = play(newMatch(), 'pW:fh');
    m = editPoint(m, m.points[0]!.id, { serve: 1, ending: 'ace' });
    expect(m.points[0]).not.toHaveProperty('stroke');
  });
});

describe('deleting and inserting points', () => {
  it('deletes a point and re-scores', () => {
    let m = play(newMatch(), 'p p o');
    m = deletePoint(m, m.points[2]!.id);
    expect(score(m).points).toBe('30-0');
  });

  it('inserts a missed point in the middle, keeping ids and re-deriving servers', () => {
    let m = play(newMatch(), 'gp o o o'); // opponent serving at 40-0 in game 2
    const before = m.points[4]!.id;
    m = insertPoint(m, before, { serve: 1, ending: 'winner', endedBy: 'player' }, 5, 'missed');
    // The missed point opens game 2, so it was on the opponent's serve.
    expect(m.points[4]).toMatchObject({ id: 'missed', server: 'opponent' });
    expect(score(m).points).toBe('15-40');
  });

  it('inserts at the end when no point is given', () => {
    const m = insertPoint(play(newMatch(), 'p'), null, { serve: 2, ending: 'double_fault' }, 5, 'end');
    expect(m.points.at(-1)).toMatchObject({ id: 'end', serve: 2, server: 'player', endedBy: 'player' });
    expect(score(m).points).toBe('15-15');
  });

  it('validates inserted points', () => {
    expect(() => insertPoint(newMatch(), null, { serve: 1, ending: 'double_fault' })).toThrow(MatchLogError);
  });
});

describe('ending a match early', () => {
  it('records a retirement, which counts in the record', () => {
    const m = endMatchEarly(play(newMatch(), 'gp*3'), { kind: 'retired', retiredSide: 'opponent' });
    expect(m.status).toBe('retired');
    expect(matchOutcome(m)).toEqual({ status: 'retired', winner: 'player', countsInRecord: true });
    expect(() => appendPoint(m, { ending: 'ace' })).toThrow(MatchLogError);
  });

  it('records a stopped match, which does not count in the record', () => {
    const m = endMatchEarly(play(newMatch(), 'gp'), { kind: 'stopped' });
    expect(matchOutcome(m)).toEqual({ status: 'stopped', winner: null, countsInRecord: false });
  });

  it('can resume an ended or suspended match', () => {
    const retired = endMatchEarly(play(newMatch(), 'gp'), { kind: 'retired', retiredSide: 'player' });
    const resumed = resumeMatch(retired);
    expect(resumed.status).toBe('in_progress');
    expect(resumed).not.toHaveProperty('retiredSide');
    const suspended = suspendMatch(play(newMatch(), 'gp'));
    expect(suspended.status).toBe('suspended');
    expect(appendPoint(suspended, { ending: 'ace' }).status).toBe('in_progress');
  });

  it('cannot end a match that is already complete', () => {
    const done = play(newMatch(FORMAT_PRESETS.proSet8), 'gp*8');
    expect(() => endMatchEarly(done, { kind: 'stopped' })).toThrow(MatchLogError);
    expect(() => suspendMatch(done)).toThrow(MatchLogError);
  });

  it('clears a pending fault when the match ends early', () => {
    const m = endMatchEarly(play(newMatch(), 'F'), { kind: 'stopped' });
    expect(m.pendingFault).toBe(false);
  });
});

describe('updatedAt', () => {
  it('moves forward on every change', () => {
    const m = appendPoint(newMatch(), { ending: 'ace' }, 12345);
    expect(m.updatedAt).toBe(12345);
    expect(undo(m, 22222).updatedAt).toBe(22222);
  });
});
