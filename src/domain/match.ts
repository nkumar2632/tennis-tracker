import { validateFormat, validateStartingScore } from './format';
import { newId } from './ids';
import { replay, type Replay } from './replay';
import type { Match, MatchStatus, Side } from './types';
import { otherSide } from './types';

export const SCHEMA_VERSION = 1;

export type MatchSetup = Omit<
  Match,
  'id' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'status' | 'retiredSide' | 'points' | 'pendingFault'
>;

export function createMatch(setup: MatchSetup, now = Date.now(), id = newId()): Match {
  const errors = validateFormat(setup.format);
  if (setup.startingScore) errors.push(...validateStartingScore(setup.format, setup.startingScore));
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
