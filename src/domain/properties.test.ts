/**
 * Property-based tests: fast-check generates random point logs in every format and checks rules that
 * must always hold, whatever happens in the match.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS, isFinishedSetScore, setsToWin } from './format';
import { appendPoint, deletePoint, editPoint, insertPoint, recordFault, replaceLog, undo, type PointEdit } from './log';
import { replay } from './replay';
import { setsWon, type ScoreState } from './scoring';
import { simulateMatch } from './simulate';
import { computeStats, chartedSetNumbers } from './stats';
import { newMatch } from './test-helpers';
import type { Ending, Match, MatchFormat, Point } from './types';
import { STROKES, isServeEnding, otherSide } from './types';

const ENDINGS: Ending[] = ['ace', 'unreturned', 'double_fault', 'winner', 'forced_error', 'unforced_error'];

// Enough runs that tiebreaks, match tiebreaks and finished matches all show up in every test run.
fc.configureGlobal({ numRuns: 300 });

const formatArb: fc.Arbitrary<MatchFormat> = fc
  .tuple(fc.constantFrom(...Object.values(FORMAT_PRESETS)), fc.boolean())
  .map(([preset, noAd]) => ({ ...preset, noAd }));

const editArb: fc.Arbitrary<PointEdit> = fc
  .record({
    ending: fc.constantFrom(...ENDINGS),
    endedBy: fc.constantFrom('player' as const, 'opponent' as const),
    serve: fc.constantFrom(1 as const, 2 as const),
    stroke: fc.option(fc.constantFrom(...STROKES), { nil: undefined }),
  })
  .map((e) => {
    const edit: PointEdit = { ending: e.ending, endedBy: e.endedBy, serve: e.ending === 'double_fault' ? 2 : e.serve };
    if (e.stroke && !isServeEnding(e.ending)) edit.stroke = e.stroke;
    return edit;
  });

/** A normalized match: random points, cut off where the match ends. */
const matchArb: fc.Arbitrary<Match> = fc
  .record({
    format: formatArb,
    firstServer: fc.constantFrom('player' as const, 'opponent' as const),
    // Mix short logs with full-length matches (fast-check's default arrays are only a few items long).
    edits: fc.oneof(
      fc.array(editArb, { maxLength: 40 }),
      fc.array(editArb, { minLength: 150, maxLength: 400, size: 'max' }),
    ),
  })
  .map(({ format, firstServer, edits }) => {
    const base = newMatch(format, { firstServer });
    const points: Point[] = edits.map((e, i) => ({
      id: `p${i}`,
      server: 'player',
      serve: e.serve,
      ending: e.ending,
      endedBy: e.endedBy ?? 'player',
      ...(e.stroke ? { stroke: e.stroke } : {}),
      loggedAt: i,
    }));
    const usable = replay({ ...base, points }).points.length;
    return replaceLog(base, points.slice(0, usable), 0);
  });

function assertLegal(format: MatchFormat, s: ScoreState): void {
  const won = setsWon(s);
  const needed = setsToWin(format);
  expect(s.completedSets.length).toBeLessThanOrEqual(format.bestOf);
  expect(won.player).toBeLessThanOrEqual(needed);
  expect(won.opponent).toBeLessThanOrEqual(needed);
  if (s.winner) {
    expect(won[s.winner]).toBe(needed);
    return;
  }
  for (const set of s.completedSets) {
    if (!set.matchTiebreak) expect(isFinishedSetScore(format, set.games)).toBe(true);
  }
  expect(isFinishedSetScore(format, s.games)).toBe(false);
  const { player: a, opponent: b } = s.points;
  if (s.tiebreak) {
    if (Math.max(a, b) >= s.tiebreak.target) expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  } else if (format.noAd) {
    expect(Math.max(a, b)).toBeLessThanOrEqual(3);
  } else if (Math.min(a, b) >= 3) {
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  } else {
    expect(Math.max(a, b)).toBeLessThanOrEqual(3);
  }
}

describe('scoring invariants', () => {
  it('the score is always legal', () => {
    fc.assert(
      fc.property(matchArb, (m) => {
        const r = replay(m);
        for (const rp of r.points) assertLegal(m.format, rp.after);
      }),
    );
  });

  it('servers alternate every game (a tiebreak counts as one game) and rotate correctly within tiebreaks', () => {
    fc.assert(
      fc.property(matchArb, (m) => {
        const r = replay(m);
        r.games.forEach((game, i) => {
          if (i > 0) expect(game.server).toBe(otherSide(r.games[i - 1]!.server));
          game.pointIndices.forEach((pi, k) => {
            const { server, before } = r.points[pi]!;
            const last = m.format.tiebreakPoints - 1;
            // Fast4: the deciding point at 4-4 is served by the player who received first.
            const decider =
              game.kind === 'tiebreak' && !!m.format.tiebreakSuddenDeath && before.points.player === last && before.points.opponent === last;
            if (game.kind === 'game') expect(server).toBe(game.server);
            else if (decider) expect(server).toBe(otherSide(game.server));
            else expect(server).toBe(Math.floor((k + 1) / 2) % 2 === 0 ? game.server : otherSide(game.server));
          });
        });
      }),
    );
  });

  it('stored servers always match the rotation after any log operation', () => {
    fc.assert(
      fc.property(matchArb, (m) => {
        const r = replay(m);
        m.points.forEach((p, i) => expect(p.server).toBe(r.points[i]!.server));
      }),
    );
  });
});

describe('log operation invariants', () => {
  it('undo exactly reverses logging a point', () => {
    fc.assert(
      fc.property(matchArb, editArb, (m, edit) => {
        fc.pre(replay(m).final.winner === null);
        const before = edit.serve === 2 ? recordFault(m, 1) : m;
        const after = appendPoint(before, edit, 2, 'new');
        const undone = undo(after, 3);
        expect(undone.points).toEqual(before.points);
        expect(undone.pendingFault).toBe(before.pendingFault);
        expect(undone.status).toBe(before.status);
      }),
    );
  });

  it('editing a point to its own values changes nothing', () => {
    fc.assert(
      fc.property(matchArb, fc.nat(), (m, n) => {
        fc.pre(m.points.length > 0);
        const p = m.points[n % m.points.length]!;
        const edit: PointEdit = { serve: p.serve, ending: p.ending, endedBy: p.endedBy };
        if (p.stroke) edit.stroke = p.stroke;
        expect(editPoint(m, p.id, edit, 9).points).toEqual(m.points);
      }),
    );
  });

  it('deleting a point and inserting it back restores the log', () => {
    fc.assert(
      fc.property(matchArb, fc.nat(), (m, n) => {
        fc.pre(m.points.length > 1);
        const i = n % (m.points.length - 1);
        const p = m.points[i]!;
        const next = m.points[i + 1]!;
        let removed: Match;
        try {
          removed = deletePoint(m, p.id, 9);
        } catch {
          return; // deleting can legitimately end the match early; nothing to restore
        }
        const edit: PointEdit = { serve: p.serve, ending: p.ending, endedBy: p.endedBy };
        if (p.stroke) edit.stroke = p.stroke;
        const restored = insertPoint(removed, next.id, edit, 9, p.id);
        expect(restored.points.map(({ loggedAt: _, ...rest }) => rest)).toEqual(
          m.points.map(({ loggedAt: _, ...rest }) => rest),
        );
      }),
    );
  });
});

describe('stat invariants', () => {
  it('serve and return stats mirror each other and add up', () => {
    fc.assert(
      fc.property(matchArb, (m) => {
        const s = computeStats(replay(m));
        const { player: P, opponent: O } = s;
        expect(P.pointsWon + O.pointsWon).toBe(s.totalPoints);
        expect(P.serve.firstServeIn.den + O.serve.firstServeIn.den).toBe(s.totalPoints);
        for (const [sv, rt] of [
          [P, O],
          [O, P],
        ] as const) {
          expect(sv.serve.firstServePointsWon.den).toBe(sv.serve.firstServeIn.num);
          expect(sv.serve.firstServePointsWon.den).toBe(rt.return.pointsWonVsFirstServe.den);
          expect(sv.serve.firstServePointsWon.num + rt.return.pointsWonVsFirstServe.num).toBe(
            sv.serve.firstServePointsWon.den,
          );
          expect(sv.serve.secondServePointsWon.num + rt.return.pointsWonVsSecondServe.num).toBe(
            sv.serve.secondServePointsWon.den,
          );
          expect(sv.serve.serviceGamesHeld.den).toBe(rt.return.returnGamesWon.den);
          expect(sv.serve.serviceGamesHeld.num + rt.return.returnGamesWon.num).toBe(sv.serve.serviceGamesHeld.den);
          expect(sv.breakPoints.saved.num + rt.breakPoints.converted.num).toBe(sv.breakPoints.saved.den);
          expect(rt.return.returnInPlay.den).toBe(sv.serve.firstServeIn.den - sv.serve.doubleFaults);
          expect(sv.serve.doubleFaultsOnPressure).toBeLessThanOrEqual(sv.serve.doubleFaults);
          expect(sv.response.consolidation.den).toBe(rt.response.breakBack.den);
        }
        expect(P.pressure.pressurePointsWon.num + O.pressure.pressurePointsWon.num).toBe(
          P.pressure.pressurePointsWon.den,
        );
        expect(P.pressure.pressurePointsWon.den + P.pressure.otherPointsWon.den).toBe(s.totalPoints);
      }),
    );
  });

  it('per-set stats add up to the match', () => {
    fc.assert(
      fc.property(matchArb, (m) => {
        const r = replay(m);
        const whole = computeStats(r);
        const sets = chartedSetNumbers(r).map((n) => computeStats(r, { setNumber: n }));
        const sum = (f: (s: typeof whole) => number) => sets.reduce((acc, s) => acc + f(s), 0);
        expect(sum((s) => s.totalPoints)).toBe(whole.totalPoints);
        expect(sum((s) => s.player.pointsWon)).toBe(whole.player.pointsWon);
        expect(sum((s) => s.opponent.serve.aces)).toBe(whole.opponent.serve.aces);
        expect(sum((s) => s.player.rally.unforcedErrors)).toBe(whole.player.rally.unforcedErrors);
        expect(sum((s) => s.player.serve.serviceGamesHeld.den)).toBe(whole.player.serve.serviceGamesHeld.den);
      }),
    );
  });
});

describe('simulated matches', () => {
  it('run to completion in every format', () => {
    for (const format of Object.values(FORMAT_PRESETS)) {
      for (const seed of [1, 2, 3]) {
        const m = simulateMatch(newMatch(format), seed, { now: 0 });
        expect(m.status).toBe('completed');
        expect(replay(m).final.winner).not.toBeNull();
      }
    }
  });
});
