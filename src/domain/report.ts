/** Everything the match report says, as plain data (turned into a PDF by pdfDoc.ts). */
import { EVENT_TYPE_LABELS, SURFACE_LABELS, formatSummary, resultLine } from './labels';
import { replay, type Replay } from './replay';
import { compareWithSeason, monthsBefore, seasonBaseline, type SeasonComparison } from './season';
import { setScoreLine } from './scoring';
import { statTables, strokeTable, type StatTable, type StrokeRow } from './statRows';
import { computeStats } from './stats';
import type { BySide, Match } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 21, 2026" from "2026-10-21" (no locale, so reports read the same everywhere). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface Report {
  names: BySide<string>;
  title: string;
  result: string;
  info: string[];
  tables: StatTable[];
  strokes: StrokeRow[] | null;
  comparison: SeasonComparison;
  /** e.g. "the 12 months up to Oct 21, 2026, practice matches excluded" */
  seasonDescription: string;
  notes: string;
  generatedOn: string;
}

/** Date, event, conditions, format, UTRs and how much was charted, one line each. */
export function matchInfo(match: Match, r: Replay, names: BySide<string>): string[] {
  const event = [match.eventName, EVENT_TYPE_LABELS[match.eventType], match.round].filter(Boolean).join(' · ');
  const utrs = [
    match.playerUtr !== undefined ? `${names.player} UTR ${match.playerUtr}` : '',
    match.opponentUtr !== undefined ? `${names.opponent} UTR ${match.opponentUtr}` : '',
    match.opponentHand ? `${names.opponent} is ${match.opponentHand}-handed` : '',
  ].filter(Boolean);
  let charted = `${r.points.length} points charted`;
  if (match.startingScore) {
    const start = replay({ ...match, points: [] }).final;
    const sets = setScoreLine(start, 'player');
    charted += ` (from ${[sets, `${start.games.player}-${start.games.opponent}`].filter(Boolean).join(' ')})`;
  }
  return [
    formatDate(match.date),
    event,
    `${SURFACE_LABELS[match.surface]} · ${match.indoor ? 'indoor' : 'outdoor'} · ${formatSummary(match.format)}`,
    utrs.join(' · '),
    charted,
  ].filter(Boolean);
}

export function buildReport(match: Match, allMatches: readonly Match[], names: BySide<string>, now = new Date()): Report {
  const r = replay(match);
  const stats = computeStats(r);
  const info = matchInfo(match, r, names);

  return {
    names,
    title: `${names.player} vs ${names.opponent}`,
    result: resultLine(match, r, names),
    info,
    tables: statTables(stats),
    strokes: strokeTable(stats),
    comparison: compareWithSeason(stats, seasonBaseline(allMatches, match)),
    seasonDescription: `${formatDate(monthsBefore(match.date, 12))} to ${formatDate(match.date)}, practice matches excluded`,
    notes: match.notes.trim(),
    generatedOn: formatDate(isoDay(now)),
  };
}

/** e.g. "Sam vs Lee Park 2026-10-21.pdf", safe for any file system. */
export function reportFileName(match: Match, names: BySide<string>, extension: string): string {
  const base = `${names.player} vs ${names.opponent} ${match.date}`.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${base}.${extension}`;
}
