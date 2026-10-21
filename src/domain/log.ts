/**
 * Every change to a match's point log goes through these pure functions. Each returns a new Match
 * and re-derives everything downstream, so undo and edits "just work".
 */
import { newId } from './ids';
import { replay, type Replay } from './replay';
import { serverOf } from './scoring';
import type { Ending, Match, MatchStatus, Point, Side, Stroke } from './types';
import { isServeEnding } from './types';

export class MatchLogError extends Error {}

/** What the user chose for a point. The server (and endedBy for serve endings) is derived. */
export interface PointInput {
  ending: Ending;
  /** Required for winner / forced_error / unforced_error. Ignored for serve endings. */
  endedBy?: Side;
  stroke?: Stroke;
}

/** A full description of a point for edit/insert, including which serve it was played on. */
export interface PointEdit extends PointInput {
  serve: 1 | 2;
}

function validateInput(input: PointEdit): void {
  if (input.ending === 'double_fault' && input.serve !== 2) {
    throw new MatchLogError('A double fault is always on the second serve.');
  }
  if (!isServeEnding(input.ending) && !input.endedBy) {
    throw new MatchLogError('Say who hit the winner or made the error.');
  }
  if (input.stroke && isServeEnding(input.ending)) {
    throw new MatchLogError('Strokes are only recorded for rally endings.');
  }
}

function makePoint(input: PointEdit, server: Side, id: string, loggedAt: number): Point {
  const point: Point = {
    id,
    server,
    serve: input.serve,
    ending: input.ending,
    endedBy: isServeEnding(input.ending) ? server : (input.endedBy as Side),
    loggedAt,
  };
  if (input.stroke) point.stroke = input.stroke;
  return point;
}

/** A match won on the court is always 'completed'; un-winning it (undo/edit) makes it resumable again. */
function statusAfter(prev: MatchStatus, matchWon: boolean): MatchStatus {
  if (matchWon) return 'completed';
  return prev === 'completed' ? 'in_progress' : prev;
}

/**
 * Replace the log: re-derive each point's server (and endedBy for serve endings), reject logs that
 * continue past the end of the match, and update status.
 */
export function replaceLog(match: Match, points: Point[], now = Date.now()): Match {
  return withPoints(match, points, now);
}

function withPoints(match: Match, points: Point[], now: number, pendingFault = match.pendingFault): Match {
  const r = replay({ ...match, points });
  if (r.pointsAfterMatchEnd > 0) {
    throw new MatchLogError(
      'That change would end the match before the last logged point. Delete the later points first.',
    );
  }
  const normalized = points.map((p, i) => {
    const server = r.points[i]!.server;
    const endedBy = isServeEnding(p.ending) ? server : p.endedBy;
    return p.server === server && p.endedBy === endedBy ? p : { ...p, server, endedBy };
  });
  const matchWon = r.final.winner !== null;
  const next: Match = {
    ...match,
    points: normalized,
    pendingFault: matchWon ? false : pendingFault,
    status: statusAfter(match.status, matchWon),
    updatedAt: now,
  };
  if (next.status !== 'retired') delete next.retiredSide;
  return next;
}

function assertCanLog(match: Match, r: Replay): void {
  if (r.final.winner) throw new MatchLogError('The match is over.');
  if (match.status === 'retired' || match.status === 'stopped') {
    throw new MatchLogError('This match has ended. Resume it to keep charting.');
  }
}

/** First serve missed: the next point is played on the second serve. */
export function recordFault(match: Match, now = Date.now()): Match {
  assertCanLog(match, replay(match));
  if (match.pendingFault) throw new MatchLogError('Already on the second serve. Log a double fault instead.');
  return { ...match, pendingFault: true, updatedAt: now };
}

/** Log the next point. Serve number comes from whether a fault is pending. */
export function appendPoint(match: Match, input: PointInput, now = Date.now(), id = newId()): Match {
  const r = replay(match);
  assertCanLog(match, r);
  const edit: PointEdit = { ...input, serve: match.pendingFault ? 2 : 1 };
  validateInput(edit);
  const point = makePoint(edit, serverOf(r.final), id, now);
  const next = withPoints(match, [...match.points, point], now, false);
  return next.status === 'suspended' ? { ...next, status: 'in_progress' } : next;
}

/**
 * Step back one tap. A pending fault is cleared first. Undoing a second-serve point (including a
 * double fault) returns to "second serve", because the fault itself really happened.
 */
export function undo(match: Match, now = Date.now()): Match {
  if (match.pendingFault) return { ...match, pendingFault: false, updatedAt: now };
  const last = match.points.at(-1);
  if (!last) return match;
  return withPoints(match, match.points.slice(0, -1), now, last.serve === 2);
}

export function canUndo(match: Match): boolean {
  return match.pendingFault || match.points.length > 0;
}

function indexOfPoint(match: Match, pointId: string): number {
  const index = match.points.findIndex((p) => p.id === pointId);
  if (index < 0) throw new MatchLogError('That point no longer exists.');
  return index;
}

/** Set or clear the optional stroke on a logged point. */
export function setStroke(match: Match, pointId: string, stroke: Stroke | undefined, now = Date.now()): Match {
  const index = indexOfPoint(match, pointId);
  const point = match.points[index]!;
  if (stroke && isServeEnding(point.ending)) {
    throw new MatchLogError('Strokes are only recorded for rally endings.');
  }
  const updated: Point = { ...point };
  if (stroke) updated.stroke = stroke;
  else delete updated.stroke;
  const points = match.points.slice();
  points[index] = updated;
  return { ...match, points, updatedAt: now };
}

/** Change any past point. Later points are re-scored (and their servers re-derived). */
export function editPoint(match: Match, pointId: string, edit: PointEdit, now = Date.now()): Match {
  validateInput(edit);
  const index = indexOfPoint(match, pointId);
  const old = match.points[index]!;
  const points = match.points.slice();
  points[index] = makePoint(edit, old.server, old.id, old.loggedAt);
  return withPoints(match, points, now);
}

export function deletePoint(match: Match, pointId: string, now = Date.now()): Match {
  const index = indexOfPoint(match, pointId);
  const points = match.points.filter((_, i) => i !== index);
  return withPoints(match, points, now);
}

/** Insert a missed point before the given point (or at the end when `beforePointId` is null). */
export function insertPoint(
  match: Match,
  beforePointId: string | null,
  edit: PointEdit,
  now = Date.now(),
  id = newId(),
): Match {
  validateInput(edit);
  const index = beforePointId === null ? match.points.length : indexOfPoint(match, beforePointId);
  const neighbor = match.points[index] ?? match.points[index - 1];
  // Placeholder server: withPoints re-derives it.
  const point = makePoint(edit, 'player', id, neighbor?.loggedAt ?? now);
  const points = [...match.points.slice(0, index), point, ...match.points.slice(index)];
  return withPoints(match, points, now);
}

/** End a match early. Retirements count in the win/loss record; stopped matches do not. */
export function endMatchEarly(
  match: Match,
  reason: { kind: 'retired'; retiredSide: Side } | { kind: 'stopped' },
  now = Date.now(),
): Match {
  if (replay(match).final.winner) throw new MatchLogError('The match is already complete.');
  const next: Match = { ...match, pendingFault: false, updatedAt: now, status: reason.kind };
  if (reason.kind === 'retired') next.retiredSide = reason.retiredSide;
  else delete next.retiredSide;
  return next;
}

/** Pause a match to finish another day. It stays resumable. */
export function suspendMatch(match: Match, now = Date.now()): Match {
  if (replay(match).final.winner) throw new MatchLogError('The match is already complete.');
  return { ...match, status: 'suspended', updatedAt: now };
}

/** Reopen a suspended, retired or stopped match for charting. */
export function resumeMatch(match: Match, now = Date.now()): Match {
  if (replay(match).final.winner) throw new MatchLogError('The match is already complete.');
  const next: Match = { ...match, status: 'in_progress', updatedAt: now };
  delete next.retiredSide;
  return next;
}
