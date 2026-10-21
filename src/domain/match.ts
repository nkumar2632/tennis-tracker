import { validateFormat, validateStartingScore } from './format';
import { newId } from './ids';
import { replaceLog } from './log';
import { replay, type Replay } from './replay';
import type { Match, MatchStatus, Side } from './types';
import { otherSide } from './types';

export const SCHEMA_VERSION = 1;

export type MatchSetup = Omit<
  Match,
  'id' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'status' | 'retiredSide' | 'points' | 'pendingFault'
>;

/** Problems with a setup's format or late-start score; empty when it can be used. */
export function validateSetup(setup: MatchSetup): string[] {
  const errors = validateFormat(setup.format);
  if (errors.length === 0 && setup.startingScore) {
    errors.push(...validateStartingScore(setup.format, setup.startingScore));
  }
  return errors;
}

export function createMatch(setup: MatchSetup, now = Date.now(), id = newId()): Match {
  const errors = validateSetup(setup);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return {
    ...setup,
    id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    status: 'in_progress',
    points: [],
    pendingFault: false,
  };
}

/**
 * Change a match's details after it was created. Format, first server and late-start score may change
 * too: the log is re-scored, and the change is refused if points would fall after the end of the match.
 */
export function updateSetup(match: Match, setup: MatchSetup, now = Date.now()): Match {
  const errors = validateSetup(setup);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const { id, schemaVersion, createdAt, status, retiredSide, points, pendingFault } = match;
  const next: Match = { ...setup, id, schemaVersion, createdAt, updatedAt: now, status, points, pendingFault };
  if (retiredSide) next.retiredSide = retiredSide;
  return replaceLog(next, points, now);
}

/** The setup fields of a match, e.g. to prefill the edit form. */
export function setupOf(match: Match): MatchSetup {
  const { id: _i, schemaVersion: _s, createdAt: _c, updatedAt: _u, status: _st, retiredSide: _r, points: _p, pendingFault: _f, ...setup } =
    match;
  return setup;
}

export interface MatchOutcome {
  status: MatchStatus;
  winner: Side | null;
  /** Counts in the win/loss record: matches won on court and retirements. */
  countsInRecord: boolean;
}

export function matchOutcome(match: Match, r: Replay = replay(match)): MatchOutcome {
  if (r.final.winner) return { status: 'completed', winner: r.final.winner, countsInRecord: true };
  if (match.status === 'retired' && match.retiredSide) {
    return { status: 'retired', winner: otherSide(match.retiredSide), countsInRecord: true };
  }
  return { status: match.status, winner: null, countsInRecord: false };
}

export function isResumable(match: Match): boolean {
  return match.status === 'in_progress' || match.status === 'suspended';
}
