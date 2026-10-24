/**
 * Point entry: the screen used live from the stands. Most points are one tap; second-serve points two.
 * Layout is fixed (nothing moves between taps) and fits one iPhone screen without scrolling.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ENDING_LABELS, STROKE_LABELS, describePoint, resultLine, strokeChoices } from '../../domain/labels';
import {
  appendPoint,
  canUndo,
  endMatchEarly,
  recordFault,
  resumeMatch,
  setStroke,
  suspendMatch,
  undo,
  type PointInput,
} from '../../domain/log';
import { replay, type ReplayedPoint } from '../../domain/replay';
import { pointScoreLabel, serverOf, type ScoreState } from '../../domain/scoring';
import type { BySide, Ending, Side } from '../../domain/types';
import { SIDES } from '../../domain/types';
import { db } from '../../storage/db';
import { setSetting } from '../../storage/repo';
import { Sheet } from '../components';
import { namesFor, useMatchEditor, usePlayers } from '../hooks';

/** Taps closer together than this are treated as one accidental double tap. */
const TAP_GUARD_MS = 300;

const RALLY_BUTTONS: [Ending, string][] = [
  ['winner', 'Winner'],
  ['unforced_error', 'Unforced error'],
  ['forced_error', 'Forced error'],
];

function flash(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  if (typeof el.animate === 'function') {
    el.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 280 });
  }
}

export function Scoreboard({ state, names, server }: { state: ScoreState; names: BySide<string>; server: Side | null }) {
  const [playerPts, oppPts] = pointScoreLabel(state, 'player').split('-');
  const points: BySide<string> = { player: playerPts ?? '', opponent: oppPts ?? '' };
  const inMatchTiebreak = state.tiebreak?.kind === 'match';
  return (
    <div className="scoreboard" aria-label="Score">
      {SIDES.map((side) => (
        <div key={side} className={`sb-row sb-${side}`}>
          <span className="sb-serve" aria-label={server === side ? 'serving' : undefined}>
            {server === side ? '●' : ''}
          </span>
          <span className="sb-name">{names[side]}</span>
          {state.completedSets.map((set, i) => (
            <span key={i} className="sb-set">
              {set.matchTiebreak ? (set.winner === side ? 1 : 0) : set.games[side]}
              {set.tiebreak && <sup>{set.tiebreak[side]}</sup>}
            </span>
          ))}
          {!state.winner && !inMatchTiebreak && <span className="sb-set sb-current">{state.games[side]}</span>}
          {!state.winner && (
            <span className="sb-points" key={`${side}-${points[side]}`}>
              {points[side]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** What the last tap did, so it's obvious the point was logged (and which one to edit). */
function lastPointText(rp: ReplayedPoint, names: BySide<string>): string {
  let text = `✓ Point ${rp.index + 1} · ${describePoint(rp, names)}`;
  if (rp.endsMatch) text += ` · Match ${names[rp.winner]}`;
  else if (rp.endsSet) text += ` · Set ${names[rp.winner]}`;
  else if (rp.endsGame) text += ` · Game ${names[rp.winner]}`;
  return text;
}

export function ChartScreen({ id }: { id: string }) {
  const { match, error, setError, apply } = useMatchEditor(id);
  const players = usePlayers();
  const [, navigate] = useLocation();
  const [menu, setMenu] = useState<'none' | 'main' | 'end'>('none');
  const [toast, setToast] = useState<string | null>(null);
  const lastTap = useRef(-Infinity);

  useEffect(() => {
    void setSetting(db, 'activeMatchId', id);
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (match === undefined) return <div className="screen" />;
  if (match === null) {
    return (
      <div className="screen">
        <p>That match no longer exists.</p>
        <Link href="/">Home</Link>
      </div>
    );
  }

  const names = namesFor(players, match);
  const r = replay(match);
  const state = r.final;
  const over = state.winner !== null;
  const ended = match.status === 'retired' || match.status === 'stopped';
  const server = over || ended ? null : serverOf(state);
  const last = r.points.at(-1);
  const chips = last && !match.pendingFault && !over && !ended ? strokeChoices(last) : [];

  /** Ignore a second tap that lands too soon after the previous one. */
  const guarded = (e: MouseEvent<HTMLElement>, action: () => void) => {
    const now = performance.now();
    if (now - lastTap.current < TAP_GUARD_MS) return;
    lastTap.current = now;
    flash(e);
    action();
  };

  const log = (e: MouseEvent<HTMLElement>, input: PointInput) => guarded(e, () => apply((m) => appendPoint(m, input)));

  const doUndo = (e: MouseEvent<HTMLElement>) =>
    guarded(e, () => {
      if (match.pendingFault) {
        if (apply((m) => undo(m))) setToast('Undid the fault: back to 1st serve');
      } else if (last && apply((m) => undo(m))) {
        setToast(`Undid point ${last.index + 1} (${describePoint(last, names)})`);
      }
    });

  let status: string;
  if (over) status = resultLine(match, r, names);
  else if (ended) status = `${resultLine(match, r, names)}. Reopen the match to keep charting.`;
  else {
    const where = state.tiebreak ? (state.tiebreak.kind === 'match' ? ' · Match tiebreak' : ' · Tiebreak') : '';
    status = `${match.pendingFault ? '2nd serve' : '1st serve'} · ${names[server!]} serving${where}`;
  }

  return (
    <div className="chart">
      <header className="topbar">
        <div className="topbar-side">
          <Link href="/" className="topbar-back">
            ‹ Home
          </Link>
        </div>
        <h1 className="topbar-title">vs {names.opponent}</h1>
        <div className="topbar-side topbar-right">
          <button type="button" className="icon-btn" aria-label="Match menu" onClick={() => setMenu('main')}>
            •••
          </button>
        </div>
      </header>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <Scoreboard state={state} names={names} server={server} />

      <div className={match.pendingFault ? 'status status-second' : 'status'} role="status" aria-live="polite">
        {match.pendingFault ? <strong>2ND SERVE · {names[server!]} serving</strong> : status}
      </div>

      <button
        type="button"
        className="lastpoint"
        disabled={!last}
        onClick={() => last && navigate(`/match/${id}/points/${last.point.id}`)}
        aria-label={last ? `Last point: ${lastPointText(last, names)}. Tap to edit.` : undefined}
      >
        {last ? (
          <>
            <span key={last.point.id + (last.point.stroke ?? '')} className="lastpoint-text flash">
              {lastPointText(last, names)}
            </span>
            <span className="lastpoint-edit">Edit</span>
          </>
        ) : (
          <span className="lastpoint-text muted">Ready for the first point</span>
        )}
      </button>

      <div className="strokes" aria-label="Shot that ended the last point">
        {chips.length > 0 && last && (
          <>
            <p className="strokes-prompt">
              {names[last.endedBy]}&apos;s {ENDING_LABELS[last.point.ending]}: which shot?
            </p>
            <div className="strokes-grid">
              {chips.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={last.point.stroke === s ? 'chip on' : 'chip'}
                  aria-pressed={last.point.stroke === s}
                  onClick={() => apply((m) => setStroke(m, last.point.id, last.point.stroke === s ? undefined : s))}
                >
                  {STROKE_LABELS[s][0]!.toUpperCase() + STROKE_LABELS[s].slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="error-box" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {over || ended ? (
        <div className="finished">
          <p className="finished-result">{resultLine(match, r, names)}</p>
          {ended && (
            <button type="button" className="btn btn-primary" onClick={() => apply((m) => resumeMatch(m))}>
              Reopen and keep charting
            </button>
          )}
          <button type="button" className="btn" onClick={() => navigate(`/match/${id}`)}>
            Done
          </button>
        </div>
      ) : (
        <div className="entry">
          <div className="serve-row">
            <button type="button" className="entry-btn serve" onClick={(e) => log(e, { ending: 'ace' })}>
              Ace
            </button>
            <button type="button" className="entry-btn serve" onClick={(e) => log(e, { ending: 'unreturned' })}>
              Unreturned
            </button>
            {match.pendingFault ? (
              <button type="button" className="entry-btn double-fault" onClick={(e) => log(e, { ending: 'double_fault' })}>
                Double fault
              </button>
            ) : (
              <button type="button" className="entry-btn fault" onClick={(e) => guarded(e, () => apply((m) => recordFault(m)))}>
                Fault
              </button>
            )}
          </div>
          <div className="rally">
            {SIDES.map((side) => (
              <div key={side} className={`rally-col rally-${side}`}>
                <div className="rally-head">{names[side]}</div>
                {RALLY_BUTTONS.map(([ending, label]) => (
                  <button
                    key={ending}
                    type="button"
                    className="entry-btn"
                    aria-label={`${names[side]} ${label.toLowerCase()}`}
                    onClick={(e) => log(e, { ending, endedBy: side })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bottombar">
        <button type="button" className="btn btn-undo" disabled={!canUndo(match)} onClick={doUndo}>
          ↶ Undo
        </button>
        <Link href={`/match/${id}/points`} className="btn">
          Points
        </Link>
      </div>

      {menu === 'main' && (
        <Sheet title={`vs ${names.opponent}`} onClose={() => setMenu('none')}>
          <Link href={`/match/${id}/points`} className="btn">
            Points (edit any point)
          </Link>
          <Link href={`/match/${id}/edit`} className="btn">
            Match details
          </Link>
          {!over && !ended && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (apply((m) => suspendMatch(m))) navigate('/');
                }}
              >
                Suspend: finish another day
              </button>
              <button type="button" className="btn" onClick={() => setMenu('end')}>
                End match early…
              </button>
            </>
          )}
        </Sheet>
      )}

      {menu === 'end' && (
        <Sheet title="End match early" onClose={() => setMenu('none')}>
          {(['opponent', 'player'] as Side[]).map((side) => (
            <button
              key={side}
              type="button"
              className="btn"
              onClick={() => {
                if (apply((m) => endMatchEarly(m, { kind: 'retired', retiredSide: side }))) navigate(`/match/${id}`);
              }}
            >
              {names[side]} retired
            </button>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (apply((m) => endMatchEarly(m, { kind: 'stopped' }))) navigate(`/match/${id}`);
            }}
          >
            Stopped: no result (e.g. dual match decided)
          </button>
        </Sheet>
      )}
    </div>
  );
}

