// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_PRESETS } from '../../domain/format';
import { endMatchEarly } from '../../domain/log';
import { HAND_CHARTED, newMatch, play } from '../../domain/test-helpers';
import type { Match } from '../../domain/types';
import { db } from '../../storage/db';
import { getMatch } from '../../storage/repo';
import { renderAt, resetData, seed, spacedTaps } from '../test-utils';

// The real PDF and Excel builders are covered by the domain tests and a browser run.
vi.mock('../exportFiles', () => ({
  makePdfFile: vi.fn(async () => new File(['%PDF-'], 'Sam vs Lee 2026-10-01.pdf', { type: 'application/pdf' })),
  makeExcelFile: vi.fn(async () => new File(['xlsx'], 'Sam vs Lee 2026-10-01.xlsx')),
}));

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const fixture: Match = { ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), HAND_CHARTED), id: 'm1' };
const row = (label: string) => screen.getByRole('rowheader', { name: label }).closest('tr')!;

beforeEach(async () => {
  await resetData();
  spacedTaps();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function open(path: string, ...matches: Match[]) {
  await seed(...(matches.length ? matches : [fixture]));
  const view = renderAt(path);
  await screen.findByRole('navigation', { name: 'Match' });
  return view;
}

describe('stats tab', () => {
  it('shows the result, match details and every stat for both players', async () => {
    await open('/match/m1');
    expect(screen.getByText('In progress · 2-2')).toBeTruthy();
    expect(screen.getByText(/28 points charted/)).toBeTruthy();
    expect(row('1st serve in').textContent).toBe('1st serve in71%10/1479%11/14');
    expect(row('Unreturned serves').textContent).toBe('Unreturned serves11');
    expect(row('Winners minus unforced errors').textContent).toBe('Winners minus unforced errors+10');
  });

  it('shows strokes only when they were recorded, and the 1st serve chart', async () => {
    await open('/match/m1');
    expect(screen.getByText('Winners and unforced errors by stroke')).toBeTruthy();
    expect(row('Forehand').textContent).toBe('Forehand2111');
    expect(screen.getByRole('img', { name: /1st serve % by service game/ })).toBeTruthy();
    cleanup();
    await resetData();
    await open('/match/m1', { ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), 'gp go'), id: 'm1' });
    expect(screen.queryByText('Winners and unforced errors by stroke')).toBeNull();
    // Nothing to measure shows a dash, not 0%.
    expect(row('Break points converted').textContent).toBe('Break points converted——');
  });

  it('switches between the match and each set', async () => {
    const twoSets = { ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), 'gp*6 A A A A'), id: 'm1' };
    await open('/match/m1', twoSets);
    expect(row('Aces').textContent).toBe('Aces40');
    fireEvent.click(screen.getByRole('tab', { name: 'Set 1' }));
    expect(row('Aces').textContent).toBe('Aces00');
    fireEvent.click(screen.getByRole('tab', { name: 'Set 2' }));
    expect(row('Aces').textContent).toBe('Aces40');
  });
});

describe('timeline tab', () => {
  it('lists every point in order and edits one, returning to the timeline', async () => {
    const view = await open('/match/m1/timeline');
    const rows = screen.getAllByRole('link').filter((a) => a.classList.contains('point-row'));
    expect(rows).toHaveLength(28);
    expect(rows[0]!.textContent).toBe('#1Sam: ace15-0');
    expect(rows[7]!.textContent).toBe('#8Sam: unreturned serveGame Sam');
    expect(rows[12]!.textContent).toContain('BP');
    fireEvent.click(rows[0]!);
    await screen.findByText(/score before: 0-0/);
    expect(view.path()).toBe(`/match/m1/timeline/${fixture.points[0]!.id}`);
    tap('Sam forced error');
    tap('Save');
    await waitFor(() => expect(view.path()).toBe('/match/m1/timeline'));
    await waitFor(async () => expect((await getMatch(db, 'm1'))!.points[0]!.ending).toBe('forced_error'));
  });
});

describe('report tab', () => {
  function stubShare() {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    return share;
  }

  it('prepares both files and hands them to the share sheet', async () => {
    const share = stubShare();
    await open('/match/m1/report');
    const sharePdf = await screen.findByRole('button', { name: 'Share PDF report' });
    fireEvent.click(sharePdf);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files.map((f) => f.name)).toEqual(['Sam vs Lee 2026-10-01.pdf']);
    tap('Share both');
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect((share.mock.calls[1] as unknown as [{ files: File[] }])[0].files).toHaveLength(2);
  });

  it('explains when there are too few matches to compare with', async () => {
    stubShare();
    await open('/match/m1/report');
    // The report waits for the match list (its season baseline) to load.
    expect(await screen.findByText(/appears once there are at least 3 other finished matches/)).toBeTruthy();
  });

  it('shows the biggest differences from his season', async () => {
    stubShare();
    const season = ['a', 'b', 'c'].map((id) => ({
      ...endMatchEarly(play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), '2p 2p 2p 2o 2o 2o 2p 2p go'), { kind: 'stopped' }),
      id,
      date: '2026-09-01',
    }));
    const current = { ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), 'p p p o o o p p go'), id: 'm1' };
    await open('/match/m1/report', current, ...season);
    expect((await screen.findByText(/Better than usual/)).textContent).toBe('Better than usual: 1st serve in');
    const compare = screen.getByText('Compared with 3 matches', { exact: false });
    expect(compare).toBeTruthy();
    expect(within(row('1st serve in')).getByText('+100')).toBeTruthy();
  });
});

describe('match menu', () => {
  it('deletes the match after confirming', async () => {
    const view = await open('/match/m1');
    tap('Match menu');
    tap('Delete match…');
    expect(screen.getByText(/all 28 points for good/)).toBeTruthy();
    tap('Delete match');
    await waitFor(() => expect(view.path()).toBe('/'));
    expect(await getMatch(db, 'm1')).toBeUndefined();
  });
});
