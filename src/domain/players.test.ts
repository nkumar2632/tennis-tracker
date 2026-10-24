import { describe, expect, it } from 'vitest';
import { adoptMatch, latestUtr, matchesOf, newPlayer, playerName, sortPlayers } from './players';
import { newMatch } from './test-helpers';

describe('players', () => {
  it('tidies names and keeps players in the order they were added', () => {
    const maya = newPlayer('  Maya   Lee ', 2, 'p2');
    const sam = newPlayer('Sam', 1, 'p1');
    expect(maya).toEqual({ id: 'p2', name: 'Maya Lee', createdAt: 2 });
    expect(sortPlayers([maya, sam]).map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('shows "Player" for a blank name or a missing player', () => {
    const players = [newPlayer('Sam', 1, 'p1'), newPlayer('', 2, 'p2')];
    expect(playerName(players, 'p1')).toBe('Sam');
    expect(playerName(players, 'p2')).toBe('Player');
    expect(playerName(players, 'gone')).toBe('Player');
  });

  it("finds each player's matches and latest UTR by match date", () => {
    const all = [
      { ...newMatch(undefined, { date: '2026-05-01', playerUtr: 7.1 }), id: 'a' },
      { ...newMatch(undefined, { date: '2026-09-01', playerUtr: 7.4 }), id: 'b' },
      { ...newMatch(undefined, { date: '2026-10-01' }), id: 'c' },
      { ...newMatch(undefined, { date: '2026-10-02', playerUtr: 5, playerId: 'p2' }), id: 'd' },
    ];
    expect(matchesOf(all, 'p1').map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(latestUtr(all, 'p1')).toBe(7.4);
    expect(latestUtr(all, 'p2')).toBe(5);
    expect(latestUtr(all, 'p3')).toBeUndefined();
  });

  it('gives a match saved before players to a player', () => {
    const old = { ...newMatch(), schemaVersion: 1, playerId: undefined as unknown as string };
    expect(adoptMatch(old, 'p7')).toEqual({ ...old, playerId: 'p7', schemaVersion: 2 });
  });
});
