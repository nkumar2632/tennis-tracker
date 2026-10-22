/** Every point in plain language, grouped by game. Tap a point to change it. */
import { Link } from 'wouter';
import { describePoint, gameHeading, scoreLine } from '../../domain/labels';
import type { Replay, ReplayedPoint } from '../../domain/replay';
import { pointScoreLabel } from '../../domain/scoring';
import type { BySide } from '../../domain/types';

/** Score after a point: server first in a game, the son first in a tiebreak; or who won the game. */
function scoreAfter(rp: ReplayedPoint, names: BySide<string>): string {
  if (rp.endsGame) return rp.gameKind === 'game' ? `Game ${names[rp.winner]}` : `${names[rp.winner]} wins it`;
  return rp.gameKind === 'game' ? pointScoreLabel(rp.after, rp.server) : pointScoreLabel(rp.after, 'player');
}

export function Timeline({
  r,
  names,
  editBase,
  newestFirst = false,
}: {
  r: Replay;
  names: BySide<string>;
  /** Where point links go, e.g. "/match/abc/timeline" → "/match/abc/timeline/<pointId>". */
  editBase: string;
  newestFirst?: boolean;
}) {
  if (r.points.length === 0) return <p className="muted">No points charted yet.</p>;
  const games = newestFirst ? [...r.games].reverse() : r.games;
  return (
    <div className="timeline">
      <p className="muted timeline-key">
        <span className="key-bar" /> point won by {names.player}. Score after each point, server first; games score{' '}
        {names.player} first.
      </p>
      {games.map((game) => {
        const indices = newestFirst ? [...game.pointIndices].reverse() : game.pointIndices;
        const last = r.points[game.pointIndices.at(-1)!]!;
        return (
          <section key={game.number} className="game-group">
            <h3 className="game-heading">
              {gameHeading(game, r, names)}
              {game.kind !== 'game' && <span className="muted"> ({names.player}&apos;s points first)</span>}
              {game.winner && (
                <span className="game-result">
                  {' '}
                  · won by {names[game.winner]} · {scoreLine(last.after, 'player')}
                </span>
              )}
            </h3>
            <ol className="point-list">
              {indices.map((i) => {
                const rp = r.points[i]!;
                return (
                  <li key={rp.point.id}>
                    <Link href={`${editBase}/${rp.point.id}`} className={`point-row won-${rp.winner}`}>
                      <span className="point-num">#{i + 1}</span>
                      <span className="point-desc">
                        {describePoint(rp, names)}
                        {rp.isBreakPoint && <span className="tag">BP</span>}
                      </span>
                      <span className="point-score">{scoreAfter(rp, names)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
