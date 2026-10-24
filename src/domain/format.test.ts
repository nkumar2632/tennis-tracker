import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS, isFinishedSetScore, validateFormat, validateStartingScore } from './format';
import { createMatch } from './match';
import type { MatchFormat } from './types';

const AD = FORMAT_PRESETS.bestOf3;
const MTB = FORMAT_PRESETS.twoSetsMatchTiebreak;

describe('validateFormat', () => {
  it('accepts every preset', () => {
    for (const f of Object.values(FORMAT_PRESETS)) expect(validateFormat(f)).toEqual([]);
  });

  it('accepts custom options such as a 7-7 pro set tiebreak or a 7-point match tiebreak', () => {
    expect(validateFormat({ ...FORMAT_PRESETS.proSet8, tiebreakAt: 7 })).toEqual([]);
    expect(validateFormat({ ...MTB, matchTiebreakPoints: 7, noAd: true })).toEqual([]);
  });

  it('rejects nonsense', () => {
    const bad: MatchFormat = { ...AD, gamesPerSet: 0, tiebreakPoints: 2.5 };
    expect(validateFormat(bad).length).toBeGreaterThanOrEqual(2);
    expect(validateFormat({ ...AD, tiebreakAt: 7 })).toHaveLength(1);
    expect(validateFormat({ ...FORMAT_PRESETS.proSet8, finalSetMatchTiebreak: true })).toHaveLength(1);
  });
});

describe('isFinishedSetScore', () => {
  it('knows which games scores end a set', () => {
    expect(isFinishedSetScore(AD, { player: 6, opponent: 4 })).toBe(true);
    expect(isFinishedSetScore(AD, { player: 7, opponent: 5 })).toBe(true);
    expect(isFinishedSetScore(AD, { player: 6, opponent: 7 })).toBe(true);
    expect(isFinishedSetScore(AD, { player: 6, opponent: 5 })).toBe(false);
    expect(isFinishedSetScore(AD, { player: 5, opponent: 3 })).toBe(false);
  });
});

describe('validateStartingScore', () => {
  it('accepts a valid late start', () => {
    expect(
      validateStartingScore(AD, { completedSets: [{ games: { player: 7, opponent: 6 } }], games: { player: 3, opponent: 2 } }),
    ).toEqual([]);
    expect(
      validateStartingScore(MTB, {
        completedSets: [{ games: { player: 6, opponent: 3 } }, { games: { player: 4, opponent: 6 } }],
        games: { player: 0, opponent: 0 },
      }),
    ).toEqual([]);
  });

  it('rejects unfinished sets, finished matches and impossible games', () => {
    expect(validateStartingScore(AD, { completedSets: [{ games: { player: 6, opponent: 5 } }], games: { player: 0, opponent: 0 } })).toHaveLength(1);
    expect(
      validateStartingScore(AD, {
        completedSets: [{ games: { player: 6, opponent: 0 } }, { games: { player: 6, opponent: 0 } }],
        games: { player: 0, opponent: 0 },
      }),
    ).toHaveLength(1);
    expect(validateStartingScore(AD, { completedSets: [], games: { player: 6, opponent: 3 } })).toHaveLength(1);
    expect(validateStartingScore(AD, { completedSets: [], games: { player: 9, opponent: 0 } })).not.toEqual([]);
    expect(validateStartingScore(AD, { completedSets: [], games: { player: -1, opponent: 0 } })).toHaveLength(1);
    expect(
      validateStartingScore(MTB, {
        completedSets: [{ games: { player: 6, opponent: 3 } }, { games: { player: 4, opponent: 6 } }],
        games: { player: 2, opponent: 1 },
      }),
    ).toHaveLength(1);
  });
});

describe('createMatch', () => {
  const setup = {
    playerId: 'p1',
    date: '2026-10-01',
    eventName: 'Fall Open',
    eventType: 'usta' as const,
    surface: 'hard' as const,
    indoor: false,
    opponentName: 'Lee',
    notes: '',
    format: AD,
    firstServer: 'player' as const,
  };

  it('starts an empty, in-progress match', () => {
    const m = createMatch(setup, 5, 'id-1');
    expect(m).toMatchObject({ id: 'id-1', status: 'in_progress', points: [], pendingFault: false, createdAt: 5 });
  });

  it('refuses an invalid format or starting score', () => {
    expect(() => createMatch({ ...setup, format: { ...AD, gamesPerSet: 0 } })).toThrow();
    expect(() => createMatch({ ...setup, startingScore: { completedSets: [], games: { player: 6, opponent: 0 } } })).toThrow();
  });
});
