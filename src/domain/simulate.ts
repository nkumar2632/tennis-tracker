/**
 * Seeded random match generator: used by the debug screen's "sample match" button and by tests.
 * Distributions are loosely realistic, nothing more.
 */
import { appendPoint, recordFault, type PointInput } from './log';
import { replay } from './replay';
import { serverOf } from './scoring';
import type { Match, Side, Stroke } from './types';
import { otherSide } from './types';

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let x = rand() * total;
  for (const [value, w] of weighted) {
    x -= w;
    if (x < 0) return value;
  }
  return weighted[weighted.length - 1]![0];
}

function rallyEnding(rand: () => number, server: Side, serve: 1 | 2, withStrokes: boolean): PointInput {
  // Server wins a bit more often on first-serve rallies.
  const serverWins = rand() < (serve === 1 ? 0.6 : 0.48);
  const winner = serverWins ? server : otherSide(server);
  const ending = pick(rand, [
    ['winner', 3],
    ['forced_error', 3],
    ['unforced_error', 4],
  ] as const);
  const endedBy = ending === 'winner' ? winner : otherSide(winner);
  const input: PointInput = { ending, endedBy };
  if (withStrokes && rand() < 0.6 && ending !== 'forced_error') {
    const strokes: [Stroke, number][] = [
      ['forehand', 40],
      ['backhand', 35],
      ['volley', 8],
      ['overhead', 4],
      ['drop_shot', 5],
    ];
    if (endedBy !== server) strokes.push(['return', 8]);
    input.stroke = pick(rand, strokes);
  }
  return input;
}

/** Play points until the match ends (or `maxPoints` more points are logged). */
export function simulateMatch(
  match: Match,
  seed = 1,
  options: { maxPoints?: number; withStrokes?: boolean; now?: number } = {},
): Match {
  const { maxPoints = 500, withStrokes = true, now = Date.now() } = options;
  const rand = seededRandom(seed);
  let m = match;
  let t = now;
  let logged = 0;
  let id = 0;
  const nextId = () => `${match.id}-sim-${seed}-${id++}`;
  while (logged < maxPoints) {
    const r = replay(m);
    if (r.final.winner) break;
    const server = serverOf(r.final);
    t += 30_000;
    if (!m.pendingFault && rand() > 0.62) {
      m = recordFault(m, t);
      continue;
    }
    const serve = m.pendingFault ? 2 : 1;
    let input: PointInput;
    if (serve === 2 && rand() < 0.1) input = { ending: 'double_fault' };
    else if (rand() < (serve === 1 ? 0.06 : 0.01)) input = { ending: 'ace' };
    else if (rand() < (serve === 1 ? 0.1 : 0.05)) input = { ending: 'unreturned' };
    else input = rallyEnding(rand, server, serve, withStrokes);
    m = appendPoint(m, input, t, nextId());
    logged += 1;
  }
  return m;
}
