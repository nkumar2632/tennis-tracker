/**
 * Builds the PDF and Excel files. The libraries are loaded on first use (they are large), and are
 * cached by the service worker like the rest of the app, so this works offline.
 */
import { pointsSheet, statsSheet, type XCell, type XSheet } from '../domain/excel';
import { reportDocDefinition } from '../domain/pdfDoc';
import { reportFileName, type Report } from '../domain/report';
import type { Replay } from '../domain/replay';
import type { BySide, Match } from '../domain/types';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function makePdfFile(report: Report, match: Match, names: BySide<string>): Promise<File> {
  const [{ default: pdfMake }, { default: helvetica }] = await Promise.all([
    import('pdfmake'),
    import('pdfmake/build/standard-fonts/Helvetica.js'),
  ]);
  pdfMake.addFontContainer(helvetica);
  const blob = await pdfMake.createPdf(reportDocDefinition(report)).getBlob();
  return new File([blob], reportFileName(match, names, 'pdf'), { type: 'application/pdf' });
}

function toCell(c: XCell) {
  if (c === null || typeof c !== 'object') return c;
  return { value: c.value, fontWeight: c.bold ? ('bold' as const) : undefined };
}

export async function makeExcelFile(report: Report, r: Replay, match: Match, names: BySide<string>): Promise<File> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sheets: XSheet[] = [pointsSheet(r, names), statsSheet(report, r)];
  const blob = await writeXlsxFile(
    sheets.map((s) => ({
      sheet: s.name,
      data: s.rows.map((row) => row.map(toCell)),
      columns: s.widths.map((width) => ({ width })),
      stickyRowsCount: s.name === 'Points' ? 1 : 0,
    })),
  ).toBlob();
  return new File([blob], reportFileName(match, names, 'xlsx'), { type: XLSX_TYPE });
}
