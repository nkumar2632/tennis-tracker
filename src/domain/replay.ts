import {
  currentSetNumber,
  initialScore,
  isBreakPoint,
  isPressurePoint,
  scorePoint,
  serverOf,
  type ScoreState,
} from './scoring';
import type { Match, MatchFormat, Point, Side, StartingScore } from './types';
import { isServeEnding, otherSide } from './types';

/** Who won a point, from how it ended. Winners/aces/unreturned serves win; errors/double faults lose. */
export function pointWinner(point: Pick<Point, 'ending' | 'endedBy'>): Side {
  switch (point.ending) {
    case 'ace':
    case 'unreturned':
    case 'winner':
      return point.endedBy;
    case 'double_fault':
    case 'forced_error':
    case 'unforced_error':
      return otherSide(point.endedBy);
  }
}

export type GameKind = 'game' | 'tiebreak' | 'match_tiebreak';

export interface ReplayedPoint {
  point: Point;
  /** 0-based position in the log. */
  index: number;
  /** Server derived by the scoring engine (authoritative). */
  server: Side;
  receiver: Side;
  /** Who ended the point; for serve endings always the derived server. */
  endedBy: Side;
  winner: Side;
  /** 1-based set number in the match, counting late-start sets. */
  setNumber: number;
  /** 1-based index into `Replay.games`. */
  gameNumber: number;
  gameKind: GameKind;
  isBreakPoint: boolean;
  isPressure: boolean;
  before: ScoreState;
  after: ScoreState;
  endsGame: boolean;
  endsSet: boolean;
  endsMatch: boolean;
}

export interface GameSummary {
  /** 1-based across all charted games (tiebreaks count as games). */
  number: number;
  setNumber: number;
  kind: GameKind;
  /** Server of a regular game; first server of a tiebreak. */
  server: Side;
  /** Null while the game is unfinished. */
  winner: Side | null;
  /** Indices into the log. */
  pointIndices: number[];
}

export interface Replay {
  format: MatchFormat;
  points: ReplayedPoint[];
  games: GameSummary[];
  /** Score after the last scored point (or the starting score). */
  final: ScoreState;
  /** Log entries after the match was already won. Ignored for scoring; log edits never allow them. */
  pointsAfterMatchEnd: number;
}

export interface ReplayInput {
  format: MatchFormat;
  firstServer: Side;
  startingScore?: StartingScore;
  points: readonly Point[];
}

function gameKindOf(state: ScoreState): GameKind {
  if (!state.tiebreak) return 'game';
  return state.tiebreak.kind === 'match' ? 'match_tiebreak' : 'tiebreak';
}

/** Walk the point log through the scoring engine. Pure and cheap (a full match takes well under 1 ms). */
export function replay(input: ReplayInput | Match): Replay {
  const { format, firstServer, startingScore, points } = input;
  let state = initialScore(format, firstServer, startingScore);
  const replayed: ReplayedPoint[] = [];
  const games: GameSummary[] = [];
  let currentGame: GameSummary | null = null;
  let pointsAfterMatchEnd = 0;

  points.forEach((point, index) => {
    if (state.winner) {
      pointsAfterMatchEnd += 1;
      return;
    }
    const server = serverOf(state);
    if (!currentGame) {
      currentGame = {
        number: games.length + 1,
        setNumber: currentSetNumber(state),
        kind: gameKindOf(state),
        server: state.tiebreak ? state.tiebreak.firstServer : state.gameServer,
        winner: null,
        pointIndices: [],
      };
      games.push(currentGame);
    }
    currentGame.pointIndices.push(index);
    // Serve endings always belong to the server, whatever was stored.
    const endedBy = isServeEnding(point.ending) ? server : point.endedBy;
    const winner = pointWinner({ ending: point.ending, endedBy });
    const result = scorePoint(format, state, winner);
    replayed.push({
      point,
      index,
      server,
      receiver: otherSide(server),
      endedBy,
      winner,
      setNumber: currentSetNumber(state),
      gameNumber: currentGame.number,
      gameKind: currentGame.kind,
      isBreakPoint: isBreakPoint(format, state),
      isPressure: isPressurePoint(format, state),
      before: state,
      after: result.state,
      endsGame: result.gameWinner !== null,
      endsSet: result.setWinner !== null,
      endsMatch: result.matchWinner !== null,
    });
    if (result.gameWinner) {
      currentGame.winner = result.gameWinner;
      currentGame = null;
    }
    state = result.state;
  });

  return { format, points: replayed, games, final: state, pointsAfterMatchEnd };
}
