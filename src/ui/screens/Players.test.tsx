// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT_PRESETS } from '../../domain/format';
import { newMatch, play } from '../../domain/test-helpers';
import type { Match } from '../../domain/types';
import { db } from '../../storage/db';
import { getMatch, getSetting, listMatches, listPlayers, savePlayer, setSetting } from '../../storage/repo';
import { renderAt, resetData, seed, spacedTaps } from '../test-utils';
import { forgetSeasonFilter } from './Season';

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const radio = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { selector: 'input,textarea' }), { target: { value } });
const pick = (group: string, name: string) => fireEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name }));
const titles = () => screen.queryAllByText(/^vs /, { selector: '.match-row-title' }).map((e) => e.textContent);

/** A won 8-game pro set for `playerId`. */
const won = (id: string, playerId: string, extra: Partial<Match> = {}): Match => ({
  ...play(newMatch(FORMAT_PRESETS.proSet8, { playerId, date: '2026-10-01', ...extra }), 'gp*8'),
  id,
});

beforeEach(async () => {
  forgetSeasonFilter();
  await resetData();
  spacedTaps();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function addMaya() {
  await savePlayer(db, { id: 'p2', name: 'Maya', createdAt: 2 });
}

describe('one player', () => {
  it('looks the same as before: no player switch, no player choice', async () => {
    await seed(won('sam-1', 'p1', { opponentName: 'Lee' }));
    renderAt('/');
    await screen.findByText('vs Lee');
    expect(screen.queryByRole('radiogroup', { name: 'Player' })).toBeNull();
    cleanup();
    renderAt('/new');
    await screen.findByText('Who serves first?');
    expect(screen.queryByRole('radiogroup', { name: 'Player' })).toBeNull();
  });

  it('asks for the first player before a match can be started', async () => {
    await resetData('');
    renderAt('/');
    await screen.findByText(/Who are you charting/);
    expect(screen.queryByRole('link', { name: '+ New match' })).toBeNull();
    type(/Who are you charting/, '  Sam  ');
    tap('Save');
    await screen.findByRole('link', { name: '+ New match' });
    const [sam] = await listPlayers(db);
    expect(sam!.name).toBe('Sam');
    expect(await getSetting(db, 'currentPlayerId')).toBe(sam!.id);
  });
});

describe('several players', () => {
  beforeEach(async () => {
    await addMaya();
    await seed(
      won('sam-1', 'p1', { opponentName: 'Lee' }),
      won('maya-1', 'p2', { opponentName: 'Ana', playerUtr: 5.5 }),
      won('maya-2', 'p2', { opponentName: 'Zoe', date: '2026-09-01' }),
    );
  });

  it("shows one player's matches and season at a time, switched on Home", async () => {
    renderAt('/');
    await screen.findByText('vs Lee');
    expect(titles()).toEqual(['vs Lee']);
    expect(screen.getByRole('link', { name: /Season/ }).textContent).toContain('1–0');
    radio('Maya');
    await screen.findByText('vs Ana');
    expect(titles()).toEqual(['vs Ana', 'vs Zoe']);
    expect(screen.getByRole('link', { name: /Season/ }).textContent).toContain('2–0');
    expect(await getSetting(db, 'currentPlayerId')).toBe('p2');

    fireEvent.click(screen.getByRole('link', { name: /Season/ }));
    await screen.findByText("Maya's season");
    expect((await screen.findByRole('region', { name: 'Record' })).textContent).toContain('2–0');
    expect(titles()).toEqual(['vs Ana', 'vs Zoe']);
  });

  it("starts a match for the chosen player with their UTR, and Home follows that player", async () => {
    const view = renderAt('/new');
    await screen.findByText('Who serves first?');
    const players = within(screen.getByRole('radiogroup', { name: 'Player' }));
    expect(players.getByRole('radio', { name: 'Sam' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText("Sam's UTR") as HTMLInputElement).value).toBe('');
    pick('Player', 'Maya');
    // The serve question and UTR now name Maya, with her latest UTR filled in.
    await screen.findByLabelText("Maya's UTR");
    expect((screen.getByLabelText("Maya's UTR") as HTMLInputElement).value).toBe('5.5');
    type('Opponent', 'Kim');
    pick('Who serves first?', 'Maya');
    tap('Start match');
    await waitFor(() => expect(view.path()).toMatch(/^\/match\/.+\/chart$/));
    const started = (await listMatches(db)).find((m) => m.opponentName === 'Kim')!;
    expect(started).toMatchObject({ playerId: 'p2', playerUtr: 5.5, firstServer: 'player' });
    expect(await getSetting(db, 'currentPlayerId')).toBe('p2');
  });

  it('moves a match to another player from Match details', async () => {
    renderAt('/match/sam-1/edit');
    await screen.findByText('Match details');
    pick('Player', 'Maya');
    tap('Save');
    await waitFor(async () => expect((await getMatch(db, 'sam-1'))!.playerId).toBe('p2'));
  });

  it('reopens a live match for its player', async () => {
    await seed({ ...play(newMatch(FORMAT_PRESETS.proSet8, { playerId: 'p2', opponentName: 'Kim' }), 'gp'), id: 'live' });
    await setSetting(db, 'activeMatchId', 'live');
    const view = renderAt('/');
    await waitFor(() => expect(view.path()).toBe('/match/live/chart'));
    expect(await getSetting(db, 'currentPlayerId')).toBe('p2');
  });
});

describe('players in Settings', () => {
  it('adds and renames players', async () => {
    renderAt('/settings');
    await screen.findByText('Players');
    tap('+ Add a player');
    type('Name', 'Maya');
    tap('Add player');
    await waitFor(async () => expect((await listPlayers(db)).map((p) => p.name)).toEqual(['Sam', 'Maya']));
    const inputs = () => screen.getAllByRole('textbox').filter((e) => e.closest('.player-row')) as HTMLInputElement[];
    await waitFor(() => expect(inputs().map((i) => i.value)).toEqual(['Sam', 'Maya']));
    fireEvent.change(inputs()[1]!, { target: { value: 'Maya Lee' } });
    await waitFor(async () => expect((await listPlayers(db))[1]!.name).toBe('Maya Lee'));
    // A blank name is never saved.
    fireEvent.change(inputs()[1]!, { target: { value: '  ' } });
    fireEvent.blur(inputs()[1]!);
    expect(inputs()[1]!.value).toBe('Maya Lee');
    expect((await listPlayers(db))[1]!.name).toBe('Maya Lee');
  });

  it('deletes a player and their matches after confirming; Home falls back to the other player', async () => {
    await addMaya();
    await setSetting(db, 'currentPlayerId', 'p2');
    await seed(won('sam-1', 'p1'), won('maya-1', 'p2'), won('maya-2', 'p2'));
    renderAt('/settings');
    await screen.findByText('Players');
    await waitFor(() => expect(screen.getAllByText('· 2 matches')).toHaveLength(1));
    tap('Delete Maya');
    const confirm = within(screen.getByRole('dialog', { name: 'Delete Maya?' }));
    expect(confirm.getByText("This also deletes Maya's 2 matches for good. Back up first if you might want them.")).toBeTruthy();
    fireEvent.click(confirm.getByRole('button', { name: 'Delete Maya' }));
    await waitFor(async () => expect((await listMatches(db)).map((m) => m.id)).toEqual(['sam-1']));
    expect((await listPlayers(db)).map((p) => p.id)).toEqual(['p1']);
    cleanup();
    renderAt('/');
    await screen.findByRole('link', { name: '+ New match' });
    expect(screen.queryByRole('radiogroup', { name: 'Player' })).toBeNull();
    expect(titles()).toHaveLength(1);
  });
});
