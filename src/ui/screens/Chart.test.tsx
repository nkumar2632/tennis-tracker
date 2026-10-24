// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_PRESETS } from '../../domain/format';
import { replay } from '../../domain/replay';
import { newMatch, play } from '../../domain/test-helpers';
import { db } from '../../storage/db';
import { getMatch, getSetting } from '../../storage/repo';
import { renderAt, resetData, seed, spacedTaps } from '../test-utils';

const match = { ...newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), id: 'm1' };
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const statusText = () => screen.getAllByRole('status').map((el) => el.textContent).join(' | ');
const lastPoint = () => document.querySelector('.lastpoint')!.textContent;
const stored = async () => (await getMatch(db, 'm1'))!;

beforeEach(async () => {
  await resetData();
  spacedTaps();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openChart(m = match) {
  await seed(m);
  const view = renderAt('/match/m1/chart');
  await screen.findByText('Sam', { selector: '.sb-name' }); // settings (the name) have loaded
  return view;
}

describe('point entry', () => {
  it('logs a point with one tap, confirms it, and saves it', async () => {
    await openChart();
    expect(lastPoint()).toContain('Ready for the first point');
    tap('Sam winner');
    expect(lastPoint()).toContain('✓ Point 1 · Sam: winner');
    expect(within(screen.getByLabelText('Score')).getByText('15')).toBeTruthy();
    await waitFor(async () => expect((await stored()).points).toHaveLength(1));
    expect(await getSetting(db, 'activeMatchId')).toBe('m1');
  });

  it('shows the second serve clearly after a fault, then logs a double fault', async () => {
    await openChart();
    tap('Fault');
    expect(statusText()).toContain('2ND SERVE · Sam serving');
    expect(screen.queryByRole('button', { name: 'Fault' })).toBeNull();
    tap('Double fault');
    expect(lastPoint()).toContain('Sam: double fault');
    expect(statusText()).toContain('1st serve');
    await waitFor(async () => expect((await stored()).points[0]).toMatchObject({ serve: 2, ending: 'double_fault' }));
  });

  it('logs a second-serve rally point in two taps', async () => {
    await openChart();
    tap('Fault');
    tap('Lee unforced error');
    expect(lastPoint()).toContain('Lee: unforced error (2nd serve)');
  });

  it('asks which shot ended the point, naming the player, with Return first for the receiver', async () => {
    await openChart();
    tap('Lee unforced error');
    const strokes = screen.getByLabelText('Shot that ended the last point');
    expect(strokes.textContent).toContain("Lee's unforced error: which shot?");
    const chips = within(strokes).getAllByRole('button').map((b) => b.textContent);
    expect(chips).toEqual(['Return', 'Forehand', 'Backhand', 'Volley', 'Overhead', 'Drop shot']);
    tap('Return');
    expect(lastPoint()).toContain('Lee: return unforced error');
    tap('Return'); // tapping again clears it
    expect(lastPoint()).toContain('Lee: unforced error');
  });

  it('offers no Return for the server and no strokes after a serve ending or a fault', async () => {
    await openChart();
    tap('Sam winner');
    expect(screen.queryByRole('button', { name: 'Return' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Forehand' })).toBeTruthy();
    tap('Fault');
    expect(screen.queryByRole('button', { name: 'Forehand' })).toBeNull();
    tap('Ace');
    expect(screen.queryByRole('button', { name: 'Forehand' })).toBeNull();
  });

  it('the next tap moves on: the stroke strip never blocks', async () => {
    await openChart();
    tap('Sam winner');
    tap('Lee winner');
    expect(lastPoint()).toContain('Point 2 · Lee: winner');
  });

  it('undoes one tap at a time and says what was undone', async () => {
    await openChart();
    tap('Sam winner');
    tap('Fault');
    tap(/Undo/);
    expect(statusText()).toContain('Undid the fault');
    tap(/Undo/);
    expect(statusText()).toContain('Undid point 1 (Sam: winner)');
    expect(lastPoint()).toContain('Ready for the first point');
    await waitFor(async () => expect((await stored()).points).toHaveLength(0));
  });

  it('returns to the second serve when undoing a double fault', async () => {
    await openChart();
    tap('Fault');
    tap('Double fault');
    tap(/Undo/);
    expect(statusText()).toContain('2ND SERVE');
  });

  it('ignores an accidental double tap', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(5000);
    await openChart();
    tap('Sam winner');
    tap('Sam winner');
    expect(lastPoint()).toContain('Point 1 ·');
    await waitFor(async () => expect((await stored()).points).toHaveLength(1));
  });

  it('shows the result when the match is won and hides the entry buttons', async () => {
    await openChart({ ...play(newMatch(FORMAT_PRESETS.proSet8, { opponentName: 'Lee' }), 'gp*7 p p p'), id: 'm1' });
    tap('Sam winner');
    expect(screen.getAllByText('Sam won 8-0').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Ace' })).toBeNull();
    expect(screen.getByRole('button', { name: /Undo/ })).toBeTruthy();
  });

  it('ends a match early from the menu', async () => {
    const view = await openChart();
    tap('Sam winner');
    tap('Match menu');
    tap('End match early…');
    tap('Lee retired');
    await waitFor(() => expect(view.path()).toBe('/match/m1'));
    await waitFor(async () => expect(await stored()).toMatchObject({ status: 'retired', retiredSide: 'opponent' }));
  });
});

describe('resume', () => {
  it('reopens the match being charted when the app launches', async () => {
    await seed(play(match, 'p p'));
    await db.settings.put({ key: 'activeMatchId', value: 'm1' });
    const view = renderAt('/');
    await waitFor(() => expect(view.path()).toBe('/match/m1/chart'));
    await screen.findByText(/Point 2/);
  });

  it('stays on the home screen when that match is finished or suspended', async () => {
    await seed({ ...match, status: 'suspended' });
    await db.settings.put({ key: 'activeMatchId', value: 'm1' });
    const view = renderAt('/');
    await screen.findByText('In progress');
    expect(view.path()).toBe('/');
  });
});

describe('Fast4', () => {
  it('scores the 4-4 tiebreak point as the decider, served by the player who received first', async () => {
    const fast4 = { ...play(newMatch(FORMAT_PRESETS.fast4, { opponentName: 'Lee' }), 'gp go gp go gp go p p p p o o o o'), id: 'm1' };
    await openChart(fast4);
    expect(statusText()).toContain('1st serve · Lee serving · Tiebreak');
    tap('Lee winner');
    await waitFor(async () => expect((await stored()).points).toHaveLength(fast4.points.length + 1));
    // Lee won the set 4-3 on the deciding point and serves first in set 2.
    expect(statusText()).toContain('1st serve · Lee serving');
    expect(statusText()).not.toContain('Tiebreak');
    expect(replay(await stored()).final.completedSets[0]).toMatchObject({
      games: { player: 3, opponent: 4 },
      tiebreak: { player: 4, opponent: 5 },
      winner: 'opponent',
    });
  });
});

