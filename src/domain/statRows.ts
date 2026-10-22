/**
 * The stats shown for a match, in display order, with their wording. One definition shared by the
 * stats screen, the PDF report and the Excel export, so they always agree.
 */
import { STROKE_LABELS } from './labels';
import { pct, type MatchStats, type Ratio, type SideStats } from './stats';
import type { BySide, Stroke } from './types';
import { SIDES, STROKES } from './types';

export interface StatDef {
  id: string;
  label: string;
  get: (s: SideStats) => Ratio | number;
  /** Show a + sign on positive numbers (e.g. winners minus unforced errors). */
  signed?: boolean;
}

export interface StatSection {
  title: string;
  rows: StatDef[];
}

export const STAT_SECTIONS: StatSection[] = [
  {
    title: 'Serve',
    rows: [
      { id: 'firstServeIn', label: '1st serve in', get: (s) => s.serve.firstServeIn },
      { id: 'firstServeWon', label: 'Points won on 1st serve', get: (s) => s.serve.firstServePointsWon },
      { id: 'secondServeWon', label: 'Points won on 2nd serve', get: (s) => s.serve.secondServePointsWon },
      { id: 'aces', label: 'Aces', get: (s) => s.serve.aces },
      { id: 'unreturned', label: 'Unreturned serves', get: (s) => s.serve.unreturnedServes },
      { id: 'doubleFaults', label: 'Double faults', get: (s) => s.serve.doubleFaults },
      { id: 'doubleFaultsPressure', label: 'Double faults on pressure points', get: (s) => s.serve.doubleFaultsOnPressure },
      { id: 'hold', label: 'Service games held', get: (s) => s.serve.serviceGamesHeld },
    ],
  },
  {
    title: 'Return',
    rows: [
      { id: 'returnInPlay', label: 'Returns in play', get: (s) => s.return.returnInPlay },
      { id: 'returnVsFirst', label: 'Points won vs 1st serve', get: (s) => s.return.pointsWonVsFirstServe },
      { id: 'returnVsSecond', label: 'Points won vs 2nd serve', get: (s) => s.return.pointsWonVsSecondServe },
      { id: 'break', label: 'Return games won (breaks)', get: (s) => s.return.returnGamesWon },
    ],
  },
  {
    title: 'Rally',
    rows: [
      { id: 'pointsWon', label: 'Total points won', get: (s) => s.pointsWon },
      { id: 'winners', label: 'Winners', get: (s) => s.rally.winners },
      { id: 'unforcedErrors', label: 'Unforced errors', get: (s) => s.rally.unforcedErrors },
      { id: 'forcedErrors', label: 'Forced errors', get: (s) => s.rally.forcedErrors },
      { id: 'winnersMinusUe', label: 'Winners minus unforced errors', get: (s) => s.rally.winnersMinusUnforcedErrors, signed: true },
    ],
  },
  {
    title: 'Key moments',
    rows: [
      { id: 'bpSaved', label: 'Break points saved', get: (s) => s.breakPoints.saved },
      { id: 'bpConverted', label: 'Break points converted', get: (s) => s.breakPoints.converted },
      { id: 'pressureWon', label: 'Won on pressure points', get: (s) => s.pressure.pressurePointsWon },
      { id: 'otherWon', label: 'Won on all other points', get: (s) => s.pressure.otherPointsWon },
      { id: 'consolidation', label: 'Held right after breaking', get: (s) => s.response.consolidation },
      { id: 'breakBack', label: 'Broke back right after being broken', get: (s) => s.response.breakBack },
    ],
  },
];

export const NO_DATA = '—';

export function isRatio(v: Ratio | number): v is Ratio {
  return typeof v === 'object';
}

/** "63%" or "—" when there was nothing to measure. */
export function percentText(r: Ratio): string {
  const p = pct(r);
  return p === null ? NO_DATA : `${Math.round(p)}%`;
}

/** "63% (24/38)", "12", "+3", or "—". */
export function statText(v: Ratio | number, signed = false): string {
  if (isRatio(v)) return v.den === 0 ? NO_DATA : `${percentText(v)} (${v.num}/${v.den})`;
  return signed && v > 0 ? `+${v}` : String(v);
}

export interface StatRow {
  id: string;
  label: string;
  values: BySide<Ratio | number>;
  text: BySide<string>;
}

export interface StatTable {
  title: string;
  rows: StatRow[];
}

export function statTables(stats: MatchStats): StatTable[] {
  return STAT_SECTIONS.map((section) => ({
    title: section.title,
    rows: section.rows.map((def) => {
      const values = { player: def.get(stats.player), opponent: def.get(stats.opponent) };
      return {
        id: def.id,
        label: def.label,
        values,
        text: { player: statText(values.player, def.signed), opponent: statText(values.opponent, def.signed) },
      };
    }),
  }));
}

export interface StrokeRow {
  stroke: Stroke;
  label: string;
  winners: BySide<number>;
  unforcedErrors: BySide<number>;
}

/** Winners and unforced errors by stroke; only strokes that occur at all; null when there's nothing to show. */
export function strokeTable(stats: MatchStats): StrokeRow[] | null {
  if (!stats.strokesRecorded) return null;
  const rows = STROKES.map((stroke) => {
    const winners = { player: stats.player.strokes.winners[stroke], opponent: stats.opponent.strokes.winners[stroke] };
    const unforcedErrors = {
      player: stats.player.strokes.unforcedErrors[stroke],
      opponent: stats.opponent.strokes.unforcedErrors[stroke],
    };
    const label = STROKE_LABELS[stroke][0]!.toUpperCase() + STROKE_LABELS[stroke].slice(1);
    return { stroke, label, winners, unforcedErrors };
  });
  const used = rows.filter((r) => SIDES.some((s) => r.winners[s] + r.unforcedErrors[s] > 0));
  // Strokes tagged only on forced errors don't appear in this table.
  return used.length > 0 ? used : null;
}
