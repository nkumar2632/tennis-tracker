import { describe, expect, it } from 'vitest';
import { FORMAT_PRESETS } from './format';
import { formatSummary, gameHeading, resultLine, scoreLine, strokeChoices } from './labels';
import { endMatchEarly, suspendMatch } from './log';
import { replay } from './replay';
import { newMatch, play } from './test-helpers';

const names = { player: 'Sam', opponent: 'Lee' };

describe('strokeChoices', () => {
  it('offers no strokes for serve endings', () => {
    const r = replay(play(newMatch(), 'A S D'));
    for (const rp of r.points) expect(strokeChoices(rp)).toEqual([]);
  });

  it('puts Return first when the receiver ended the point, and hides it for the server', () => {
    const r = replay(play(newMatch(), 'oU pU')); // player serving: opponent is the receiver
    expect(strokeChoices(r.points[0]!)).toEqual(['return', 'forehand', 'backhand', 'volley', 'overhead', 'drop_shot']);
    expect(strokeChoices(r.points[1]!)).toEqual(['forehand', 'backhand', 'volley', 'overhead', 'drop_shot']);
  });
});

describe('formatSummary', () => {
  it('describes each preset', () => {
    expect(formatSummary(FORMAT_PRESETS.bestOf3)).toBe('Best of 3 sets · 7-pt tiebreak at 6-6');
    expect(formatSummary({ ...FORMAT_PRESETS.twoSetsMatchTiebreak, noAd: true })).toBe(
      'Best of 3 sets · 7-pt tiebreak at 6-6 · 10-pt match tiebreak for the 3rd set · no-ad',
    );
    expect(formatSummary(FORMAT_PRESETS.proSet8)).toBe('8-game pro set · 7-pt tiebreak at 8-8');
    expect(formatSummary(FORMAT_PRESETS.fast4)).toBe(
      'Fast4: best of 3 sets to 4 games · 5-pt tiebreak at 3-3, deciding point at 4-4 · no-ad',
    );
  });

  it('describes adjusted formats', () => {
    expect(formatSummary({ ...FORMAT_PRESETS.bestOf3, gamesPerSet: 4, tiebreakAt: 4 })).toBe('Best of 3 sets to 4 games · 7-pt tiebreak at 4-4');
    expect(formatSummary({ ...FORMAT_PRESETS.fast4, tiebreakSuddenDeath: false })).toBe(
      'Best of 3 sets to 4 games · 5-pt tiebreak at 3-3 · no-ad',
    );
  });
});

describe('scoreLine and resultLine', () => {
  it('shows the set in progress', () => {
    expect(scoreLine(replay(newMatch()).final, 'player')).toBe('0-0');
    expect(scoreLine(replay(play(newMatch(), 'gp*6 gp')).final, 'player')).toBe('6-0 1-0');
    expect(scoreLine(replay(play(newMatch(), 'gp*6 gp')).final, 'opponent')).toBe('0-6 0-1');
    const mtb = play(newMatch(FORMAT_PRESETS.twoSetsMatchTiebreak), 'gp*6 go*6 p p o');
    expect(scoreLine(replay(mtb).final, 'player')).toBe('6-0 0-6 [2-1]');
  });

  it('describes how the match stands or ended', () => {
    const line = (m: ReturnType<typeof newMatch>) => resultLine(m, replay(m), names);
    expect(line(newMatch())).toBe('Not started');
    expect(line(play(newMatch(), 'gp'))).toBe('In progress · 1-0');
    expect(line(play(newMatch(), 'go*12'))).toBe('Lee won 6-0 6-0');
    expect(line(endMatchEarly(play(newMatch(), 'gp'), { kind: 'retired', retiredSide: 'opponent' }))).toBe('Lee retired at 1-0');
    expect(line(endMatchEarly(play(newMatch(), 'gp'), { kind: 'stopped' }))).toBe('Stopped at 1-0');
    expect(line(suspendMatch(play(newMatch(), 'gp')))).toBe('Suspended at 1-0');
  });
});

describe('gameHeading', () => {
  it('numbers games within the set and names tiebreaks', () => {
    const r = replay(play(newMatch(FORMAT_PRESETS.twoSetsMatchTiebreak), 'gp go '.repeat(6) + 'p*7 gp go*6 p'));
    expect(gameHeading(r.games[0]!, r, names)).toBe('Set 1 · Game 1 · Sam serving');
    expect(gameHeading(r.games[1]!, r, names)).toBe('Set 1 · Game 2 · Lee serving');
    expect(gameHeading(r.games[12]!, r, names)).toBe('Set 1 · Tiebreak');
    expect(gameHeading(r.games[13]!, r, names)).toBe('Set 2 · Game 1 · Lee serving');
    expect(gameHeading(r.games.at(-1)!, r, names)).toBe('Match tiebreak');
  });
});
