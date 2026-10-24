import { isFinishedSetScore, setsToWin } from './format';
import type { BySide, MatchFormat, Side, StartingScore } from './types';
import { otherSide } from './types';

export interface SetResult {
  games: BySide<number>;
  /** Final tiebreak points, if the set (or match tiebreak) was decided by one. */
  tiebreak?: BySide<number>;
  /** The "set" was a match tiebreak played in place of a deciding set. */
  matchTiebreak: boolean;
  winner: Side;
  /** False for sets entered as a late-start score rather than charted point by point. */
  charted: boolean;
}

export interface TiebreakState {
  kind: 'set' | 'match';
  /** Who served the first point of the tiebreak. */
  firstServer: Side;
  /** Points needed to win (win by 2 unless `suddenDeath`). */
  target: number;
  /** One deciding point at (target - 1) all instead of a 2-point lead (Fast4 set tiebreaks). */
  suddenDeath: boolean;
}

export interface ScoreState {
  completedSets: SetResult[];
  /** Games in the current set. */
  games: BySide<number>;
  /** Points in the current game or tiebreak (raw counts: 0, 1, 2, 3...). */
  points: BySide<number>;
  /** Set while a set tiebreak or match tiebreak is being played. */
  tiebreak: TiebreakState | null;
  /** Server of the current regular game (or the first server of the current tiebreak). */
  gameServer: Side;
  /** Match winner, once the match is over. */
  winner: Side | null;
}

const zero = (): BySide<number> => ({ player: 0, opponent: 0 });

/** Completed sets are never mutated after they are pushed, so a shallow copy of the list is enough. */
function cloneState(s: ScoreState): ScoreState {
  return {
    completedSets: s.completedSets.slice(),
    games: { ...s.games },
    points: { ...s.points },
    tiebreak: s.tiebreak ? { ...s.tiebreak } : null,
    gameServer: s.gameServer,
    winner: s.winner,
  };
}

export function setsWon(state: ScoreState): BySide<number> {
  const won = zero();
  for (const set of state.completedSets) won[set.winner] += 1;
  return won;
}

/** Number of the set currently being played (1-based), counting any late-start sets. */
export function currentSetNumber(state: ScoreState): number {
  return state.completedSets.length + 1;
}

function maybeStartMatchTiebreak(format: MatchFormat, state: ScoreState): void {
  const won = setsWon(state);
  const needed = setsToWin(format);
  if (format.finalSetMatchTiebreak && won.player === needed - 1 && won.opponent === needed - 1) {
    state.tiebreak = { kind: 'match', firstServer: state.gameServer, target: format.matchTiebreakPoints, suddenDeath: false };
  }
}

function setTiebreak(format: MatchFormat, firstServer: Side): TiebreakState {
  return { kind: 'set', firstServer, target: format.tiebreakPoints, suddenDeath: !!format.tiebreakSuddenDeath };
}

/** At (target - 1) all in a sudden-death tiebreak: the next point decides it. */
function atDecidingPoint(state: ScoreState): boolean {
  const tb = state.tiebreak;
  return !!tb?.suddenDeath && state.points.player === tb.target - 1 && state.points.opponent === tb.target - 1;
}

export function initialScore(format: MatchFormat, firstServer: Side, start?: StartingScore): ScoreState {
  const state: ScoreState = {
    completedSets: [],
    games: zero(),
    points: zero(),
    tiebreak: null,
    gameServer: firstServer,
    winner: null,
  };
  if (start) {
    state.completedSets = start.completedSets.map((s) => ({
      games: { ...s.games },
      matchTiebreak: false,
      winner: s.games.player > s.games.opponent ? 'player' : 'opponent',
      charted: false,
    }));
    state.games = { ...start.games };
  }
  maybeStartMatchTiebreak(format, state);
  if (!state.tiebreak && state.games.player === format.tiebreakAt && state.games.opponent === format.tiebreakAt) {
    state.tiebreak = setTiebreak(format, firstServer);
  }
  return state;
}

/**
 * Who serves the next point. In tiebreaks: first server serves 1 point, then 2 each, alternating.
 * A sudden-death deciding point (Fast4, 4-4) is served by the player who received first.
 */
export function serverOf(state: ScoreState): Side {
  if (!state.tiebreak) return state.gameServer;
  if (atDecidingPoint(state)) return otherSide(state.tiebreak.firstServer);
  const played = state.points.player + state.points.opponent;
  const turn = Math.floor((played + 1) / 2);
  return turn % 2 === 0 ? state.tiebreak.firstServer : otherSide(state.tiebreak.firstServer);
}

/** Would `side` win the current game/tiebreak by winning the next point? */
export function wouldWinGame(format: MatchFormat, state: ScoreState, side: Side): boolean {
  const mine = state.points[side] + 1;
  const theirs = state.points[otherSide(side)];
  if (state.tiebreak) return mine >= state.tiebreak.target && (state.tiebreak.suddenDeath ? mine > theirs : mine - theirs >= 2);
  if (format.noAd) return mine >= 4;
  return mine >= 4 && mine - theirs >= 2;
}

export interface PointResult {
  state: ScoreState;
  /** Set when this point finished a game or tiebreak. */
  gameWinner: Side | null;
  /** Set when this point finished a set (or the match tiebreak). */
  setWinner: Side | null;
  /** Set when this point finished the match. */
  matchWinner: Side | null;
}

function finishSet(format: MatchFormat, state: ScoreState, winner: Side, tiebreak?: BySide<number>): void {
  state.completedSets.push({
    games: { ...state.games },
    ...(tiebreak ? { tiebreak } : {}),
    matchTiebreak: false,
    winner,
    charted: true,
  });
  state.games = zero();
  if (setsWon(state)[winner] >= setsToWin(format)) {
    state.winner = winner;
    return;
  }
  maybeStartMatchTiebreak(format, state);
}

/** Apply one point won by `pointWinner`. Pure: returns a new state. */
export function scorePoint(format: MatchFormat, prev: ScoreState, pointWinner: Side): PointResult {
  if (prev.winner) throw new Error('The match is already over.');
  const state = cloneState(prev);
  const loser = otherSide(pointWinner);
  const result: PointResult = { state, gameWinner: null, setWinner: null, matchWinner: null };
  const winsGame = wouldWinGame(format, state, pointWinner);
  state.points[pointWinner] += 1;
  if (!winsGame) return result;

  result.gameWinner = pointWinner;
  const tb = state.tiebreak;
  const finalPoints = { ...state.points };
  state.points = zero();

  if (tb) {
    state.tiebreak = null;
    // Whoever received first in the tiebreak serves the next game.
    state.gameServer = otherSide(tb.firstServer);
    result.setWinner = pointWinner;
    if (tb.kind === 'match') {
      state.completedSets.push({
        games: { [pointWinner]: 1, [loser]: 0 } as BySide<number>,
        tiebreak: finalPoints,
        matchTiebreak: true,
        winner: pointWinner,
        charted: true,
      });
      state.winner = pointWinner;
    } else {
      state.games[pointWinner] += 1;
      finishSet(format, state, pointWinner, finalPoints);
    }
  } else {
    state.games[pointWinner] += 1;
    state.gameServer = otherSide(state.gameServer);
    if (isFinishedSetScore(format, state.games)) {
      result.setWinner = pointWinner;
      finishSet(format, state, pointWinner);
    } else if (state.games.player === format.tiebreakAt && state.games.opponent === format.tiebreakAt) {
      state.tiebreak = setTiebreak(format, state.gameServer);
    }
  }
  result.matchWinner = state.winner;
  return result;
}

/**
 * The receiver would win a regular (non-tiebreak) game by winning this point.
 * Includes the no-ad deciding point. There are no break points in tiebreaks.
 */
export function isBreakPoint(format: MatchFormat, state: ScoreState): boolean {
  if (state.tiebreak || state.winner) return false;
  return wouldWinGame(format, state, otherSide(serverOf(state)));
}

/** Break points, 30-30, deuce/advantage (incl. the no-ad deciding point), and every tiebreak point. */
export function isPressurePoint(format: MatchFormat, state: ScoreState): boolean {
  if (state.winner) return false;
  if (state.tiebreak) return true;
  const { player, opponent } = state.points;
  const thirtyAll = player === 2 && opponent === 2;
  const deuceOrAd = player >= 3 && opponent >= 3;
  return thirtyAll || deuceOrAd || isBreakPoint(format, state);
}

const GAME_CALLS = ['0', '15', '30', '40'];

/** Point score label, e.g. "30-15", "40-40", "AD-40", "6-5" in a tiebreak. In the given side order. */
export function pointScoreLabel(state: ScoreState, first: Side): string {
  const a = state.points[first];
  const b = state.points[otherSide(first)];
  if (state.tiebreak) return `${a}-${b}`;
  if (a >= 3 && b >= 3) {
    if (a === b) return '40-40';
    return a > b ? 'AD-40' : '40-AD';
  }
  return `${GAME_CALLS[a] ?? a}-${GAME_CALLS[b] ?? b}`;
}

/** e.g. "6-3 2-6 [10-8]" from `first`'s point of view, including tiebreak points like "7-6(5)". */
export function setScoreLine(state: ScoreState, first: Side): string {
  const second = otherSide(first);
  const parts = state.completedSets.map((set) => {
    if (set.matchTiebreak && set.tiebreak) return `[${set.tiebreak[first]}-${set.tiebreak[second]}]`;
    const base = `${set.games[first]}-${set.games[second]}`;
    if (set.tiebreak) return `${base}(${Math.min(set.tiebreak[first], set.tiebreak[second])})`;
    return base;
  });
  return parts.join(' ');
}
