/** The season view: UTR bands, filters, win/loss record, trends and head-to-head. */
import { matchOutcome } from './match';
import { opponentKey } from './opponents';
import { replay } from './replay';
import { isFinished, monthsBefore } from './season';
import { aggregateStats, computeStats, pct, type MatchStats, type Ratio, type SideStats } from './stats';
import type { EventType, Match, Surface } from './types';

// ---------- UTR bands ----------

export type UtrBand = 'lower' | 'even' | 'higher' | 'unknown';

export const UTR_BANDS: readonly UtrBand[] = ['lower', 'even', 'higher', 'unknown'];

export const UTR_BAND_LABELS: Record<UtrBand, string> = {
  lower: 'Lower-rated',
  even: 'Even',
  higher: 'Higher-rated',
  unknown: 'Unknown UTR',
};

/** What a band means, e.g. "more than 0.5 below Sam". */
export function utrBandHint(band: UtrBand, playerName: string): string {
  switch (band) {
    case 'lower':
      return `more than 0.5 below ${playerName}`;
    case 'even':
      return 'within 0.5';
    case 'higher':
      return `more than 0.5 above ${playerName}`;
    case 'unknown':
      return 'a UTR is missing';
  }
}

/** Within this many UTR points either way counts as "even". */
export const EVEN_BAND = 0.5;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * The player's UTR for a match: as entered, else from their nearest-dated match that has one
 * (earlier wins ties).
 */
export function playerUtrFor(match: Match, all: readonly Match[]): number | undefined {
  if (match.playerUtr !== undefined) return match.playerUtr;
  let best: { utr: number; days: number; date: string } | undefined;
  for (const m of all) {
    if (m.playerUtr === undefined || m.playerId !== match.playerId) continue;
    const days = daysBetween(m.date, match.date);
    if (!best || days < best.days || (days === best.days && m.date < best.date)) best = { utr: m.playerUtr, days, date: m.date };
  }
  return best?.utr;
}

/** Opponent's UTR minus the player's, in bands. Unknown when either UTR isn't available. */
export function utrBand(match: Match, all: readonly Match[]): UtrBand {
  const mine = playerUtrFor(match, all);
  if (match.opponentUtr === undefined || mine === undefined) return 'unknown';
  const diff = Math.round((match.opponentUtr - mine) * 100) / 100; // avoid 7.6 - 7.1 = 0.4999…
  if (diff < -EVEN_BAND) return 'lower';
  if (diff > EVEN_BAND) return 'higher';
  return 'even';
}

// ---------- Filters ----------

/** 'competitive' = every event type except practice. */
export type EventFilter = 'competitive' | 'all' | EventType;

export type DatePreset = 'last12' | 'last6' | 'last3' | 'thisYear' | 'all' | 'custom';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  last12: 'Last 12 months',
  last6: 'Last 6 months',
  last3: 'Last 3 months',
  thisYear: 'Since January 1',
  all: 'All dates',
  custom: 'Choose dates…',
};

export interface SeasonFilter {
  dates: DatePreset;
  /** Inclusive YYYY-MM-DD bounds; empty means open-ended. Set from `dates` unless it's 'custom'. */
  from: string;
  to: string;
  events: EventFilter;
  surface: 'all' | Surface;
  band: 'all' | UtrBand;
}

/** The filter with a new date preset; 'custom' starts from the dates currently shown. */
export function withDates(f: SeasonFilter, dates: DatePreset, today: string): SeasonFilter {
  switch (dates) {
    case 'last12':
      return { ...f, dates, from: monthsBefore(today, 12), to: today };
    case 'last6':
      return { ...f, dates, from: monthsBefore(today, 6), to: today };
    case 'last3':
      return { ...f, dates, from: monthsBefore(today, 3), to: today };
    case 'thisYear':
      return { ...f, dates, from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'all':
      return { ...f, dates, from: '', to: '' };
    case 'custom':
      return f.dates === 'all' ? { ...withDates(f, 'last12', today), dates } : { ...f, dates };
  }
}

/** Last 12 months, no practice, any surface and opponent. */
export function defaultFilter(today: string): SeasonFilter {
  return withDates({ dates: 'last12', from: '', to: '', events: 'competitive', surface: 'all', band: 'all' }, 'last12', today);
}

export function filterMatches(all: readonly Match[], f: SeasonFilter): Match[] {
  return all.filter((m) => {
    if (f.from && m.date < f.from) return false;
    if (f.to && m.date > f.to) return false;
    if (f.events === 'competitive' ? m.eventType === 'practice' : f.events !== 'all' && m.eventType !== f.events) return false;
    if (f.surface !== 'all' && m.surface !== f.surface) return false;
    if (f.band !== 'all' && utrBand(m, all) !== f.band) return false;
    return true;
  });
}

// ---------- Record ----------

export interface WinLoss {
  wins: number;
  losses: number;
  /** Stopped, suspended and in-progress matches: listed, but not in the record. */
  notCounted: number;
}

export function winLoss(matches: readonly Match[]): WinLoss {
  const out: WinLoss = { wins: 0, losses: 0, notCounted: 0 };
  for (const m of matches) {
    const o = matchOutcome(m);
    if (!o.countsInRecord || !o.winner) out.notCounted += 1;
    else if (o.winner === 'player') out.wins += 1;
    else out.losses += 1;
  }
  return out;
}

export function winPct(r: WinLoss): number | null {
  const played = r.wins + r.losses;
  return played === 0 ? null : (r.wins / played) * 100;
}

// ---------- Trends ----------

export interface TrendDef {
  id: string;
  label: string;
  kind: 'percent' | 'count';
  /** True when a lower number is better (shown in the chart caption). */
  lowerIsBetter?: boolean;
  get: (s: SideStats) => Ratio | number;
}

export const TRENDS: TrendDef[] = [
  { id: 'firstServeIn', label: '1st serve in', kind: 'percent', get: (s) => s.serve.firstServeIn },
  { id: 'secondServeWon', label: 'Points won on 2nd serve', kind: 'percent', get: (s) => s.serve.secondServePointsWon },
  { id: 'doubleFaults', label: 'Double faults', kind: 'count', lowerIsBetter: true, get: (s) => s.serve.doubleFaults },
  { id: 'unforcedErrors', label: 'Unforced errors', kind: 'count', lowerIsBetter: true, get: (s) => s.rally.unforcedErrors },
  { id: 'winnersMinusUe', label: 'Winners minus unforced errors', kind: 'count', get: (s) => s.rally.winnersMinusUnforcedErrors },
  { id: 'pressureWon', label: 'Won on pressure points', kind: 'percent', get: (s) => s.pressure.pressurePointsWon },
];

export interface TrendPoint {
  matchId: string;
  date: string;
  opponent: string;
  value: number;
  /** e.g. "24/38" for percentages; empty for counts. */
  detail: string;
}

// Matches are never mutated (every edit makes a new object), so stats can be cached per object.
const statsCache = new WeakMap<Match, MatchStats>();
function statsOf(m: Match): MatchStats {
  let s = statsCache.get(m);
  if (!s) statsCache.set(m, (s = computeStats(replay(m))));
  return s;
}

function trendMatches(matches: readonly Match[]): Match[] {
  return matches
    .filter((m) => isFinished(m) && m.points.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/** His value for one stat in each finished, charted match, oldest first. Matches with no data are skipped. */
export function trendSeries(matches: readonly Match[], def: TrendDef): TrendPoint[] {
  return trendMatches(matches).flatMap((m) => {
    const v = def.get(statsOf(m).player);
    if (typeof v === 'number') return [{ matchId: m.id, date: m.date, opponent: m.opponentName, value: v, detail: '' }];
    const p = pct(v);
    return p === null ? [] : [{ matchId: m.id, date: m.date, opponent: m.opponentName, value: p, detail: `${v.num}/${v.den}` }];
  });
}

/**
 * His season average over the same matches, as the Report computes it: percentages pooled over
 * all points, counts per match. Null when there's nothing to measure.
 */
export function trendAverage(matches: readonly Match[], def: TrendDef): number | null {
  const all = aggregateStats(trendMatches(matches).map(statsOf));
  if (!all) return null;
  const v = def.get(all.player);
  return typeof v === 'number' ? v : pct(v);
}

// ---------- Head-to-head ----------

export interface HeadToHead {
  name: string;
  record: WinLoss;
  /** Newest first. */
  matches: Match[];
}

/** Opponents he has played more than once, most matches first (then most recent). All time, all events. */
export function headToHead(all: readonly Match[]): HeadToHead[] {
  const groups = new Map<string, Match[]>();
  for (const m of all) {
    const key = opponentKey(m.opponentName);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.values()]
    .filter((ms) => ms.length > 1)
    .map((ms) => {
      const newest = [...ms].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
      return { name: newest[0]!.opponentName.trim(), record: winLoss(ms), matches: newest };
    })
    .sort((a, b) => b.matches.length - a.matches.length || b.matches[0]!.date.localeCompare(a.matches[0]!.date));
}

