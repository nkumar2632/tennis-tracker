/** Per-match and per-set stats for both players. Only stats the entry screen collects. */
import { useState } from 'react';
import type { Replay } from '../../domain/replay';
import { NO_DATA, isRatio, percentText, statTables, strokeTable } from '../../domain/statRows';
import { chartedSetNumbers, computeStats, type Ratio } from '../../domain/stats';
import type { BySide } from '../../domain/types';
import { SIDES } from '../../domain/types';
import { ServeChart } from './ServeChart';

function Value({ v, signed }: { v: Ratio | number; signed?: boolean }) {
  if (!isRatio(v)) return <span className="stat-big">{signed && v > 0 ? `+${v}` : v}</span>;
  if (v.den === 0) return <span className="stat-big muted">{NO_DATA}</span>;
  return (
    <>
      <span className="stat-big">{percentText(v)}</span>
      <span className="stat-small">
        {v.num}/{v.den}
      </span>
    </>
  );
}

export function StatsView({ r, names }: { r: Replay; names: BySide<string> }) {
  const sets = chartedSetNumbers(r);
  const [scope, setScope] = useState<number | undefined>(undefined);
  if (r.points.length === 0) return <p className="muted">No points charted yet.</p>;
  const stats = computeStats(r, scope === undefined ? {} : { setNumber: scope });
  const tables = statTables(stats);
  const strokes = strokeTable(stats);
  const setLabel = (n: number) =>
    r.games.some((g) => g.setNumber === n && g.kind === 'match_tiebreak') ? 'Match tiebreak' : `Set ${n}`;

  return (
    <div className="stats">
      {sets.length > 1 && (
        <div className="segmented scope-tabs" role="tablist" aria-label="Stats for">
          {[undefined, ...sets].map((n) => (
            <button
              key={n ?? 'match'}
              type="button"
              role="tab"
              aria-selected={scope === n}
              className={scope === n ? 'seg on' : 'seg'}
              onClick={() => setScope(n)}
            >
              {n === undefined ? 'Match' : setLabel(n)}
            </button>
          ))}
        </div>
      )}

      <table className="stat-table">
        <thead>
          <tr>
            <th aria-label="Stat" />
            <th className="col-player">{names.player}</th>
            <th>{names.opponent}</th>
          </tr>
        </thead>
        {tables.map((table) => (
          <tbody key={table.title}>
            <tr className="stat-section">
              <th colSpan={3}>{table.title}</th>
            </tr>
            {table.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                {SIDES.map((side) => (
                  <td key={side} className="stat-value">
                    <Value v={row.values[side]} signed={row.id === 'winnersMinusUe'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      {strokes && (
        <table className="stat-table stroke-table">
          <caption>Winners and unforced errors by stroke</caption>
          <thead>
            <tr>
              <th aria-label="Stroke" />
              <th className="col-player">{names.player} W</th>
              <th className="col-player">{names.player} UE</th>
              <th>{names.opponent} W</th>
              <th>{names.opponent} UE</th>
            </tr>
          </thead>
          <tbody>
            {strokes.map((s) => (
              <tr key={s.stroke}>
                <th scope="row">{s.label}</th>
                <td>{s.winners.player}</td>
                <td>{s.unforcedErrors.player}</td>
                <td>{s.winners.opponent}</td>
                <td>{s.unforcedErrors.opponent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ServeChart r={r} names={names} {...(scope === undefined ? {} : { setNumber: scope })} />
    </div>
  );
}
