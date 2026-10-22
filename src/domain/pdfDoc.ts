/**
 * The PDF report as a pdfmake document definition: plain data, so its content is unit-tested
 * without drawing a PDF. Uses the built-in Helvetica font (nothing to download), which covers
 * Western European characters only; anything else is replaced.
 */
import type { Report } from './report';
import { percentText } from './statRows';

/** Characters outside Helvetica's built-in (WinAnsi) set would print as garbage. */
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

export function pdfSafe(text: string): string {
  return text
    .replace(/[−‐‑]/g, '-')
    .replace(/[✓✔]/g, '')
    .replace(/./gu, (c) => {
      const code = c.codePointAt(0)!;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.includes(c) || c === '\n') return c;
      return '?';
    });
}

const COLORS = {
  ink: '#111111',
  muted: '#555555',
  line: '#d4d4d4',
  zebra: '#f5f5f4',
  player: '#1d4ed8',
  better: '#dcfce7',
  worse: '#fee2e2',
};

type Node = Record<string, unknown> | string;

const cell = (text: string, extra: Record<string, unknown> = {}): Node => ({ text: pdfSafe(text), ...extra });

const tableLayout = {
  hLineWidth: (i: number, node: { table: { headerRows: number; body: unknown[] } }) =>
    i === 0 || i === node.table.headerRows || i === node.table.body.length ? 1 : 0.5,
  vLineWidth: () => 0,
  hLineColor: () => COLORS.line,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

/** A heading and what follows it, kept together on one page (pdfmake moves it whole if needed). */
function section(...nodes: Node[]): Node {
  return { stack: nodes, unbreakable: true };
}

/** A shaded one-line box (pdfmake only shades table cells). */
function callout(text: string, fill: string): Node {
  return {
    table: { widths: ['*'], body: [[cell(text, { style: 'callout', fillColor: fill })]] },
    layout: 'noBorders',
    margin: [0, 2, 0, 6],
  };
}

function diffText(diff: number | null): string {
  if (diff === null) return '—';
  const rounded = Math.round(diff);
  return `${rounded > 0 ? '+' : ''}${rounded} pts`;
}

export function reportDocDefinition(report: Report): Record<string, unknown> {
  const { names } = report;
  const content: Node[] = [
    cell(report.title, { style: 'title' }),
    cell(report.result, { style: 'result' }),
    cell(report.info.join('\n'), { style: 'info' }),
    cell('Key stats', { style: 'h2' }),
  ];

  const statBody: Node[][] = [
    [cell(''), cell(names.player, { style: 'colHead', color: COLORS.player }), cell(names.opponent, { style: 'colHead' })],
  ];
  for (const table of report.tables) {
    statBody.push([cell(table.title, { style: 'section', colSpan: 3 }), '', '']);
    table.rows.forEach((row, i) => {
      const fill = i % 2 === 1 ? COLORS.zebra : undefined;
      statBody.push([
        cell(row.label, { fillColor: fill }),
        cell(row.text.player, { alignment: 'right', fillColor: fill }),
        cell(row.text.opponent, { alignment: 'right', fillColor: fill }),
      ]);
    });
  }
  content.push({ table: { headerRows: 1, widths: ['*', 120, 120], body: statBody }, layout: tableLayout });

  if (report.strokes) {
    const body: Node[][] = [
      [
        cell('Stroke', { style: 'colHead' }),
        cell(`${names.player} winners`, { style: 'colHead', color: COLORS.player, alignment: 'right' }),
        cell(`${names.player} UEs`, { style: 'colHead', color: COLORS.player, alignment: 'right' }),
        cell(`${names.opponent} winners`, { style: 'colHead', alignment: 'right' }),
        cell(`${names.opponent} UEs`, { style: 'colHead', alignment: 'right' }),
      ],
      ...report.strokes.map((s) => [
        cell(s.label),
        cell(String(s.winners.player), { alignment: 'right' }),
        cell(String(s.unforcedErrors.player), { alignment: 'right' }),
        cell(String(s.winners.opponent), { alignment: 'right' }),
        cell(String(s.unforcedErrors.opponent), { alignment: 'right' }),
      ]),
    ];
    content.push(
      section(cell('Winners and unforced errors by stroke', { style: 'h2' }), {
        table: { headerRows: 1, widths: ['*', 70, 70, 70, 70], body },
        layout: tableLayout,
      }),
    );
  }

  const seasonSection: Node[] = [cell(`This match vs ${names.player}'s season`, { style: 'h2' })];
  const { comparison } = report;
  if (comparison.tooFew) {
    seasonSection.push(
      cell(
        `The comparison appears once there are at least 3 other finished matches in ${report.seasonDescription}. ` +
          `So far there ${comparison.matches === 1 ? 'is 1' : `are ${comparison.matches}`}.`,
        { style: 'note' },
      ),
    );
  } else {
    seasonSection.push(cell(`Compared with ${comparison.matches} matches: ${report.seasonDescription}.`, { style: 'note' }));
    const better = comparison.rows.filter((r) => r.highlight === 'better').map((r) => r.label);
    const worse = comparison.rows.filter((r) => r.highlight === 'worse').map((r) => r.label);
    if (better.length) seasonSection.push(callout(`Better than usual: ${better.join('; ')}.`, COLORS.better));
    if (worse.length) seasonSection.push(callout(`Worse than usual: ${worse.join('; ')}.`, COLORS.worse));
    const body: Node[][] = [
      [
        cell(''),
        cell('This match', { style: 'colHead', alignment: 'right' }),
        cell('Season', { style: 'colHead', alignment: 'right' }),
        cell('Difference', { style: 'colHead', alignment: 'right' }),
      ],
      ...comparison.rows.map((r) => {
        const fill = r.highlight === 'better' ? COLORS.better : r.highlight === 'worse' ? COLORS.worse : undefined;
        const bold = r.highlight !== null;
        return [
          cell(r.label, { fillColor: fill, bold }),
          cell(percentText(r.match), { alignment: 'right', fillColor: fill, bold }),
          cell(percentText(r.season), { alignment: 'right', fillColor: fill }),
          cell(diffText(r.diff), { alignment: 'right', fillColor: fill, bold }),
        ];
      }),
    ];
    seasonSection.push({ table: { headerRows: 1, widths: ['*', 80, 80, 80], body }, layout: tableLayout });
  }
  content.push(section(...seasonSection));

  if (report.notes) content.push(section(cell('Notes', { style: 'h2' }), cell(report.notes, { style: 'notes' })));

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 40, 40, 48],
    info: { title: pdfSafe(report.title), creator: 'Tennis Tracker' },
    defaultStyle: { font: 'Helvetica', fontSize: 11, color: COLORS.ink, lineHeight: 1.15 },
    styles: {
      title: { fontSize: 20, bold: true },
      result: { fontSize: 15, bold: true, margin: [0, 4, 0, 4] },
      info: { fontSize: 10, color: COLORS.muted, margin: [0, 0, 0, 6] },
      h2: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
      section: { bold: true, fontSize: 10, color: COLORS.muted, margin: [0, 4, 0, 0] },
      colHead: { bold: true, fontSize: 10 },
      note: { fontSize: 10, color: COLORS.muted, margin: [0, 0, 0, 6] },
      callout: { fontSize: 11, bold: true, margin: [6, 4, 6, 4] },
      notes: { fontSize: 11 },
    },
    content,
    footer: (page: number, pages: number) => ({
      text: pdfSafe(`Tennis Tracker · generated ${report.generatedOn} · page ${page} of ${pages}`),
      alignment: 'center',
      fontSize: 8,
      color: COLORS.muted,
      margin: [0, 16, 0, 0],
    }),
  };
}
