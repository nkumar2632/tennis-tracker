/** Every logged point, newest first and grouped by game; tap one to change, delete or insert before it. */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ENDING_LABELS, STROKE_LABELS, gameHeading, strokeChoices } from '../../domain/labels';
import { deletePoint, editPoint, insertPoint, type PointEdit } from '../../domain/log';
import { isResumable } from '../../domain/match';
import { replay } from '../../domain/replay';
import { pointScoreLabel } from '../../domain/scoring';
import type { Ending, Side } from '../../domain/types';
import { SIDES, isServeEnding, otherSide } from '../../domain/types';
import { ErrorBox, TopBar } from '../components';
import { namesFor, useMatchEditor, usePlayers } from '../hooks';
import { Timeline } from '../match/Timeline';

export function PointsScreen({ id }: { id: string }) {
  const { match } = useMatchEditor(id);
  const players = usePlayers();
  if (!match) return <div className="screen">{match === null && <p>That match no longer exists.</p>}</div>;
  const names = namesFor(players, match);
  const r = replay(match);
  return (
    <div className="screen">
      <TopBar
        back={isResumable(match) ? `/match/${id}/chart` : `/match/${id}`}
        backLabel={isResumable(match) ? 'Chart' : 'Match'}
        title={`Points (${r.points.length})`}
      />
      <p className="muted">Newest first. Tap a point to change it, delete it, or insert a missed point before it.</p>
      <Timeline r={r} names={names} editBase={`/match/${id}/points`} newestFirst />
    </div>
  );
}

const SERVE_OPTIONS: [Ending, string][] = [
  ['ace', 'Ace'],
  ['unreturned', 'Unreturned'],
  ['double_fault', 'Double fault'],
];
const RALLY_OPTIONS: [Ending, string][] = [
  ['winner', 'Winner'],
  ['unforced_error', 'Unforced error'],
  ['forced_error', 'Forced error'],
];

/**
 * Change one point (`pointId`), or insert a missed point before `beforeId`. `list` is where it was
 * opened from (the live Points list or the match Timeline), which Save and Back return to.
 */
export function PointEditorScreen({
  id,
  pointId,
  beforeId,
  list,
}: {
  id: string;
  pointId?: string;
  beforeId?: string;
  list: 'points' | 'timeline';
}) {
  const { match, apply, error } = useMatchEditor(id);
  const players = usePlayers();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<PointEdit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!match) return <div className="screen">{match === null && <p>That match no longer exists.</p>}</div>;
  const names = namesFor(players, match);
  const r = replay(match);
  const targetId = pointId ?? beforeId;
  const index = match.points.findIndex((p) => p.id === targetId);
  const rp = r.points[index];
  if (!rp) {
    return (
      <div className="screen">
        <TopBar back={`/match/${id}/${list}`} title="Point" />
        <p>That point no longer exists.</p>
      </div>
    );
  }
  const inserting = beforeId !== undefined;
  // An inserted point takes this point's place, so it has the same server and score before it.
  const server: Side = rp.server;
  const d: PointEdit = draft ?? (inserting
    ? { serve: 1, ending: 'winner', endedBy: 'player' }
    : { serve: rp.point.serve, ending: rp.point.ending, endedBy: rp.endedBy, ...(rp.point.stroke ? { stroke: rp.point.stroke } : {}) });
  const choicesFor = (e: PointEdit) =>
    strokeChoices({ point: { ...rp.point, ending: e.ending }, endedBy: e.endedBy ?? server, receiver: otherSide(server) });
  const update = (patch: Partial<PointEdit>) => {
    const next: PointEdit = { ...d, ...patch };
    // A different player means a different shot: don't carry the old stroke over.
    if (patch.endedBy !== undefined && patch.endedBy !== d.endedBy) delete next.stroke;
    if (next.ending === 'double_fault') next.serve = 2;
    if (isServeEnding(next.ending)) next.endedBy = server;
    // Drop a stroke that no longer fits (e.g. Return after switching to the server's error).
    if (next.stroke && !choicesFor(next).includes(next.stroke)) delete next.stroke;
    setDraft(next);
  };
  const choices = choicesFor(d);
  const done = () => navigate(`/match/${id}/${list}`);

  const save = () => {
    const ok = inserting ? apply((m) => insertPoint(m, beforeId!, d)) : apply((m) => editPoint(m, pointId!, d));
    if (ok) done();
  };

  return (
    <div className="screen">
      <TopBar
        back={`/match/${id}/${list}`}
        backLabel={list === 'points' ? 'Points' : 'Timeline'}
        title={inserting ? 'Insert missed point' : `Point ${index + 1}`}
      />
      <p className="muted">
        {gameHeading(r.games[rp.gameNumber - 1]!, r, names)} · score before: {pointScoreLabel(rp.before, server)}
        {inserting && ` · goes before point ${index + 1}`}
      </p>

      <div className="field">
        <span className="field-label">Serve</span>
        <div className="segmented" role="radiogroup" aria-label="Serve">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={d.serve === n}
              className={d.serve === n ? 'seg on' : 'seg'}
              disabled={n === 1 && d.ending === 'double_fault'}
              onClick={() => update({ serve: n })}
            >
              {n === 1 ? '1st serve' : '2nd serve'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">{names[server]}&apos;s serve</span>
        <div className="segmented">
          {SERVE_OPTIONS.map(([ending, label]) => (
            <button key={ending} type="button" aria-pressed={d.ending === ending} className={d.ending === ending ? 'seg on' : 'seg'} onClick={() => update({ ending })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Or the rally ended with</span>
        <div className="editor-rally">
          {SIDES.map((side) => (
            <div key={side} className="editor-rally-col">
              <span className="rally-head">{names[side]}</span>
              {RALLY_OPTIONS.map(([ending, label]) => {
                const on = d.ending === ending && d.endedBy === side;
                return (
                  <button
                    key={ending}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${names[side]} ${label.toLowerCase()}`}
                    className={on ? 'seg on' : 'seg'}
                    onClick={() => update({ ending, endedBy: side })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {choices.length > 0 && (
        <div className="field">
          <span className="field-label">
            {names[d.endedBy ?? server]}&apos;s {ENDING_LABELS[d.ending]}: which shot? (optional)
          </span>
          <div className="strokes-grid">
            {choices.map((s) => (
              <button key={s} type="button" aria-pressed={d.stroke === s} className={d.stroke === s ? 'chip on' : 'chip'} onClick={() => update({ stroke: d.stroke === s ? undefined : s })}>
                {STROKE_LABELS[s][0]!.toUpperCase() + STROKE_LABELS[s].slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ErrorBox message={error} />
      <div className="stack">
        <button type="button" className="btn btn-primary" onClick={save}>
          {inserting ? 'Insert point' : 'Save'}
        </button>
        {!inserting && (
          <>
            <Link href={`/match/${id}/${list}/insert/${rp.point.id}`} className="btn">
              Insert a missed point before this one
            </Link>
            {confirmDelete ? (
              <button type="button" className="btn btn-danger" onClick={() => apply((m) => deletePoint(m, pointId!)) && done()}>
                Tap again to delete point {index + 1}
              </button>
            ) : (
              <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
                Delete this point
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
