/**
 * Testing tools (Settings → Testing tools): exercise the scoring engine and stats directly, and
 * generate random sample matches to try the app with. Not part of normal use.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { FORMAT_PRESETS, FORMAT_PRESET_LABELS, type FormatPresetKey } from '../domain/format';
import { describePoint } from '../domain/labels';
import {
  appendPoint,
  canUndo,
  deletePoint,
  MatchLogError,
  recordFault,
  setStroke,
  undo,
  type PointInput,
} from '../domain/log';
import { createMatch, matchOutcome } from '../domain/match';
import { replay } from '../domain/replay';
import { pointScoreLabel, serverOf, setScoreLine } from '../domain/scoring';
import { simulateMatch } from '../domain/simulate';
import {
  chartedSetNumbers,
  computeStats,
  firstServeByServiceGame,
  pct,
  type Ratio,
  type SideStats,
} from '../domain/stats';
import type { BySide, Match, MatchFormat, Side, Stroke } from '../domain/types';
import { STROKES, isServeEnding } from '../domain/types';
import { db } from '../storage/db';
import { deleteMatch, getMatch, listMatches, requestPersistentStorage } from '../storage/repo';
import { commitMatch, forgetMatch } from './store';
import './debug.css';

const NAMES: BySide<string> = { player: 'Player', opponent: 'Opponent' };
const SHORT: BySide<string> = { player: 'P', opponent: 'O' };

function fmtRatio(r: Ratio): string {
  const p = pct(r);
  return p === null ? '—' : `${Math.round(p)}% (${r.num}/${r.den})`;
}

const fmtNum = (n: number) => String(n);

const STAT_ROWS: [string, (s: SideStats) => string][] = [
  ['Points won', (s) => fmtNum(s.pointsWon)],
  ['1st serve in', (s) => fmtRatio(s.serve.firstServeIn)],
  ['1st serve pts won', (s) => fmtRatio(s.serve.firstServePointsWon)],
  ['2nd serve pts won', (s) => fmtRatio(s.serve.secondServePointsWon)],
  ['Aces', (s) => fmtNum(s.serve.aces)],
  ['Unreturned serves', (s) => fmtNum(s.serve.unreturnedServes)],
  ['Double faults', (s) => fmtNum(s.serve.doubleFaults)],
  ['DFs on pressure pts', (s) => fmtNum(s.serve.doubleFaultsOnPressure)],
  ['Hold %', (s) => fmtRatio(s.serve.serviceGamesHeld)],
  ['Return in play', (s) => fmtRatio(s.return.returnInPlay)],
  ['Return pts won vs 1st', (s) => fmtRatio(s.return.pointsWonVsFirstServe)],
  ['Return pts won vs 2nd', (s) => fmtRatio(s.return.pointsWonVsSecondServe)],
  ['Break %', (s) => fmtRatio(s.return.returnGamesWon)],
  ['Winners', (s) => fmtNum(s.rally.winners)],
  ['Unforced errors', (s) => fmtNum(s.rally.unforcedErrors)],
  ['Forced errors', (s) => fmtNum(s.rally.forcedErrors)],
  ['Winners − UEs', (s) => fmtNum(s.rally.winnersMinusUnforcedErrors)],
  ['Break pts saved', (s) => fmtRatio(s.breakPoints.saved)],
  ['Break pts converted', (s) => fmtRatio(s.breakPoints.converted)],
  ['Pressure pts won', (s) => fmtRatio(s.pressure.pressurePointsWon)],
  ['Other pts won', (s) => fmtRatio(s.pressure.otherPointsWon)],
  ['Consolidation', (s) => fmtRatio(s.response.consolidation)],
  ['Break-back', (s) => fmtRatio(s.response.breakBack)],
];

function strokeRows(): [string, (s: SideStats) => string][] {
  return STROKES.flatMap((st): [string, (s: SideStats) => string][] => [
    [`Winners: ${st.replace('_', ' ')}`, (s) => fmtNum(s.strokes.winners[st])],
    [`UEs: ${st.replace('_', ' ')}`, (s) => fmtNum(s.strokes.unforcedErrors[st])],
  ]);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function NewMatchForm({ onCreate }: { onCreate: (format: MatchFormat, firstServer: Side, sample: boolean) => void }) {
  const [preset, setPreset] = useState<FormatPresetKey>('twoSetsMatchTiebreak');
  const [format, setFormat] = useState<MatchFormat>(FORMAT_PRESETS.twoSetsMatchTiebreak);
  const [firstServer, setFirstServer] = useState<Side>('player');
  const num = (key: keyof MatchFormat) => (
    <label>
      {key}
      <input
        type="number"
        inputMode="numeric"
        value={format[key] as number}
        onChange={(e) => setFormat({ ...format, [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <details className="card">
      <summary>New match</summary>
      <label>
        Format
        <select
          value={preset}
          onChange={(e) => {
            const key = e.target.value as FormatPresetKey;
            setPreset(key);
            setFormat({ ...FORMAT_PRESETS[key], noAd: format.noAd });
          }}
        >
          {(Object.keys(FORMAT_PRESETS) as FormatPresetKey[]).map((k) => (
            <option key={k} value={k}>
              {FORMAT_PRESET_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={format.noAd} onChange={(e) => setFormat({ ...format, noAd: e.target.checked })} />
        No-ad
      </label>
      <div className="grid2">
        {num('gamesPerSet')}
        {num('tiebreakAt')}
        {num('tiebreakPoints')}
        {num('matchTiebreakPoints')}
      </div>
      <label>
        First server
        <select value={firstServer} onChange={(e) => setFirstServer(e.target.value as Side)}>
          <option value="player">Player</option>
          <option value="opponent">Opponent</option>
        </select>
      </label>
      <div className="row">
        <button type="button" onClick={() => onCreate(format, firstServer, false)}>
          Start
        </button>
        <button type="button" onClick={() => onCreate(format, firstServer, true)}>
          Sample match
        </button>
      </div>
    </details>
  );
}

export function DebugApp() {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<number | undefined>(undefined);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const matches = useLiveQuery(() => listMatches(db), []);

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted);
  }, []);

  const commit = async (next: Match) => {
    setMatch(next);
    setError(null);
    await commitMatch(next);
  };

  const act = (fn: (m: Match) => Match) => {
    if (!match) return;
    try {
      void commit(fn(match));
    } catch (e) {
      setError(e instanceof MatchLogError ? e.message : String(e));
    }
  };

  const create = (format: MatchFormat, firstServer: Side, sample: boolean) => {
    try {
      let m = createMatch({
        date: today(),
        eventName: sample ? 'Sample match' : 'Debug match',
        eventType: 'practice',
        surface: 'hard',
        indoor: false,
        opponentName: 'Opponent',
        notes: '',
        format,
        firstServer,
      });
      if (sample) m = simulateMatch(m, Math.floor(Math.random() * 1e9));
      setScope(undefined);
      void commit(m);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const r = useMemo(() => (match ? replay(match) : null), [match]);
  const stats = useMemo(() => (r ? computeStats(r, scope === undefined ? {} : { setNumber: scope }) : null), [r, scope]);

  const log = (input: PointInput) => act((m) => appendPoint(m, input));
  const last = r?.points.at(-1);
  const server = r ? serverOf(r.final) : 'player';
  const outcome = match && r ? matchOutcome(match, r) : null;

  return (
    <div className="debug">
      <a href="#/settings">‹ Settings</a>
      <header>
        <h1>Testing tools</h1>
        <p className="muted">
          Engine debug screen · build {__APP_VERSION__} · storage {persisted === null ? '…' : persisted ? 'persistent' : 'best-effort'}
        </p>
      </header>

      <NewMatchForm onCreate={create} />

      <div className="card row">
        <select
          value={match?.id ?? ''}
          onChange={async (e) => {
            const m = await getMatch(db, e.target.value);
            if (m) {
              setScope(undefined);
              await commit(m);
            }
          }}
        >
          <option value="" disabled>
            Saved matches ({matches?.length ?? 0})
          </option>
          {matches?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.date} · {m.eventName} · {m.points.length} pts · {m.status}
            </option>
          ))}
        </select>
        {match && (
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (!confirm('Delete this match?')) return;
              await deleteMatch(db, match.id);
              forgetMatch(match.id);
              setMatch(null);
            }}
          >
            Delete
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {match && r && stats && (
        <>
          <div className="card score">
            {(['player', 'opponent'] as Side[]).map((side) => (
              <div key={side} className="score-row">
                <span className="serve-dot">{!r.final.winner && server === side ? '●' : ''}</span>
                <span className="name">{NAMES[side]}</span>
                {r.final.completedSets.map((set, i) => (
                  <span key={i} className="set">
                    {set.matchTiebreak ? set.tiebreak?.[side] : set.games[side]}
                  </span>
                ))}
                {!r.final.winner && !r.final.tiebreak?.kind.startsWith('match') && (
                  <span className="set current">{r.final.games[side]}</span>
                )}
              </div>
            ))}
            <p>
              {r.final.winner
                ? `${NAMES[r.final.winner]} won ${setScoreLine(r.final, r.final.winner)}`
                : `${r.final.tiebreak ? (r.final.tiebreak.kind === 'match' ? 'Match tiebreak' : 'Tiebreak') : 'Game'}: ${pointScoreLabel(r.final, 'player')}`}
              {match.pendingFault && <strong> · 2nd serve</strong>}
              {outcome && outcome.status !== 'in_progress' && ` · ${outcome.status}`}
            </p>
          </div>

          {!r.final.winner && (
            <div className="card">
              <p className="muted">{NAMES[server]} serving</p>
              <div className="grid3">
                {match.pendingFault ? (
                  <button type="button" className="big" onClick={() => log({ ending: 'double_fault' })}>
                    Double fault
                  </button>
                ) : (
                  <button type="button" className="big" onClick={() => act(recordFault)}>
                    Fault
                  </button>
                )}
                <button type="button" className="big" onClick={() => log({ ending: 'ace' })}>
                  Ace
                </button>
                <button type="button" className="big" onClick={() => log({ ending: 'unreturned' })}>
                  Unreturned
                </button>
              </div>
              <div className="grid2 rally">
                {(['player', 'opponent'] as Side[]).map((side) => (
                  <div key={side}>
                    <p className="col-head">{NAMES[side]}</p>
                    <button type="button" className="big" onClick={() => log({ ending: 'winner', endedBy: side })}>
                      Winner
                    </button>
                    <button type="button" className="big" onClick={() => log({ ending: 'unforced_error', endedBy: side })}>
                      Unforced error
                    </button>
                    <button type="button" className="big" onClick={() => log({ ending: 'forced_error', endedBy: side })}>
                      Forced error
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card row">
            <button type="button" className="big" disabled={!canUndo(match)} onClick={() => act((m) => undo(m))}>
              Undo
            </button>
          </div>

          {last && !isServeEnding(last.point.ending) && (
            <div className="card">
              <p className="muted">Stroke for last point (optional): {describePoint(last, NAMES)}</p>
              <div className="chips">
                {STROKES.filter((s) => s !== 'return' || last.point.endedBy === last.receiver).map((s: Stroke) => (
                  <button
                    key={s}
                    type="button"
                    className={last.point.stroke === s ? 'chip on' : 'chip'}
                    onClick={() => act((m) => setStroke(m, last.point.id, last.point.stroke === s ? undefined : s))}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="tabs">
              <button type="button" className={scope === undefined ? 'on' : ''} onClick={() => setScope(undefined)}>
                Match
              </button>
              {chartedSetNumbers(r).map((n) => (
                <button key={n} type="button" className={scope === n ? 'on' : ''} onClick={() => setScope(n)}>
                  Set {n}
                </button>
              ))}
            </div>
            <table>
              <thead>
                <tr>
                  <th>{stats.totalPoints} points</th>
                  <th>{SHORT.player}</th>
                  <th>{SHORT.opponent}</th>
                </tr>
              </thead>
              <tbody>
                {[...STAT_ROWS, ...(stats.strokesRecorded ? strokeRows() : [])].map(([label, get]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{get(stats.player)}</td>
                    <td>{get(stats.opponent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <p className="col-head">1st serve % by service game</p>
            <table>
              <tbody>
                {(['player', 'opponent'] as Side[]).map((side) => (
                  <tr key={side}>
                    <td>{SHORT[side]}</td>
                    <td>
                      {firstServeByServiceGame(r)[side]
                        .map((g) => `G${g.game.number}: ${Math.round(pct(g.firstServeIn) ?? 0)}%`)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <p className="col-head">Point log (newest first)</p>
            <ol className="log" reversed>
              {[...r.points].reverse().map((rp) => (
                <li key={rp.point.id}>
                  <span>
                    S{rp.setNumber} G{rp.gameNumber} · {SHORT[rp.server]} serving · {pointScoreLabel(rp.before, rp.server)} →{' '}
                    {describePoint(rp, NAMES)}
                    {rp.isBreakPoint ? ' · BP' : rp.isPressure ? ' · pressure' : ''}
                    {rp.endsGame ? ' · game' : ''}
                  </span>
                  <button type="button" className="small" onClick={() => act((m) => deletePoint(m, rp.point.id))}>
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
