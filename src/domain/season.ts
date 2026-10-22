/** Which matches make up "his season", and how one match compares with it. */
import { replay } from './replay';
import { computeStats, pct, sumStats, type MatchStats, type Ratio, type SideStats } from './stats';
import type { Match } from './types';

/** Matches with a result or deliberately ended: completed, retired, or stopped (stats still count). */
export function isFinished(m: Match): boolean {
  return m.status === 'completed' || m.status === 'retired' || m.status === 'stopped';
}

/** The ISO date `months` months before `iso` (clamped to the end of shorter months). */
export function monthsBefore(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) - months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
}

export interface SeasonOptions {
  months?: number;
  includePractice?: boolean;
}

/**
 * The season baseline for a match: other finished, charted matches in the `months` months up to
 * and including its date. Practice matches are left out unless asked for.
 */
export function seasonBaseline(all: readonly Match[], current: Match, options: SeasonOptions = {}): Match[] {
  const { months = 12, includePractice = false } = options;
  const from = monthsBefore(current.date, months);
  return all.filter(
    (m) =>
      m.id !== current.id &&
      isFinished(m) &&
      m.points.length > 0 &&
      (includePractice || m.eventType !== 'practice') &&
      m.date > from &&
      m.date <= current.date,
  );
}

/** Fewer matches than this and a comparison says more about luck than form. */
export const MIN_SEASON_MATCHES = 3;
/** A rate needs at least this many chances in both the match and the season to be compared. */
export const MIN_CHANCES = 5;
/** Differences smaller than this (percentage points) aren't highlighted. */
export const MIN_HIGHLIGHT_PP = 3;
/** How many best and worst differences to highlight. */
export const HIGHLIGHTS = 3;

interface ComparisonDef {
  id: string;
  label: string;
  higherIsBetter: boolean;
  /** Every comparison is a rate, so long and short matches compare fairly. */
  rate: (s: SideStats, totalPoints: number) => Ratio;
}

const servicePoints = (s: SideStats) => s.serve.firstServeIn.den;

const COMPARISONS: ComparisonDef[] = [
  { id: 'firstServeIn', label: '1st serve in', higherIsBetter: true, rate: (s) => s.serve.firstServeIn },
  { id: 'firstServeWon', label: 'Points won on 1st serve', higherIsBetter: true, rate: (s) => s.serve.firstServePointsWon },
  { id: 'secondServeWon', label: 'Points won on 2nd serve', higherIsBetter: true, rate: (s) => s.serve.secondServePointsWon },
  { id: 'aces', label: 'Aces (% of service points)', higherIsBetter: true, rate: (s) => ({ num: s.serve.aces, den: servicePoints(s) }) },
  {
    id: 'doubleFaults',
    label: 'Double faults (% of service points)',
    higherIsBetter: false,
    rate: (s) => ({ num: s.serve.doubleFaults, den: servicePoints(s) }),
  },
  { id: 'hold', label: 'Service games held', higherIsBetter: true, rate: (s) => s.serve.serviceGamesHeld },
  { id: 'returnInPlay', label: 'Returns in play', higherIsBetter: true, rate: (s) => s.return.returnInPlay },
  { id: 'returnVsFirst', label: 'Points won vs 1st serve', higherIsBetter: true, rate: (s) => s.return.pointsWonVsFirstServe },
  { id: 'returnVsSecond', label: 'Points won vs 2nd serve', higherIsBetter: true, rate: (s) => s.return.pointsWonVsSecondServe },
  { id: 'break', label: 'Return games won (breaks)', higherIsBetter: true, rate: (s) => s.return.returnGamesWon },
  { id: 'winners', label: 'Winners (% of points played)', higherIsBetter: true, rate: (s, t) => ({ num: s.rally.winners, den: t }) },
  {
    id: 'unforcedErrors',
    label: 'Unforced errors (% of points played)',
    higherIsBetter: false,
    rate: (s, t) => ({ num: s.rally.unforcedErrors, den: t }),
  },
  { id: 'bpSaved', label: 'Break points saved', higherIsBetter: true, rate: (s) => s.breakPoints.saved },
  { id: 'bpConverted', label: 'Break points converted', higherIsBetter: true, rate: (s) => s.breakPoints.converted },
  { id: 'pressureWon', label: 'Won on pressure points', higherIsBetter: true, rate: (s) => s.pressure.pressurePointsWon },
];

export interface ComparisonRow {
  id: string;
  label: string;
  match: Ratio;
  season: Ratio;
  /** Percentage-point difference, match minus season; null when either has too little data. */
  diff: number | null;
  /** True when the difference is in his favour (accounts for lower-is-better stats). */
  better: boolean | null;
  highlight: 'better' | 'worse' | null;
}

export interface SeasonComparison {
  /** Number of matches in the baseline. */
  matches: number;
  /** The baseline is too small to compare (fewer than MIN_SEASON_MATCHES). */
  tooFew: boolean;
  rows: ComparisonRow[];
}

/** Compare the son's stats in one match with his season so far. */
export function compareWithSeason(matchStats: MatchStats, baseline: readonly Match[]): SeasonComparison {
  const tooFew = baseline.length < MIN_SEASON_MATCHES;
  if (tooFew) return { matches: baseline.length, tooFew, rows: [] };
  const season = sumStats(baseline.map((m) => computeStats(replay(m))))!;
  const rows: ComparisonRow[] = COMPARISONS.map((c) => {
    const match = c.rate(matchStats.player, matchStats.totalPoints);
    const seasonRate = c.rate(season.player, season.totalPoints);
    const enough = match.den >= MIN_CHANCES && seasonRate.den >= MIN_CHANCES;
    const diff = enough ? pct(match)! - pct(seasonRate)! : null;
    const better = diff === null || diff === 0 ? null : c.higherIsBetter ? diff > 0 : diff < 0;
    return { id: c.id, label: c.label, match, season: seasonRate, diff, better, highlight: null };
  });
  // Highlight the largest differences each way, ignoring small ones.
  const ranked = rows
    .filter((r) => r.diff !== null && Math.abs(r.diff) >= MIN_HIGHLIGHT_PP)
    .sort((a, b) => Math.abs(b.diff!) - Math.abs(a.diff!));
  ranked.filter((r) => r.better === true).slice(0, HIGHLIGHTS).forEach((r) => (r.highlight = 'better'));
  ranked.filter((r) => r.better === false).slice(0, HIGHLIGHTS).forEach((r) => (r.highlight = 'worse'));
  return { matches: baseline.length, tooFew, rows };
}
