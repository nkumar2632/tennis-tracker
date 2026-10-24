// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_PRESETS } from '../../domain/format';
import { endMatchEarly } from '../../domain/log';
import type { MatchSetup } from '../../domain/match';
import { newMatch, play } from '../../domain/test-helpers';
import type { Match } from '../../domain/types';
import { renderAt, resetData, seed, spacedTaps } from '../test-utils';
import { forgetSeasonFilter } from './Season';

/** A finished 8-game pro set, won or lost 8-0, starting with `dfs` double faults (he serves first). */
function m(id: string, setup: Partial<MatchSetup>, won: boolean, dfs = 0): Match {
  const base = newMatch(FORMAT_PRESETS.proSet8, { opponentName: 'Lee', ...setup });
  // Four double faults lose the first game on their own.
  const script = `${'D '.repeat(dfs)}${won ? 'gp*8' : `go*${dfs === 4 ? 7 : 8}`}`;
  return { ...play(base, script), id };
}

const MATCHES = [
  m('lee-1', { date: '2026-03-01', playerUtr: 7, opponentUtr: 7.8 }, true),
  m('lee-2', { date: '2026-09-01', opponentUtr: 7.9 }, false, 4), // His UTR from the nearest-dated match (practice): 7.2.
  m('ana', { date: '2026-06-01', opponentName: 'Ana', eventType: 'hs_dual', surface: 'clay' }, true, 2),
  m('max', { date: '2026-07-01', opponentName: 'Max', playerUtr: 7.2, opponentUtr: 6 }, true),
  m('practice', { date: '2026-08-01', opponentName: 'Lee', eventType: 'practice', playerUtr: 7.2, opponentUtr: 7.1 }, false),
  m('old', { date: '2024-05-01', opponentName: 'Old', playerUtr: 6, opponentUtr: 6.1 }, false),
  {
    ...endMatchEarly(play(newMatch(FORMAT_PRESETS.proSet8, { opponentName: 'Ana', date: '2026-10-01' }), 'gp'), { kind: 'stopped' }),
    id: 'ana-stopped',
  },
];

const row = (label: string) => screen.getByRole('rowheader', { name: new RegExp(`^${label}`) }).closest('tr')!;
const matchRows = () => within(screen.getByRole('list')).getAllByRole('listitem');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 12));
  forgetSeasonFilter();
  await resetData();
  spacedTaps();
  await seed(...MATCHES);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function open(path: string) {
  const view = renderAt(path);
  await screen.findByRole('navigation', { name: 'Season' });
  return view;
}

describe('home', () => {
  it("links to the season with the last 12 months' record", async () => {
    renderAt('/');
    const link = await screen.findByRole('link', { name: /Season/ });
    expect(link.textContent).toContain('Last 12 months 3–1');
  });
});

describe('record tab', () => {
  it('shows the record for the last 12 months without practice, by UTR band, and every match', async () => {
    await open('/season');
    expect((await screen.findByRole('region', { name: 'Record' })).textContent).toBe(
      '3–1Won 3 of 4 (75%)1 more not in the record (stopped or not finished)',
    );
    expect(row('Lower-rated').textContent).toBe('Lower-ratedmore than 0.5 below Sam1–0');
    expect(row('Even').textContent).toBe('Evenwithin 0.50–0');
    expect(row('Higher-rated').textContent).toBe('Higher-ratedmore than 0.5 above Sam1–1');
    expect(row('Unknown UTR').textContent).toBe('Unknown UTRa UTR is missing1–0');
    expect(matchRows().map((li) => li.textContent)).toEqual([
      'vs AnaOct 1, 2026 · Test Open · USTAStopped at 1-0Opponent UTR not enteredAdd UTR',
      'Lvs LeeSep 1, 2026 · Test Open · USTALee won 8-0Opponent UTR 7.9 · Higher-rated',
      'Wvs MaxJul 1, 2026 · Test Open · USTASam won 8-0Opponent UTR 6 · Lower-rated',
      'Wvs AnaJun 1, 2026 · Test Open · HS dual matchSam won 8-0Opponent UTR not enteredAdd UTR',
      'Wvs LeeMar 1, 2026 · Test Open · USTASam won 8-0Opponent UTR 7.8 · Higher-rated',
    ]);
  });

  it('filters by event type, surface, UTR band and dates', async () => {
    await open('/season');
    const record = () => screen.getByRole('region', { name: 'Record' }).querySelector('.record-big')!.textContent;
    await screen.findByRole('region', { name: 'Record' });
    fireEvent.change(screen.getByLabelText('Events'), { target: { value: 'all' } });
    expect(record()).toBe('3–2');
    fireEvent.change(screen.getByLabelText('Events'), { target: { value: 'hs_dual' } });
    expect(record()).toBe('1–0');
    fireEvent.change(screen.getByLabelText('Events'), { target: { value: 'competitive' } });
    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'clay' } });
    expect(record()).toBe('1–0');
    fireEvent.change(screen.getByLabelText('Surface'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Opponent UTR'), { target: { value: 'higher' } });
    expect(record()).toBe('1–1');
    // The band table still shows every band, with the chosen one marked.
    expect(row('Higher-rated').className).toBe('on');
    expect(row('Lower-rated').textContent).toContain('1–0');
    fireEvent.change(screen.getByLabelText('Opponent UTR'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Dates'), { target: { value: 'all' } });
    expect(record()).toBe('3–2');
    fireEvent.change(screen.getByLabelText('Dates'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-01' } });
    expect(record()).toBe('2–0');
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(record()).toBe('3–1');
    expect(screen.queryByRole('button', { name: 'Reset filters' })).toBeNull();
  });

  it('opens match details to add a missing UTR', async () => {
    const view = await open('/season');
    fireEvent.click((await screen.findAllByRole('link', { name: 'Add UTR' }))[0]!);
    await screen.findByText("Opponent's UTR");
    expect(view.path()).toBe('/match/ana-stopped/edit');
  });
});

describe('trends tab', () => {
  it('charts each key stat per finished match, oldest first, and opens a tapped match', async () => {
    const view = await open('/season/trends');
    const charts = await screen.findAllByRole('figure');
    expect(charts.map((c) => c.querySelector('figcaption')!.textContent)).toEqual([
      '1st serve in',
      'Points won on 2nd serve',
      'Double faults · lower is better',
      'Unforced errors · lower is better',
      'Winners minus unforced errors',
      'Won on pressure points',
    ]);
    const dfs = charts[2]!;
    // Five finished matches (no practice; the stopped one counts as finished) and their average.
    expect(dfs.querySelector('.trend-summary')!.textContent).toBe(' Average 1.2 · 5 matches');
    expect(within(dfs).getByRole('img').getAttribute('aria-label')).toBe(
      'Double faults, oldest to newest: Mar 1, 2026 0, Jun 1, 2026 2, Jul 1, 2026 0, Sep 1, 2026 4, Oct 1, 2026 0',
    );
    // The latest match is picked until another is tapped.
    const pick = () => dfs.querySelector('.trend-pick')!.textContent!.replace(/\u00a0/g, ' ');
    expect(pick()).toBe('Oct 1, 2026 · vs Ana: 0 Open match ›');
    fireEvent.click(dfs.querySelectorAll('rect.hit')[3]!);
    expect(pick()).toBe('Sep 1, 2026 · vs Lee: 4 Open match ›');
    fireEvent.click(within(dfs).getByRole('link', { name: /^Open/ }));
    await screen.findByRole('navigation', { name: 'Match' });
    expect(view.path()).toBe('/match/lee-2');
  });

  it('keeps the filters when switching tabs', async () => {
    await open('/season');
    fireEvent.change(await screen.findByLabelText('Surface'), { target: { value: 'clay' } });
    fireEvent.click(screen.getByRole('link', { name: 'Trends' }));
    await screen.findAllByRole('figure');
    expect((screen.getByLabelText('Surface') as HTMLSelectElement).value).toBe('clay');
    expect(screen.getAllByText(/1 match$/)).toHaveLength(6);
  });
});

describe('head-to-head tab', () => {
  it('lists opponents he played more than once, with the record and each match', async () => {
    await open('/season/h2h');
    const lee = await screen.findByRole('region', { name: 'vs Lee' });
    expect(lee.querySelector('.h2h-title')!.textContent).toBe('vs Lee1–1');
    expect(within(lee).getAllByRole('listitem')).toHaveLength(2);
    const ana = screen.getByRole('region', { name: 'vs Ana' });
    expect(ana.querySelector('.h2h-title')!.textContent).toBe('vs Ana1–0');
    expect(ana.textContent).toContain('1 more not in the record');
    expect(screen.queryByRole('region', { name: 'vs Max' })).toBeNull();
    // Practice counts once it's included.
    fireEvent.change(screen.getByLabelText('Events'), { target: { value: 'all' } });
    await waitFor(() => expect(screen.getByRole('region', { name: 'vs Lee' }).querySelector('.h2h-title')!.textContent).toBe('vs Lee1–2'));
  });
});
