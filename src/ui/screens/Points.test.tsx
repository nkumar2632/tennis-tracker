// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_PRESETS } from '../../domain/format';
import { newMatch, play } from '../../domain/test-helpers';
import { db } from '../../storage/db';
import { getMatch } from '../../storage/repo';
import { renderAt, resetData, seed, spacedTaps } from '../test-utils';

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const base = { ...newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), id: 'm1' };
const stored = async () => (await getMatch(db, 'm1'))!;

beforeEach(async () => {
  await resetData();
  spacedTaps();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('points list', () => {
  it('lists points newest first under game headings', async () => {
    await seed(play(base, 'gp oW:bh'));
    renderAt('/match/m1/points');
    await screen.findByText('Set 1 · Game 2 · Lee serving');
    const rows = screen.getAllByRole('link').filter((a) => a.classList.contains('point-row'));
    expect(rows[0]?.textContent).toContain('#5');
    expect(rows[0]?.textContent).toContain('Lee: backhand winner');
    expect(screen.getByText(/Set 1 · Game 1 · Sam serving/).textContent).toContain('won by Sam');
  });
});

describe('point editor', () => {
  it('changes a point and re-scores, dropping a stroke that belonged to the other player', async () => {
    const m = play(base, 'pW:fh p');
    await seed(m);
    const view = renderAt(`/match/m1/points/${m.points[0]!.id}`);
    await screen.findByText(/score before: 0-0/);
    tap('Lee winner');
    expect(screen.getByRole('button', { name: 'Forehand' }).getAttribute('aria-pressed')).toBe('false');
    tap('Save');
    await waitFor(() => expect(view.path()).toBe('/match/m1/points'));
    await waitFor(async () => expect((await stored()).points[0]).toMatchObject({ ending: 'winner', endedBy: 'opponent' }));
    expect((await stored()).points[0]).not.toHaveProperty('stroke');
  });

  it('keeps the stroke when only the kind of error changes', async () => {
    const m = play(base, 'pU:bh');
    await seed(m);
    renderAt(`/match/m1/points/${m.points[0]!.id}`);
    await screen.findByText(/score before/);
    tap('Sam forced error');
    tap('Save');
    await waitFor(async () => expect((await stored()).points[0]).toMatchObject({ ending: 'forced_error', stroke: 'backhand' }));
  });

  it('switches to the second serve when double fault is chosen', async () => {
    const m = play(base, 'p');
    await seed(m);
    renderAt(`/match/m1/points/${m.points[0]!.id}`);
    await screen.findByText(/score before/);
    tap('Double fault');
    expect(screen.getByRole('radio', { name: '2nd serve' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('radio', { name: '1st serve' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('inserts a missed point before another one', async () => {
    const m = play(base, 'p p');
    await seed(m);
    const view = renderAt(`/match/m1/insert/${m.points[1]!.id}`);
    await screen.findByText(/goes before point 2/);
    tap('Lee unforced error');
    tap('Insert point');
    await waitFor(() => expect(view.path()).toBe('/match/m1/points'));
    await waitFor(async () => expect((await stored()).points.map((p) => p.ending)).toEqual(['winner', 'unforced_error', 'winner']));
  });

  it('deletes a point after a second tap', async () => {
    const m = play(base, 'p o');
    await seed(m);
    renderAt(`/match/m1/points/${m.points[0]!.id}`);
    await screen.findByText(/score before/);
    tap('Delete this point');
    expect((await stored()).points).toHaveLength(2);
    tap('Tap again to delete point 1');
    await waitFor(async () => expect((await stored()).points).toHaveLength(1));
  });

  it('explains an edit that would end the match before the last point', async () => {
    const m = play({ ...base, format: FORMAT_PRESETS.proSet8 }, 'gp*7 p p p o o p');
    await seed(m);
    renderAt(`/match/m1/points/${m.points.at(-3)!.id}`);
    await screen.findByText(/score before/);
    tap('Sam winner');
    tap('Save');
    expect((await screen.findByRole('alert')).textContent).toContain('end the match before the last logged point');
  });
});
