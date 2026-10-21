/** Plain-language wording, so the timeline never needs codes like "1:FOR". */
import type { ReplayedPoint } from './replay';
import type { BySide, Ending, EventType, Stroke, Surface } from './types';

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
