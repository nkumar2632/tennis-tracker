import pdfmake from 'pdfmake';
import { describe, expect, it } from 'vitest';
import { pointsSheet, statsSheet } from './excel';
import { FORMAT_PRESETS } from './format';
import { endMatchEarly } from './log';
import { pdfSafe, reportDocDefinition } from './pdfDoc';
import { buildReport, formatDate, reportFileName } from './report';
import { replay } from './replay';
import { compareWithSeason, monthsBefore, seasonBaseline } from './season';
import { statTables, statText, strokeTable } from './statRows';
import { computeStats } from './stats';
import { HAND_CHARTED, newMatch, play } from './test-helpers';
import type { Match } from './types';

const names = { player: 'Sam', opponent: 'Lee' };
const fixture = play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), HAND_CHARTED);
const fixtureStats = computeStats(replay(fixture));

function finished(script: string, id: string, extra: Partial<Match> = {}): Match {
  const m = { ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), script), id, ...extra };
  return endMatchEarly(m, { kind: 'stopped' }, 0);
}

describe('stat rows', () => {
  const row = (label: string) => statTables(fixtureStats).flatMap((t) => t.rows).find((r) => r.label === label)!;

  it('formats every stat the same way everywhere', () => {
    expect(row('1st serve in').text).toEqual({ player: '71% (10/14)', opponent: '79% (11/14)' });
    expect(row('Unreturned serves').text).toEqual({ player: '1', opponent: '1' });
    expect(row('Winners minus unforced errors').text).toEqual({ player: '+1', opponent: '0' });
    expect(row('Break points saved').text).toEqual({ player: '67% (2/3)', opponent: '67% (2/3)' });
    expect(statText({ num: 0, den: 0 })).toBe('—');
  });

  it('lists the sections in order', () => {
    expect(statTables(fixtureStats).map((t) => t.title)).toEqual(['Serve', 'Return', 'Rally', 'Key moments']);
  });

  it('breaks down winners and unforced errors by stroke, leaving out unused strokes', () => {
    expect(strokeTable(fixtureStats)!.map((s) => [s.label, s.winners, s.unforcedErrors])).toEqual([
      ['Forehand', { player: 2, opponent: 1 }, { player: 1, opponent: 1 }],
      ['Backhand', { player: 1, opponent: 0 }, { player: 1, opponent: 2 }],
      ['Volley', { player: 0, opponent: 1 }, { player: 0, opponent: 0 }],
      ['Return', { player: 0, opponent: 1 }, { player: 1, opponent: 0 }],
    ]);
    expect(strokeTable(computeStats(replay(play(newMatch(), 'gp'))))).toBeNull();
  });
});

describe('season baseline', () => {
  it('counts back whole months, clamping to month ends', () => {
    expect(monthsBefore('2026-10-21', 12)).toBe('2025-10-21');
    expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28');
    expect(monthsBefore('2024-03-30', 1)).toBe('2024-02-29');
    expect(monthsBefore('2026-01-15', 2)).toBe('2025-11-15');
  });

  it("uses the same player's other finished, charted, non-practice matches from the 12 months up to the match", () => {
    const current = { ...finished('gp', 'current'), date: '2026-10-01' };
    const all: Match[] = [
      current,
      { ...finished('gp', 'in-window'), date: '2026-06-01' },
      { ...finished('gp', 'same-day'), date: '2026-10-01' },
      { ...finished('gp', 'too-old'), date: '2025-10-01' },
      { ...finished('gp', 'later'), date: '2026-10-02' },
      { ...finished('gp', 'practice'), date: '2026-06-01', eventType: 'practice' },
      { ...play(newMatch(), 'gp'), id: 'in-progress', date: '2026-06-01' },
      { ...finished('', 'empty'), date: '2026-06-01' },
      { ...finished('gp', 'retired'), date: '2026-06-01', status: 'retired', retiredSide: 'opponent' },
      { ...finished('gp', 'other-player'), date: '2026-06-01', playerId: 'p2' },
    ];
    expect(seasonBaseline(all, current).map((m) => m.id).sort()).toEqual(['in-window', 'retired', 'same-day']);
    expect(seasonBaseline(all, current, { includePractice: true }).map((m) => m.id)).toContain('practice');
  });
});

describe('comparison with the season', () => {
  // Season: in his service game every point is played on the 2nd serve; 8 points, won at deuce.
  const season = ['s1', 's2', 's3'].map((id) => finished('2p 2p 2p 2o 2o 2o 2p 2p go', id));

  it('needs at least 3 other matches', () => {
    const c = compareWithSeason(computeStats(replay(finished('gp', 'x'))), season.slice(0, 2));
    expect(c).toEqual({ matches: 2, tooFew: true, rows: [] });
  });

  it('compares rates and highlights the biggest differences that have enough data', () => {
    // This match: every first serve in.
    const c = compareWithSeason(computeStats(replay(finished('p p p o o o p p go', 'x'))), season);
    const byId = Object.fromEntries(c.rows.map((r) => [r.id, r]));
    expect(byId.firstServeIn).toMatchObject({ match: { num: 8, den: 8 }, season: { num: 0, den: 24 }, diff: 100, better: true, highlight: 'better' });
    expect(byId.firstServeWon!.diff).toBeNull(); // no first serves in the season
    expect(byId.hold!.diff).toBeNull(); // 1 service game is too few
    expect(byId.winners).toMatchObject({ diff: 0, better: null, highlight: null });
    expect(c.rows.filter((r) => r.highlight)).toHaveLength(1);
  });

  it('treats more double faults as worse', () => {
    const c = compareWithSeason(computeStats(replay(finished('D p D p D p p p go', 'x'))), season);
    const df = c.rows.find((r) => r.id === 'doubleFaults')!;
    expect(df).toMatchObject({ match: { num: 3, den: 8 }, better: false, highlight: 'worse' });
    expect(c.rows.find((r) => r.id === 'firstServeIn')!.highlight).toBe('better');
  });
});

describe('report', () => {
  const report = buildReport({ ...fixture, notes: 'Windy. Serve broke down late.' }, [], names, new Date(2026, 9, 22));

  it('describes the match', () => {
    expect(report.title).toBe('Sam vs Lee');
    expect(report.result).toBe('In progress · 2-2');
    expect(report.info).toEqual([
      'Oct 1, 2026',
      'Test Open · USTA',
      'Hard · outdoor · Best of 3 sets · 7-pt tiebreak at 6-6',
      '28 points charted',
    ]);
    expect(report.seasonDescription).toBe('Oct 1, 2025 to Oct 1, 2026, practice matches excluded');
    expect(report.generatedOn).toBe('Oct 22, 2026');
    expect(report.comparison.tooFew).toBe(true);
    expect(report.strokes).not.toBeNull();
  });

  it('mentions UTRs, handedness and a late start when known', () => {
    const late = newMatch(FORMAT_PRESETS.bestOf3, {
      opponentName: 'Lee',
      playerUtr: 7.1,
      opponentUtr: 7.4,
      opponentHand: 'left',
      startingScore: { completedSets: [{ games: { player: 6, opponent: 4 } }], games: { player: 2, opponent: 1 } },
    });
    const info = buildReport(play(late, 'gp'), [], names).info;
    expect(info).toContain('Sam UTR 7.1 · Lee UTR 7.4 · Lee is left-handed');
    expect(info).toContain('4 points charted (from 6-4 2-1)');
  });

  it('names files safely', () => {
    expect(reportFileName(fixture, names, 'pdf')).toBe('Sam vs Lee 2026-10-01.pdf');
    expect(reportFileName(fixture, { player: 'Sam', opponent: 'A/B: "C"' }, 'xlsx')).toBe('Sam vs A-B- -C- 2026-10-01.xlsx');
    expect(formatDate('2026-01-05')).toBe('Jan 5, 2026');
  });
});

describe('PDF', () => {
  const report = buildReport({ ...fixture, notes: 'Windy.' }, [], names, new Date(2026, 9, 22));
  const doc = reportDocDefinition(report);
  const text = JSON.stringify(doc.content);

  it('lays out the title, every stat, strokes, the season note and notes', () => {
    expect(text).toContain('Sam vs Lee');
    expect(text).toContain('In progress · 2-2');
    expect(text).toContain('71% (10/14)');
    expect(text).toContain('Winners and unforced errors by stroke');
    expect(text).toContain('at least 3 other finished matches');
    expect(text).toContain('Windy.');
    const statTable = (doc.content as { table?: { body: unknown[] } }[]).find((n) => n.table)!;
    expect(statTable.table!.body).toHaveLength(1 + 4 + 8 + 4 + 5 + 6); // header + section rows + stat rows
    expect(doc).toMatchObject({ pageSize: 'LETTER', defaultStyle: { font: 'Helvetica' } });
  });

  it('calls out the biggest differences when there is a season to compare with', () => {
    const season = ['a', 'b', 'c'].map((id) => finished('2p 2p 2p 2o 2o 2o 2p 2p go', id, { date: '2026-09-01' }));
    const current = { ...finished('p p p o o o p p go', 'now'), date: '2026-10-01' };
    const withSeason = JSON.stringify(reportDocDefinition(buildReport(current, [current, ...season], names)).content);
    expect(withSeason).toContain('Compared with 3 matches');
    expect(withSeason).toContain('Better than usual: 1st serve in.');
    expect(withSeason).toContain('+100 pts');
  });

  it('replaces characters the built-in font cannot print', () => {
    expect(pdfSafe('Müller − ✓ 李 – “ok”')).toBe('Müller -  ? – “ok”');
  });

  it('renders to a real PDF with pdfmake', async () => {
    pdfmake.addFonts({
      Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
    });
    const buffer: Buffer = await pdfmake.createPdf(doc).getBuffer();
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(3000);
  });
});

describe('Excel', () => {
  const r = replay(fixture);

  it('has one row per point with plain-language columns', () => {
    const sheet = pointsSheet(r, names);
    expect(sheet.rows).toHaveLength(1 + 28);
    expect(sheet.rows[0]).toHaveLength(14);
    expect(sheet.rows[1]).toEqual([1, 1, 1, 'Sam', '1st', '0-0', 'ace', 'Sam', null, 'Sam', '0-0', '15-0', null, null]);
    expect(sheet.rows[8]).toEqual([8, 1, 1, 'Sam', '1st', 'AD-40', 'unreturned serve', 'Sam', null, 'Sam', '1-0', null, null, 'Yes']);
    expect(sheet.rows[13]).toEqual([13, 1, 2, 'Lee', '2nd', '15-40', 'winner', 'Lee', 'volley', 'Lee', '1-0', '40-30', 'Yes', 'Yes']); // Sam first
  });

  it('has the stats for the match and each set side by side', () => {
    const sheet = statsSheet(buildReport(fixture, [], names), r);
    expect(sheet.rows[0]).toEqual([{ value: 'Sam vs Lee', bold: true }]);
    const firstServe = sheet.rows.find((row) => row[0] === '1st serve in');
    expect(firstServe).toEqual(['1st serve in', '71% (10/14)', '79% (11/14)', '71% (10/14)', '79% (11/14)']);
    expect(sheet.rows.some((row) => row[0] === 'Forehand')).toBe(true);
  });
});
