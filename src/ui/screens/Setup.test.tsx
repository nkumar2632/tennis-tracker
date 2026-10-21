// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_PRESETS } from '../../domain/format';
import { newMatch, play } from '../../domain/test-helpers';
import { db } from '../../storage/db';
import { getMatch, getSetting, listMatches } from '../../storage/repo';
import { renderAt, resetData, seed, spacedTaps } from '../test-utils';

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const radio = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { selector: 'input,textarea' }), { target: { value } });

beforeEach(async () => {
  await resetData();
  spacedTaps();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('new match', () => {
  it('needs only the opponent and who serves first', async () => {
    const view = renderAt('/new');
    await screen.findByText('Who serves first?');
    tap('Start match');
    expect(screen.getByRole('alert').textContent).toContain("Enter the opponent's name.");
    expect(screen.getByRole('alert').textContent).toContain('Choose who serves first.');

    type('Opponent', 'Lee Park');
    radio('Lee Park');
    tap('Start match');
    await waitFor(() => expect(view.path()).toMatch(/^\/match\/.+\/chart$/));
    const [m] = await listMatches(db);
    expect(m).toMatchObject({ opponentName: 'Lee Park', firstServer: 'opponent', format: FORMAT_PRESETS.twoSetsMatchTiebreak });
  });

  it('remembers the event, surface and format for next time', async () => {
    renderAt('/new');
    await screen.findByText('Who serves first?');
    type('Opponent', 'Lee');
    radio('Sam');
    radio('8-game pro set');
    fireEvent.click(screen.getByLabelText(/No-ad/));
    type('Event', 'Spring Duals');
    radio('HS dual match');
    radio('Clay');
    tap('Start match');
    await waitFor(async () => expect(await getSetting(db, 'lastSetup')).not.toBeNull());
    expect(await getSetting(db, 'lastSetup')).toMatchObject({
      eventName: 'Spring Duals',
      eventType: 'hs_dual',
      surface: 'clay',
      format: { ...FORMAT_PRESETS.proSet8, noAd: true },
    });
    cleanup();
    renderAt('/new');
    await screen.findByText('Who serves first?');
    expect((screen.getByLabelText('Event') as HTMLInputElement).value).toBe('Spring Duals');
    expect(screen.getByRole('radio', { name: 'Clay' }).getAttribute('aria-checked')).toBe('true');
  });

  it("fills in a past opponent's UTR and hand", async () => {
    await seed({ ...newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee Park', opponentUtr: 7.2, opponentHand: 'left' }), id: 'old' });
    renderAt('/new');
    await screen.findByText('Who serves first?');
    await waitFor(() => expect(document.querySelectorAll('#past-opponents option')).toHaveLength(1));
    type('Opponent', 'lee park');
    expect((screen.getByLabelText("Opponent's UTR") as HTMLInputElement).value).toBe('7.2');
    expect(screen.getByRole('radio', { name: 'Left-handed' }).getAttribute('aria-checked')).toBe('true');
  });

  it('leaves UTRs optional but checks them when entered', async () => {
    renderAt('/new');
    await screen.findByText('Who serves first?');
    type('Opponent', 'Lee');
    radio('Sam');
    type("Opponent's UTR", '25');
    tap('Start match');
    expect(screen.getByRole('alert').textContent).toContain('between 1 and 16.5');
  });

  it('starts from a late-start score', async () => {
    const view = renderAt('/new');
    await screen.findByText('Who serves first?');
    type('Opponent', 'Lee');
    fireEvent.click(screen.getByLabelText('Charting started mid-match'));
    radio('Lee');
    tap('+ Add a finished set');
    type('Set 1: Sam', '6');
    type('Set 1: Lee', '4');
    type('Current set: Sam', '2');
    type('Current set: Lee', '1');
    tap('Start match');
    await waitFor(() => expect(view.path()).toMatch(/chart$/));
    const [m] = await listMatches(db);
    expect(m?.startingScore).toEqual({ completedSets: [{ games: { player: 6, opponent: 4 } }], games: { player: 2, opponent: 1 } });
  });
});

describe('match details', () => {
  it('edits details later without touching the points', async () => {
    const m = { ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), 'gp'), id: 'm1' };
    await seed(m);
    const view = renderAt('/match/m1/edit');
    await screen.findByText('Who serves first?');
    type("Opponent's UTR", '7.4');
    type('Notes', 'Windy');
    tap('Save');
    await waitFor(() => expect(view.path()).toBe('/match/m1'));
    await waitFor(async () => expect(await getMatch(db, 'm1')).toMatchObject({ opponentUtr: 7.4, notes: 'Windy', points: m.points }));
  });

  it('refuses a format change that would end the match before the last point', async () => {
    await seed({ ...play(newMatch(FORMAT_PRESETS.bestOf3, { opponentName: 'Lee' }), 'gp*7'), id: 'm1' });
    renderAt('/match/m1/edit');
    await screen.findByText('Who serves first?');
    radio('8-game pro set');
    fireEvent.click(screen.getByText(/^Adjust:/));
    fireEvent.change(screen.getByLabelText('Games to win a set'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Set tiebreak at (games all)'), { target: { value: '6' } });
    tap('Save');
    expect((await screen.findByRole('alert')).textContent).toContain('end the match before the last logged point');
  });
});
