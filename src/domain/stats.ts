/**
 * Every stat is derived from the replayed point log; nothing here needs extra data entry.
 * Definitions live next to each field and are pinned down by stats.test.ts.
 */
import type { GameSummary, Replay, ReplayedPoint } from './replay';
import type { BySide, Stroke } from './types';
import { SIDES, STROKES, otherSide } from './types';

/** A fraction such as "24 of 38". Percentages are computed for display; den 0 means "no data". */
export interface Ratio {
  num: number;
  den: number;
}

export function pct(r: Ratio): number | null {
  return r.den === 0 ? null : (r.num / r.den) * 100;
}

export interface SideStats {
  pointsWon: number;
  serve: {
    /** First serves in / points served. */
    firstServeIn: Ratio;
    /** Points won / points where the first serve went in. */
    firstServePointsWon: Ratio;
    /** Points won / points played on the second serve (double faults count as lost). */
    secondServePointsWon: Ratio;
    aces: number;
    unreturnedServes: number;
    doubleFaults: number;
    doubleFaultsOnPressure: number;
    /** Regular service games won / finished regular service games (tiebreaks excluded). */
    serviceGamesHeld: Ratio;
  };
  return: {
    /**
     * Returns in play / serves in (the opponent's points that weren't double faults).
     * Not in play: aces, unreturned serves, and this player's errors tagged with the Return stroke.
     */
    returnInPlay: Ratio;
    /** Return points won / points where the opponent's first serve went in. */
    pointsWonVsFirstServe: Ratio;
    /** Return points won / points on the opponent's second serve (their double faults count as won). */
    pointsWonVsSecondServe: Ratio;
    /** Break %: regular return games won / finished regular return games. */
    returnGamesWon: Ratio;
  };
  rally: {
    winners: number;
    unforcedErrors: number;
    forcedErrors: number;
    winnersMinusUnforcedErrors: number;
  };
  breakPoints: {
    /** Break points saved / faced while serving. */
    saved: Ratio;
    /** Break points won / break point chances while returning. */
    converted: Ratio;
  };
  pressure: {
    /** Points won / pressure points played (break points, 30-30, deuce/ad, every tiebreak point). */
    pressurePointsWon: Ratio;
    /** Points won / all other points. */
    otherPointsWon: Ratio;
  };
  response: {
    /** Held serve in the very next game after breaking / such chances. */
    consolidation: Ratio;
    /** Broke back in the very next game after being broken / such chances. */
    breakBack: Ratio;
  };
  strokes: {
    winners: Record<Stroke, number>;
    unforcedErrors: Record<Stroke, number>;
  };
}

export interface MatchStats {
  totalPoints: number;
  /** True when at least one point in scope has a stroke recorded; hide stroke tables otherwise. */
  strokesRecorded: boolean;
  player: SideStats;
  opponent: SideStats;
}

/** Whole match when setNumber is undefined; otherwise one set (1-based, as numbered in the match). */
export interface StatsScope {
  setNumber?: number;
}

const ratio = (): Ratio => ({ num: 0, den: 0 });
const strokeCounts = (): Record<Stroke, number> =>
  Object.fromEntries(STROKES.map((s) => [s, 0])) as Record<Stroke, number>;

function emptySideStats(): SideStats {
  return {
    pointsWon: 0,
    serve: {
      firstServeIn: ratio(),
      firstServePointsWon: ratio(),
      secondServePointsWon: ratio(),
      aces: 0,
      unreturnedServes: 0,
      doubleFaults: 0,
      doubleFaultsOnPressure: 0,
      serviceGamesHeld: ratio(),
    },
    return: {
      returnInPlay: ratio(),
      pointsWonVsFirstServe: ratio(),
      pointsWonVsSecondServe: ratio(),
      returnGamesWon: ratio(),
    },
    rally: { winners: 0, unforcedErrors: 0, forcedErrors: 0, winnersMinusUnforcedErrors: 0 },
    breakPoints: { saved: ratio(), converted: ratio() },
    pressure: { pressurePointsWon: ratio(), otherPointsWon: ratio() },
    response: { consolidation: ratio(), breakBack: ratio() },
    strokes: { winners: strokeCounts(), unforcedErrors: strokeCounts() },
  };
}

function add(r: Ratio, won: boolean): void {
  r.den += 1;
  if (won) r.num += 1;
}

function inScope(scope: StatsScope, setNumber: number): boolean {
  return scope.setNumber === undefined || scope.setNumber === setNumber;
}

function isReturnInPlay(rp: ReplayedPoint): boolean {
  const { ending, stroke } = rp.point;
  const { endedBy } = rp;
  if (ending === 'ace' || ending === 'unreturned') return false;
  const returnerMissedReturn =
    (ending === 'forced_error' || ending === 'unforced_error') && endedBy === rp.receiver && stroke === 'return';
  return !returnerMissedReturn;
}

function addPoint(stats: BySide<SideStats>, rp: ReplayedPoint): void {
  const { point, server, receiver, endedBy, winner } = rp;
  const sv = stats[server];
  const rt = stats[receiver];

  stats[winner].pointsWon += 1;

  // Serve and return
  add(sv.serve.firstServeIn, point.serve === 1);
  if (point.serve === 1) {
    add(sv.serve.firstServePointsWon, winner === server);
    add(rt.return.pointsWonVsFirstServe, winner === receiver);
  } else {
    add(sv.serve.secondServePointsWon, winner === server);
    add(rt.return.pointsWonVsSecondServe, winner === receiver);
  }
  if (point.ending === 'double_fault') {
    sv.serve.doubleFaults += 1;
    if (rp.isPressure) sv.serve.doubleFaultsOnPressure += 1;
  } else {
    add(rt.return.returnInPlay, isReturnInPlay(rp));
  }
  if (point.ending === 'ace') sv.serve.aces += 1;
  if (point.ending === 'unreturned') sv.serve.unreturnedServes += 1;

  // Rally endings
  const by = stats[endedBy];
  if (point.ending === 'winner') {
    by.rally.winners += 1;
    if (point.stroke) by.strokes.winners[point.stroke] += 1;
  } else if (point.ending === 'unforced_error') {
    by.rally.unforcedErrors += 1;
    if (point.stroke) by.strokes.unforcedErrors[point.stroke] += 1;
  } else if (point.ending === 'forced_error') {
    by.rally.forcedErrors += 1;
  }

  // Break points and pressure
  if (rp.isBreakPoint) {
    add(sv.breakPoints.saved, winner === server);
    add(rt.breakPoints.converted, winner === receiver);
  }
  for (const side of SIDES) {
    add(rp.isPressure ? stats[side].pressure.pressurePointsWon : stats[side].pressure.otherPointsWon, winner === side);
  }
}

function addGames(stats: BySide<SideStats>, games: GameSummary[], scope: StatsScope): void {
  games.forEach((game, i) => {
    if (game.kind !== 'game' || !game.winner || !inScope(scope, game.setNumber)) return;
    const server = game.server;
    const receiver = otherSide(server);
    add(stats[server].serve.serviceGamesHeld, game.winner === server);
    add(stats[receiver].return.returnGamesWon, game.winner === receiver);

    // Response after a break: only when the very next game is a finished regular game.
    const next = games[i + 1];
    const broken = game.winner === receiver;
    if (!broken || !next || next.kind !== 'game' || !next.winner) return;
    add(stats[receiver].response.consolidation, next.winner === receiver);
    add(stats[server].response.breakBack, next.winner === server);
  });
}

export function computeStats(r: Replay, scope: StatsScope = {}): MatchStats {
  const stats: BySide<SideStats> = { player: emptySideStats(), opponent: emptySideStats() };
  let totalPoints = 0;
  let strokesRecorded = false;
  for (const rp of r.points) {
    if (!inScope(scope, rp.setNumber)) continue;
    totalPoints += 1;
    if (rp.point.stroke) strokesRecorded = true;
    addPoint(stats, rp);
  }
  addGames(stats, r.games, scope);
  for (const side of SIDES) {
    const rally = stats[side].rally;
    rally.winnersMinusUnforcedErrors = rally.winners - rally.unforcedErrors;
  }
  return { totalPoints, strokesRecorded, ...stats };
}

/** Set numbers that have at least one charted point, for the per-set tabs. */
export function chartedSetNumbers(r: Replay): number[] {
  return [...new Set(r.points.map((p) => p.setNumber))];
}

export interface ServiceGameFirstServe {
  game: GameSummary;
  firstServeIn: Ratio;
}

/** First serve % in each regular service game, per server (for the per-game chart). */
export function firstServeByServiceGame(r: Replay): BySide<ServiceGameFirstServe[]> {
  const result: BySide<ServiceGameFirstServe[]> = { player: [], opponent: [] };
  for (const game of r.games) {
    if (game.kind !== 'game') continue;
    const firstServeIn = ratio();
    for (const index of game.pointIndices) add(firstServeIn, r.points[index]!.point.serve === 1);
    result[game.server].push({ game, firstServeIn });
  }
  return result;
}

function isRatio(value: unknown): value is Ratio {
  return typeof value === 'object' && value !== null && 'num' in value && 'den' in value;
}

/** Ratios are pooled (summed); counts become per-match averages; flags are OR-ed. */
function combine(values: unknown[]): unknown {
  const first = values[0];
  if (typeof first === 'number') return values.reduce<number>((sum, v) => sum + (v as number), 0) / values.length;
  if (typeof first === 'boolean') return values.some(Boolean);
  if (isRatio(first)) {
    return values.reduce<Ratio>((acc, v) => ({ num: acc.num + (v as Ratio).num, den: acc.den + (v as Ratio).den }), ratio());
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(first as object)) {
    out[key] = combine(values.map((v) => (v as Record<string, unknown>)[key]));
  }
  return out;
}

export interface AggregateStats extends MatchStats {
  matches: number;
}

/**
 * Season averages across matches. Percentages are pooled over every point (not an average of each
 * match's percentage); counts such as double faults are averages per match.
 */
export function aggregateStats(all: MatchStats[]): AggregateStats | null {
  if (all.length === 0) return null;
  return { ...(combine(all) as MatchStats), matches: all.length };
}
