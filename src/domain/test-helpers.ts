/**
 * Test-only helpers. `play(match, script)` logs points from a compact script:
 *
 *   p / o        player / opponent hits a winner (first serve)
 *   A  S         ace / unreturned serve by the current server
 *   D            double fault by the current server (fault + double fault)
 *   F            first-serve fault only (point still in progress)
 *   pW pU pF     player winner / unforced error / forced error (oW oU oF for the opponent)
 *   2<token>     same, on the second serve (a fault is logged first), e.g. 2pW, 2A
 *   <token>:fh   with a stroke: fh bh vo oh ds rt
 *   gp / go      player / opponent wins a game with four straight winners
 *   <token>*n    repeat n times, e.g. gp*6
 */
import { createMatch, type MatchSetup } from './match';
import { appendPoint, recordFault, type PointInput } from './log';
import { FORMAT_PRESETS } from './format';
import type { Match, MatchFormat, Side, Stroke } from './types';

const STROKE_CODES: Record<string, Stroke> = {
  fh: 'forehand',
  bh: 'backhand',
  vo: 'volley',
  oh: 'overhead',
  ds: 'drop_shot',
  rt: 'return',
};

export function newMatch(format: MatchFormat = FORMAT_PRESETS.bestOf3, overrides: Partial<MatchSetup> = {}): Match {
  return createMatch(
    {
      date: '2026-10-01',
      eventName: 'Test Open',
      eventType: 'usta',
      surface: 'hard',
      indoor: false,
      opponentName: 'Opponent',
      notes: '',
      format,
      firstServer: 'player',
      ...overrides,
    },
    0,
    'match-1',
  );
}

let clock = 1_000;
let ids = 0;

function rallyInput(code: string): PointInput {
  const side: Side = code[0] === 'p' ? 'player' : 'opponent';
  const kind = code.slice(1);
  if (kind === '') return { ending: 'winner', endedBy: side };
  const ending = ({ W: 'winner', U: 'unforced_error', F: 'forced_error' } as const)[kind];
  if (!ending) throw new Error(`Unknown token: ${code}`);
  return { ending, endedBy: side };
}

function applyToken(match: Match, token: string): Match {
  const [rawBody, strokeCode] = token.split(':');
  let body = rawBody ?? '';
  let m = match;
  const next = () => (clock += 1000);

  if (body === 'gp' || body === 'go') {
    for (let i = 0; i < 4; i++) m = applyToken(m, body[1]!);
    return m;
  }
  const second = body.startsWith('2');
  if (second) {
    body = body.slice(1);
    m = recordFault(m, next());
  }
  let input: PointInput;
  if (body === 'F') {
    if (second) throw new Error('2F is not a token; use D for a double fault.');
    return recordFault(m, next());
  } else if (body === 'A') input = { ending: 'ace' };
  else if (body === 'S') input = { ending: 'unreturned' };
  else if (body === 'D') {
    if (!second) m = recordFault(m, next());
    input = { ending: 'double_fault' };
  } else input = rallyInput(body);

  if (strokeCode) {
    const stroke = STROKE_CODES[strokeCode];
    if (!stroke) throw new Error(`Unknown stroke: ${strokeCode}`);
    input.stroke = stroke;
  }
  return appendPoint(m, input, next(), `pt-${++ids}`);
}

export function play(match: Match, script: string): Match {
  let m = match;
  for (const raw of script.trim().split(/\s+/).filter(Boolean)) {
    const [token, times] = raw.split('*');
    const n = times ? Number(times) : 1;
    for (let i = 0; i < n; i++) m = applyToken(m, token!);
  }
  return m;
}
