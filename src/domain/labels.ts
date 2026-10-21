/** Plain-language wording, so the timeline never needs codes like "1:FOR". */
import type { GameSummary, Replay, ReplayedPoint } from './replay';
import { setScoreLine, type ScoreState } from './scoring';
import type { BySide, Ending, EventType, Match, MatchFormat, Side, Stroke, Surface } from './types';
import { STROKES, isServeEnding, otherSide } from './types';

export const ENDING_LABELS: Record<Ending, string> = {
  ace: 'ace',
  unreturned: 'unreturned serve',
  double_fault: 'double fault',
  winner: 'winner',
  forced_error: 'forced error',
  unforced_error: 'unforced error',
};

export const STROKE_LABELS: Record<Stroke, string> = {
  forehand: 'forehand',
  backhand: 'backhand',
  volley: 'volley',
  overhead: 'overhead',
  drop_shot: 'drop shot',
  return: 'return',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  hs_dual: 'HS dual match',
  usta: 'USTA',
  utr: 'UTR',
  practice: 'Practice',
};

export const SURFACE_LABELS: Record<Surface, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
};

/** e.g. "Sam: backhand unforced error" or "Lee: ace (2nd serve)". */
export function describePoint(rp: ReplayedPoint, names: BySide<string>): string {
  const { point } = rp;
  const who = names[rp.endedBy];
  const what = point.stroke
    ? `${STROKE_LABELS[point.stroke]} ${ENDING_LABELS[point.ending]}`
    : ENDING_LABELS[point.ending];
  const secondServe = point.serve === 2 && point.ending !== 'double_fault' ? ' (2nd serve)' : '';
  return `${who}: ${what}${secondServe}`;
}

/** Stroke chips to offer for a point: none for serve endings; Return first when the receiver ended it. */
export function strokeChoices(rp: Pick<ReplayedPoint, 'point' | 'endedBy' | 'receiver'>): Stroke[] {
  if (isServeEnding(rp.point.ending)) return [];
  const rally = STROKES.filter((s) => s !== 'return');
  return rp.endedBy === rp.receiver ? ['return', ...rally] : rally;
}

/** e.g. "Best of 3 sets · 7-pt tiebreak at 6-6 · 10-pt match tiebreak for the 3rd set · no-ad". */
export function formatSummary(f: MatchFormat): string {
  const parts: string[] = [];
  if (f.bestOf === 1) parts.push(f.gamesPerSet === 8 ? '8-game pro set' : `One ${f.gamesPerSet}-game set`);
  else parts.push(f.gamesPerSet === 6 ? 'Best of 3 sets' : `Best of 3 ${f.gamesPerSet}-game sets`);
  parts.push(`${f.tiebreakPoints}-pt tiebreak at ${f.tiebreakAt}-${f.tiebreakAt}`);
  if (f.bestOf === 3 && f.finalSetMatchTiebreak) parts.push(`${f.matchTiebreakPoints}-pt match tiebreak for the 3rd set`);
  if (f.noAd) parts.push('no-ad');
  return parts.join(' · ');
}

/** Completed sets plus the set in progress, e.g. "6-4 2-1" or "6-4 4-6 [7-5]". */
export function scoreLine(state: ScoreState, first: Side): string {
  const done = setScoreLine(state, first);
  if (state.winner) return done;
  const second = otherSide(first);
  const current = state.tiebreak?.kind === 'match'
    ? `[${state.points[first]}-${state.points[second]}]`
    : `${state.games[first]}-${state.games[second]}`;
  return done ? `${done} ${current}` : current;
}

/** One line for match lists, e.g. "Sam won 6-4 6-3" or "Stopped at 6-4 2-1". */
export function resultLine(match: Match, r: Replay, names: BySide<string>): string {
  const winner = r.final.winner;
  if (winner) return `${names[winner]} won ${setScoreLine(r.final, winner)}`;
  const score = scoreLine(r.final, 'player');
  switch (match.status) {
    case 'retired':
      return match.retiredSide ? `${names[match.retiredSide]} retired at ${score}` : `Retired at ${score}`;
    case 'stopped':
      return `Stopped at ${score}`;
    case 'suspended':
      return `Suspended at ${score}`;
    default:
      return r.points.length === 0 ? 'Not started' : `In progress · ${score}`;
  }
}

/** e.g. "Set 1 · Game 3 · Sam serving", "Set 2 · Tiebreak", "Match tiebreak". */
export function gameHeading(game: GameSummary, r: Replay, names: BySide<string>): string {
  if (game.kind === 'match_tiebreak') return 'Match tiebreak';
  if (game.kind === 'tiebreak') return `Set ${game.setNumber} · Tiebreak`;
  const first = r.points[game.pointIndices[0]!]!;
  const gameInSet = first.before.games.player + first.before.games.opponent + 1;
  return `Set ${game.setNumber} · Game ${gameInSet} · ${names[game.server]} serving`;
}
