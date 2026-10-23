import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS } from './format';
import { endMatchEarly } from './log';
import {
  TRENDS,
  defaultFilter,
  filterMatches,
  headToHead,
  playerUtrFor,
  trendAverage,
  trendSeries,
  utrBand,
  winLoss,
  winPct,
  withDates,
  type SeasonFilter,
} from './seasonView';
import { newMatch, play } from './test-helpers';
import type { Match } from './types';

let n = 0;
/** A finished match: `won` decides who takes the 8-game pro set. */
function m(extra: Partial<Match> & { won?: boolean; script?: string } = {}): Match {
  const { won = true, script, ...rest } = extra;
  const base = newMatch(FORMAT_PRESETS.proSet8, { opponentName: 'Lee' });
  return { ...play({ ...base, ...rest }, script ?? (won ? 'gp*8' : 'go*8')), id: rest.id ?? `m${++n}` };
}

describe('UTR bands', () => {
  it('compares the opponent with his rating at the time', () => {
    const all = [m({ playerUtr: 7, opponentUtr: 6.4 }), m({ playerUtr: 7, opponentUtr: 7.5 }), m({ playerUtr: 7, opponentUtr: 7.6 })];
    expect(all.map((x) => utrBand(x, all))).toEqual(['lower', 'even', 'higher']);
  });

  it('treats exactly 0.5 apart as even despite floating-point noise', () => {
    const all = [m({ playerUtr: 7.1, opponentUtr: 7.6 }), m({ playerUtr: 7.1, opponentUtr: 6.6 })];
    expect(all.map((x) => utrBand(x, all))).toEqual(['even', 'even']);
  });

  it("falls back to his UTR from the nearest-dated match (earlier on a tie)", () => {
    const blank = m({ date: '2026-06-15', opponentUtr: 8 });
    const all = [
      blank,
      m({ date: '2026-06-01', playerUtr: 7.0 }),
      m({ date: '2026-06-29', playerUtr: 7.6 }),
      m({ date: '2025-01-01', playerUtr: 5.0 }),
    ];
    expect(playerUtrFor(blank, all)).toBe(7.0); // 14 days either side: the earlier one
    expect(utrBand(blank, all)).toBe('higher');
    expect(playerUtrFor(m({ date: '2026-06-20' }), all)).toBe(7.6);
  });

  it('is unknown without the opponent UTR, or with no UTR of his anywhere', () => {
    const noOpp = m({ playerUtr: 7 });
    const noMine = m({ opponentUtr: 7 });
    expect(utrBand(noOpp, [noOpp])).toBe('unknown');
    expect(utrBand(noMine, [noMine])).toBe('unknown');
  });
});

describe('filters', () => {
  const all = [
    m({ id: 'usta-hard', date: '2026-09-01', eventType: 'usta', surface: 'hard', playerUtr: 7, opponentUtr: 8 }),
    m({ id: 'hs-clay', date: '2026-05-01', eventType: 'hs_dual', surface: 'clay' }),
    m({ id: 'practice', date: '2026-09-10', eventType: 'practice' }),
    m({ id: 'old', date: '2025-09-01', eventType: 'utr' }),
  ];
  const ids = (f: Partial<SeasonFilter>) => filterMatches(all, { ...defaultFilter('2026-10-23'), ...f }).map((x) => x.id);

  it('defaults to the last 12 months without practice', () => {
    expect(defaultFilter('2026-10-23')).toEqual({
      dates: 'last12',
      from: '2025-10-23',
      to: '2026-10-23',
      events: 'competitive',
      surface: 'all',
      band: 'all',
    });
    expect(ids({})).toEqual(['usta-hard', 'hs-clay']);
  });

  it('turns date presets into inclusive ranges', () => {
    const f = defaultFilter('2026-10-23');
    const range = (g: SeasonFilter) => [g.dates, g.from, g.to];
    expect(range(withDates(f, 'last6', '2026-10-23'))).toEqual(['last6', '2026-04-23', '2026-10-23']);
    expect(range(withDates(f, 'last3', '2026-05-31'))).toEqual(['last3', '2026-02-28', '2026-05-31']);
    expect(range(withDates(f, 'thisYear', '2026-10-23'))).toEqual(['thisYear', '2026-01-01', '2026-10-23']);
    expect(range(withDates(f, 'all', '2026-10-23'))).toEqual(['all', '', '']);
    // Choosing dates starts from what was showing, or the last 12 months after "All dates".
    expect(range(withDates(withDates(f, 'last3', '2026-10-23'), 'custom', '2026-10-23'))).toEqual(['custom', '2026-07-23', '2026-10-23']);
    expect(range(withDates(withDates(f, 'all', '2026-10-23'), 'custom', '2026-10-23'))).toEqual(['custom', '2025-10-23', '2026-10-23']);
  });

  it('filters by dates, event type, surface and UTR band', () => {
    expect(ids({ from: '', to: '' })).toEqual(['usta-hard', 'hs-clay', 'old']);
    expect(ids({ events: 'all' })).toEqual(['usta-hard', 'hs-clay', 'practice']);
    expect(ids({ events: 'practice' })).toEqual(['practice']);
    expect(ids({ events: 'hs_dual' })).toEqual(['hs-clay']);
    expect(ids({ surface: 'clay' })).toEqual(['hs-clay']);
    expect(ids({ band: 'higher' })).toEqual(['usta-hard']);
    expect(ids({ band: 'unknown' })).toEqual(['hs-clay']);
    expect(ids({ from: '2026-08-01', to: '2026-09-05' })).toEqual(['usta-hard']);
  });
});

describe('record', () => {
  it('counts wins on court and retirements; lists stopped and unfinished matches separately', () => {
    const retired = endMatchEarly(m({ script: 'gp' }), { kind: 'retired', retiredSide: 'opponent' });
    const stopped = endMatchEarly(m({ script: 'gp' }), { kind: 'stopped' });
    const live = m({ script: 'gp' });
    const r = winLoss([m(), m(), m({ won: false }), retired, stopped, live]);
    expect(r).toEqual({ wins: 3, losses: 1, notCounted: 2 });
    expect(winPct(r)).toBe(75);
    expect(winPct({ wins: 0, losses: 0, notCounted: 3 })).toBeNull();
  });
});

describe('trends', () => {
  const firstServe = TRENDS.find((t) => t.id === 'firstServeIn')!;
  const dfs = TRENDS.find((t) => t.id === 'doubleFaults')!;

  it('gives one value per finished match, oldest first', () => {
    const late = m({ date: '2026-09-01', script: 'D D D D gp*8' }); // 4 DFs lose game 1, then wins 8-1
    const early = m({ date: '2026-08-01' });
    const live = m({ date: '2026-08-15', script: 'gp' });
    const series = trendSeries([late, live, early], firstServe);
    expect(series.map((p) => p.matchId)).toEqual([early.id, late.id]);
    expect(series[0]).toMatchObject({ value: 100, detail: '16/16', opponent: 'Lee' });
    expect(trendSeries([late, early], dfs).map((p) => p.value)).toEqual([0, 4]);
  });

  it('averages like the season report: percentages pooled over points, counts per match', () => {
    const a = m({ date: '2026-08-01', script: 'D D D D gp*8' }); // 4 DFs; 1st serve in 16/20
    const b = m({ date: '2026-09-01' }); // 0 DFs; 1st serve in 16/16
    const live = m({ date: '2026-09-15', script: 'D D' });
    expect(trendAverage([a, b, live], dfs)).toBe(2);
    expect(trendAverage([a, b, live], firstServe)).toBeCloseTo((32 / 36) * 100);
    expect(trendAverage([live], firstServe)).toBeNull();
  });

  it('skips a match with nothing to measure', () => {
    // Stopped after one game on the opponent's serve: he never served, so no 1st serve %, but DFs is 0.
    const neverServed = endMatchEarly(m({ firstServer: 'opponent', script: 'go' }), { kind: 'stopped' });
    expect(trendSeries([neverServed], firstServe)).toEqual([]);
    expect(trendSeries([neverServed], dfs).map((p) => p.value)).toEqual([0]);
    const noPoints = endMatchEarly(m({ script: '' }), { kind: 'stopped' });
    expect(trendSeries([noPoints], firstServe)).toEqual([]);
  });

  it('covers the six stats in the spec', () => {
    expect(TRENDS.map((t) => t.label)).toEqual([
      '1st serve in',
      'Points won on 2nd serve',
      'Double faults',
      'Unforced errors',
      'Winners minus unforced errors',
      'Won on pressure points',
    ]);
  });
});

describe('head-to-head', () => {
  it('lists repeat opponents only, with the record, newest match first', () => {
    const all = [
      m({ opponentName: 'Lee Park', date: '2026-03-01' }),
      m({ opponentName: 'lee park', date: '2026-09-01', won: false }),
      m({ opponentName: 'Lee  Park', date: '2026-06-01' }),
      m({ opponentName: 'Ana Ruiz', date: '2026-07-01' }),
      m({ opponentName: 'Ana Ruiz', date: '2026-08-01' }),
      m({ opponentName: 'Once Only', date: '2026-10-01' }),
    ];
    const h2h = headToHead(all);
    expect(h2h.map((h) => [h.name, h.record.wins, h.record.losses, h.matches.length])).toEqual([
      ['lee park', 2, 1, 3],
      ['Ana Ruiz', 2, 0, 2],
    ]);
    expect(h2h[0]!.matches.map((x) => x.date)).toEqual(['2026-09-01', '2026-06-01', '2026-03-01']);
  });
});
