/** One small line chart per key stat: his value in each finished match, oldest to newest. */
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { TRENDS, trendAverage, trendSeries, type TrendDef, type TrendPoint } from '../../domain/seasonView';
import type { Match } from '../../domain/types';
import { shortDate } from '../dates';

const W = 340;
const H = 150;
const PAD = { left: 38, right: 12, top: 12, bottom: 24 };

function valueText(def: TrendDef, v: number, decimals = 0): string {
  if (def.kind === 'percent') return `${Math.round(v)}%`;
  const n = Number(v.toFixed(decimals));
  if (n < 0) return `−${-n}`;
  return def.id === 'winnersMinusUe' && n > 0 ? `+${n}` : String(n);
}

/** Round axis bounds and 2-4 evenly spaced ticks; counts step in whole numbers. */
function scale(def: TrendDef, values: number[]): { lo: number; hi: number; ticks: number[] } {
  if (def.kind === 'percent') return { lo: 0, hi: 100, ticks: [0, 50, 100] };
  const lo0 = Math.min(0, ...values);
  const hi0 = Math.max(1, ...values);
  const raw = (hi0 - lo0) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw)!);
  const lo = Math.floor(lo0 / step) * step;
  const hi = Math.ceil(hi0 / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

/** "Mar 2", or "Mar 2025" when the chart spans more than one year. */
function axisDate(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, withYear ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' });
}

function TrendChart({ def, series, average }: { def: TrendDef; series: TrendPoint[]; average: number | null }) {
  // The latest match until another is tapped (or when filters drop the tapped one).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const n = series.length;
  const sel = series.find((p) => p.matchId === pickedId) ?? series[n - 1];
  const { lo, hi, ticks } = scale(def, [...series.map((p) => p.value), ...(average === null ? [] : [average])]);
  const plotW = W - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => PAD.top + ((hi - v) * (H - PAD.top - PAD.bottom)) / (hi - lo);
  const slot = n === 1 ? plotW : plotW / (n - 1);
  const summary = series.map((p) => `${shortDate(p.date)} ${valueText(def, p.value)}`).join(', ');
  const withYear = n > 0 && series[0]!.date.slice(0, 4) !== series[n - 1]!.date.slice(0, 4);

  return (
    <figure className="trend">
      <figcaption>
        <span className="trend-title">{def.label}</span>
        {def.lowerIsBetter && <span className="muted"> · lower is better</span>}
      </figcaption>
      {n === 0 ? (
        <p className="muted">Nothing to show in these matches.</p>
      ) : (
        <>
          <p className="trend-summary">
            {average !== null && (
              <>
                <span className="avg-key" aria-hidden="true" /> Average {valueText(def, average, 1)}
                {' · '}
              </>
            )}
            {n} {n === 1 ? 'match' : 'matches'}
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${def.label}, oldest to newest: ${summary}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 && lo < 0 ? 'grid zero' : 'grid'} />
                <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="axis">
                  {valueText(def, t)}
                </text>
              </g>
            ))}
            <text x={x(0)} y={H - 6} textAnchor={n === 1 ? 'middle' : 'start'} className="axis">
              {axisDate(series[0]!.date, withYear)}
            </text>
            {n > 1 && (
              <text x={x(n - 1)} y={H - 6} textAnchor="end" className="axis">
                {axisDate(series[n - 1]!.date, withYear)}
              </text>
            )}
            {average !== null && <line x1={PAD.left} x2={W - PAD.right} y1={y(average)} y2={y(average)} className="avg-line" />}
            <polyline points={series.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} className="trend-line" />
            {series.map((p, i) => (
              <circle key={p.matchId} cx={x(i)} cy={y(p.value)} r={p === sel ? 6 : 4} className={p === sel ? 'dot on' : 'dot'} />
            ))}
            {/* Tap anywhere in a match's column to pick it. */}
            {series.map((p, i) => (
              <rect
                key={p.matchId}
                x={x(i) - slot / 2}
                y={0}
                width={slot}
                height={H}
                className="hit"
                onClick={() => setPickedId(p.matchId)}
              />
            ))}
          </svg>
          {sel && (
            <p className="trend-pick">
              {shortDate(sel.date)} · vs {sel.opponent.trim() || 'Opponent'}:{' '}
              <strong>{valueText(def, sel.value)}</strong>
              {sel.detail && <span className="muted"> ({sel.detail})</span>}{' '}
              <Link href={`/match/${sel.matchId}`}>Open&nbsp;match&nbsp;›</Link>
            </p>
          )}
        </>
      )}
    </figure>
  );
}

export function TrendsView({ matches }: { matches: readonly Match[] }) {
  const charts = useMemo(
    () => TRENDS.map((def) => ({ def, series: trendSeries(matches, def), average: trendAverage(matches, def) })),
    [matches],
  );
  return (
    <div className="trends">
      <p className="muted">
        Each dot is a finished match, oldest on the left. Tap a dot to see the match.
      </p>
      {charts.map(({ def, series, average }) => (
        <TrendChart key={def.id} def={def} series={series} average={average} />
      ))}
    </div>
  );
}
