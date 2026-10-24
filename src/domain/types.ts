/**
 * Core data model. The point log (`Match.points`) is the single source of truth:
 * scores and stats are always derived from it (see replay.ts and stats.ts), never stored.
 */

/** 'player' is always the son; 'opponent' is whoever he is playing. */
export type Side = 'player' | 'opponent';

export const SIDES: readonly Side[] = ['player', 'opponent'];

export function otherSide(side: Side): Side {
  return side === 'player' ? 'opponent' : 'player';
}

export type BySide<T> = Record<Side, T>;

/**
 * How a point ended. A fixed set:
 * - ace: serve not touched by the receiver. Ended by the server.
 * - unreturned: receiver touched the serve but could not get it back in play. Ended by the server.
 * - double_fault: second serve missed. Ended by the server.
 * - winner: shot the opponent could not touch. Ended by the hitter.
 * - forced_error / unforced_error: a missed shot. ALWAYS attributed to the player who missed.
 */
export type Ending =
  | 'ace'
  | 'unreturned'
  | 'double_fault'
  | 'winner'
  | 'forced_error'
  | 'unforced_error';

export const SERVE_ENDINGS: readonly Ending[] = ['ace', 'unreturned', 'double_fault'];
export const RALLY_ENDINGS: readonly Ending[] = ['winner', 'forced_error', 'unforced_error'];

export function isServeEnding(ending: Ending): boolean {
  return SERVE_ENDINGS.includes(ending);
}

/** Optional: the shot that ended a rally (winner / forced error / unforced error). */
export type Stroke = 'forehand' | 'backhand' | 'volley' | 'overhead' | 'drop_shot' | 'return';

export const STROKES: readonly Stroke[] = [
  'forehand',
  'backhand',
  'volley',
  'overhead',
  'drop_shot',
  'return',
];

export interface Point {
  id: string;
  /** Who served. Derived by the scoring engine when the point is logged or the log is edited. */
  server: Side;
  /** 1 = first serve went in; 2 = the first serve was a fault. Double faults are always 2. */
  serve: 1 | 2;
  ending: Ending;
  /** Who ended the point: the server for serve endings, the hitter for winners, the player who missed for errors. */
  endedBy: Side;
  stroke?: Stroke;
  /** When the point was logged (epoch ms). Stored, not displayed. */
  loggedAt: number;
}

export interface MatchFormat {
  /** 1 (a single set, e.g. an 8-game pro set) or 3. */
  bestOf: 1 | 3;
  /** Games needed to win a set (win by 2), e.g. 6, or 8 for a pro set. */
  gamesPerSet: number;
  /** A set tiebreak is played at this many games all, e.g. 6 (6-6) or 8 (8-8). */
  tiebreakAt: number;
  /** Points needed to win a set tiebreak (win by 2 unless `tiebreakSuddenDeath`), usually 7. */
  tiebreakPoints: number;
  /**
   * Set tiebreaks end on one deciding point at (tiebreakPoints - 1) all instead of needing a 2-point
   * lead, e.g. Fast4: first to 5, next point wins at 4-4. Missing (false) on older matches.
   */
  tiebreakSuddenDeath?: boolean;
  /** Deciding set replaced by a match tiebreak. Only meaningful when bestOf is 3. */
  finalSetMatchTiebreak: boolean;
  /** Points needed to win a match tiebreak (win by 2), usually 10. */
  matchTiebreakPoints: number;
  /** No-ad: at deuce the next point wins the game. Does not affect tiebreaks. */
  noAd: boolean;
}

/** A finished set, as recorded at the start of charting when joining a match late. */
export interface StartingSet {
  games: BySide<number>;
}

/** Score when charting began, for matches joined late. Charting always starts at the beginning of a game. */
export interface StartingScore {
  completedSets: StartingSet[];
  games: BySide<number>;
}

export type EventType = 'hs_dual' | 'usta' | 'utr' | 'practice';
export type Surface = 'hard' | 'clay' | 'grass';
export type Handedness = 'right' | 'left';

/**
 * - in_progress / suspended: can be resumed (suspended = paused for another day, e.g. rain).
 * - completed: someone won the match on the court (derived from the log).
 * - retired: ended early because `retiredSide` retired; counts in the win/loss record.
 * - stopped: ended early with no result (e.g. dual match already decided); excluded from win/loss,
 *   but its points still count toward stats.
 */
export type MatchStatus = 'in_progress' | 'suspended' | 'completed' | 'retired' | 'stopped';

/** Someone being charted. Each match belongs to one player; the opponent is just a name on the match. */
export interface Player {
  id: string;
  name: string;
  createdAt: number;
}

export interface Match {
  id: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  status: MatchStatus;
  retiredSide?: Side;

  // Setup
  /** The player being charted (always shown on the left). */
  playerId: string;
  /** YYYY-MM-DD */
  date: string;
  eventName: string;
  eventType: EventType;
  round?: string;
  surface: Surface;
  indoor: boolean;
  opponentName: string;
  opponentUtr?: number;
  opponentHand?: Handedness;
  /** The player's UTR at the time of the match. */
  playerUtr?: number;
  notes: string;
  format: MatchFormat;
  /** Who serves the first charted point. */
  firstServer: Side;
  startingScore?: StartingScore;

  /** THE log. */
  points: Point[];
  /** First serve was a fault and the point is not finished yet. Persisted so resume is exact. */
  pendingFault: boolean;
}
