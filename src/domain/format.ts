import type { MatchFormat, StartingScore } from './types';
import { SIDES, otherSide } from './types';

export const FORMAT_PRESETS = {
  bestOf3: {
    bestOf: 3,
    gamesPerSet: 6,
    tiebreakAt: 6,
    tiebreakPoints: 7,
    finalSetMatchTiebreak: false,
    matchTiebreakPoints: 10,
    noAd: false,
  },
  twoSetsMatchTiebreak: {
    bestOf: 3,
    gamesPerSet: 6,
    tiebreakAt: 6,
    tiebreakPoints: 7,
    finalSetMatchTiebreak: true,
    matchTiebreakPoints: 10,
    noAd: false,
  },
  proSet8: {
    bestOf: 1,
    gamesPerSet: 8,
    tiebreakAt: 8,
    tiebreakPoints: 7,
    finalSetMatchTiebreak: false,
    matchTiebreakPoints: 10,
    noAd: false,
  },
  /**
   * Fast4 as UTR events play it: sets to 4, a 5-point tiebreak at 3-3 decided by one point at 4-4,
   * no-ad, and a 10-point match tiebreak instead of a third set.
   */
  fast4: {
    bestOf: 3,
    gamesPerSet: 4,
    tiebreakAt: 3,
    tiebreakPoints: 5,
    tiebreakSuddenDeath: true,
    finalSetMatchTiebreak: true,
    matchTiebreakPoints: 10,
    noAd: true,
  },
} as const satisfies Record<string, MatchFormat>;

export type FormatPresetKey = keyof typeof FORMAT_PRESETS;

export const FORMAT_PRESET_LABELS: Record<FormatPresetKey, string> = {
  bestOf3: 'Best of 3 sets',
  twoSetsMatchTiebreak: '2 sets + match tiebreak',
  proSet8: '8-game pro set',
  fast4: 'Fast4 (sets to 4)',
};

/** Best of 3 sets to 4 games with a tiebreak at 3-3; the tiebreak, third set and no-ad details vary by event. */
export function isFast4(f: MatchFormat): boolean {
  return f.bestOf === 3 && f.gamesPerSet === 4 && f.tiebreakAt === 3;
}

export function setsToWin(format: MatchFormat): number {
  return (format.bestOf + 1) / 2;
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

/** Returns a list of problems; empty means the format is valid. */
export function validateFormat(format: MatchFormat): string[] {
  const errors: string[] = [];
  if (format.bestOf !== 1 && format.bestOf !== 3) errors.push('Best of must be 1 or 3.');
  if (!isPositiveInt(format.gamesPerSet)) errors.push('Games per set must be a positive whole number.');
  if (!isPositiveInt(format.tiebreakAt)) errors.push('Tiebreak games must be a positive whole number.');
  if (format.tiebreakAt > format.gamesPerSet) {
    errors.push('The set tiebreak must start at or before the games-per-set score.');
  }
  if (!isPositiveInt(format.tiebreakPoints)) errors.push('Tiebreak points must be a positive whole number.');
  if (format.tiebreakSuddenDeath !== undefined && typeof format.tiebreakSuddenDeath !== 'boolean') {
    errors.push('Tiebreak deciding point must be on or off.');
  }
  if (!isPositiveInt(format.matchTiebreakPoints)) {
    errors.push('Match tiebreak points must be a positive whole number.');
  }
  if (format.finalSetMatchTiebreak && format.bestOf === 1) {
    errors.push('A match tiebreak needs a best-of-3 match.');
  }
  return errors;
}

/** Did this games score finish a set (won outright by 2, or decided by a set tiebreak)? */
export function isFinishedSetScore(format: MatchFormat, games: { player: number; opponent: number }): boolean {
  return SIDES.some((s) => {
    const mine = games[s];
    const theirs = games[otherSide(s)];
    const wonOutright = mine >= format.gamesPerSet && mine - theirs >= 2;
    const wonTiebreak = mine === format.tiebreakAt + 1 && theirs === format.tiebreakAt;
    return wonOutright || wonTiebreak;
  });
}

/** Returns a list of problems with a late-start score; empty means it is valid. */
export function validateStartingScore(format: MatchFormat, start: StartingScore): string[] {
  const errors: string[] = [];
  const nonNegInt = (n: number) => Number.isInteger(n) && n >= 0;
  const setsWon = { player: 0, opponent: 0 };

  start.completedSets.forEach((set, i) => {
    if (!nonNegInt(set.games.player) || !nonNegInt(set.games.opponent)) {
      errors.push(`Set ${i + 1}: games must be whole numbers.`);
      return;
    }
    if (!isFinishedSetScore(format, set.games)) {
      errors.push(`Set ${i + 1}: ${set.games.player}-${set.games.opponent} is not a finished set.`);
      return;
    }
    setsWon[set.games.player > set.games.opponent ? 'player' : 'opponent'] += 1;
  });

  const needed = setsToWin(format);
  if (setsWon.player >= needed || setsWon.opponent >= needed) {
    errors.push('Those sets would already have finished the match.');
  }

  const { games } = start;
  if (!nonNegInt(games.player) || !nonNegInt(games.opponent)) {
    errors.push('Current set games must be whole numbers.');
  } else {
    const inMatchTiebreak =
      format.finalSetMatchTiebreak && setsWon.player === needed - 1 && setsWon.opponent === needed - 1;
    if (inMatchTiebreak && (games.player !== 0 || games.opponent !== 0)) {
      errors.push('The deciding set is a match tiebreak, so current games must be 0-0.');
    }
    if (isFinishedSetScore(format, games)) {
      errors.push(`${games.player}-${games.opponent} would already have finished the set.`);
    } else if (games.player > format.tiebreakAt && games.opponent > format.tiebreakAt) {
      errors.push(`${games.player}-${games.opponent} is past the tiebreak score.`);
    } else if (Math.max(games.player, games.opponent) > Math.max(format.gamesPerSet, format.tiebreakAt)) {
      errors.push(`${games.player}-${games.opponent} is not a possible set score.`);
    }
  }
  return errors;
}
