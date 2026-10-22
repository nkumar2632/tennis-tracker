/** First serve % in each service game, for both players (like the old app's chart). */
import type { Replay } from '../../domain/replay';
import { firstServeByServiceGame, pct } from '../../domain/stats';
import type { BySide, Side } from '../../domain/types';
import { SIDES } from '../../domain/types';

const W = 340;
const H = 170;
const PAD = { left: 34, right: 10, top: 10, bottom: 26 };

export function ServeChart({ r, names, setNumber }: { r: Replay; names: BySide<string>; setNumber?: number }) {
  const byGame = firstServeByServiceGame(r);
  const series: BySide<number[]> = { player: [], opponent: [] };
  for (const side of SIDES) {
    series[side] = byGame[side]
      .filter((g) => setNumber === undefined || g.game.setNumber === setNumber)
      .map((g) => pct(g.firstServeIn))
      .filter((p): p is number => p !== null);
  }
  const count = Math.max(series.player.length, series.opponent.length);
  if (count === 0) return null;

  const x = (i: number) => PAD.left + (count === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (count - 1));
  const y = (p: number) => PAD.top + ((100 - p) * (H - PAD.top - PAD.bottom)) / 100;
  const labelEvery = count > 12 ? 2 : 1;
  const summary = SIDES.map((s) => `${names[s]}: ${series[s].map((p) => `${Math.round(p)}%`).join(', ')}`).join('. ');

  return (
    <figure className="serve-chart">
      <figcaption>1st serve % by service game</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`1st serve % by service game. ${summary}`}>
        {[0, 50, 100].map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(p)} y2={y(p)} className="grid" />
            <text x={PAD.left - 6} y={y(p) + 4} textAnchor="end" className="axis">
              {p}%
            </text>
          </g>
        ))}
        {Array.from({ length: count }, (_, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="axis">
              {i + 1}
            </text>
          ) : null,
        )}
        {SIDES.map((side: Side) => (
          <g key={side} className={`series series-${side}`}>
            <polyline points={series[side].map((p, i) => `${x(i)},${y(p)}`).join(' ')} />
            {series[side].map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p)} r={3.5} />
            ))}
          </g>
        ))}
      </svg>
      <div className="legend">
        {SIDES.map((side) => (
          <span key={side} className={`legend-item series-${side}`}>
            <span className="swatch" /> {names[side]}
          </span>
        ))}
        <span className="muted">· across: each player's 1st, 2nd, 3rd… service game</span>
      </div>
    </figure>
  );
}
