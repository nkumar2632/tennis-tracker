/** The Excel export as plain rows: a point-by-point sheet and a stats sheet (match and each set). */
import { ENDING_LABELS, STROKE_LABELS, gameNumberInSet, scoreLine } from './labels';
import type { Replay } from './replay';
import type { Report } from './report';
import { pointScoreLabel } from './scoring';
import { statTables, strokeTable } from './statRows';
import { chartedSetNumbers, computeStats } from './stats';
import type { BySide } from './types';

export type XCell = string | number | null | { value: string | number; bold?: boolean };

export interface XSheet {
  name: string;
  rows: XCell[][];
  /** Column widths in characters. */
  widths: number[];
}

const bold = (value: string | number): XCell => ({ value, bold: true });

export function pointsSheet(r: Replay, names: BySide<string>): XSheet {
  const header = [
    '#',
    'Set',
    'Game',
    'Server',
    'Serve',
    'Score before (server first)',
    'How it ended',
    'Ended by',
    'Stroke',
    'Point won by',
    `Games after (${names.player} first)`,
    `Points after (${names.player} first)`,
    'Break point',
    'Pressure point',
  ].map(bold);
  const rows: XCell[][] = r.points.map((rp) => {
    const game = r.games[rp.gameNumber - 1]!;
    const gameLabel = game.kind === 'match_tiebreak' ? 'Match tiebreak' : game.kind === 'tiebreak' ? 'Tiebreak' : gameNumberInSet(game, r);
    return [
      rp.index + 1,
      rp.setNumber,
      gameLabel,
      names[rp.server],
      rp.point.serve === 1 ? '1st' : '2nd',
      pointScoreLabel(rp.before, rp.server),
      ENDING_LABELS[rp.point.ending],
      names[rp.endedBy],
      rp.point.stroke ? STROKE_LABELS[rp.point.stroke] : null,
      names[rp.winner],
      scoreLine(rp.after, 'player'),
      // Blank once the game (or the match tiebreak, already in the games column) is over.
      rp.endsGame || rp.after.tiebreak?.kind === 'match' ? null : pointScoreLabel(rp.after, 'player'),
      rp.isBreakPoint ? 'Yes' : null,
      rp.isPressure ? 'Yes' : null,
    ];
  });
  return { name: 'Points', rows: [header, ...rows], widths: [5, 5, 14, 14, 6, 12, 16, 14, 10, 14, 16, 12, 8, 9] };
}

export function statsSheet(report: Report, r: Replay): XSheet {
  const { names } = report;
  const scopes = [
    { label: 'Match', stats: computeStats(r) },
    ...chartedSetNumbers(r).map((n) => ({ label: `Set ${n}`, stats: computeStats(r, { setNumber: n }) })),
  ];
  const tablesByScope = scopes.map((s) => statTables(s.stats));
  const rows: XCell[][] = [
    [bold(report.title)],
    [report.result],
    ...report.info.map((line) => [line]),
    [],
    [bold('Stat'), ...scopes.flatMap((s) => [bold(`${names.player} (${s.label})`), bold(`${names.opponent} (${s.label})`)])],
  ];
  tablesByScope[0]!.forEach((table, t) => {
    rows.push([bold(table.title)]);
    table.rows.forEach((row, i) => {
      rows.push([row.label, ...tablesByScope.flatMap((tables) => [tables[t]!.rows[i]!.text.player, tables[t]!.rows[i]!.text.opponent])]);
    });
  });
  const strokes = strokeTable(scopes[0]!.stats);
  if (strokes) {
    rows.push([], [bold('Strokes (match)'), bold(`${names.player} winners`), bold(`${names.player} UEs`), bold(`${names.opponent} winners`), bold(`${names.opponent} UEs`)]);
    for (const s of strokes) rows.push([s.label, s.winners.player, s.unforcedErrors.player, s.winners.opponent, s.unforcedErrors.opponent]);
  }
  if (report.notes) rows.push([], [bold('Notes')], [report.notes]);
  return { name: 'Stats', rows, widths: [34, ...scopes.flatMap(() => [16, 16])] };
}
