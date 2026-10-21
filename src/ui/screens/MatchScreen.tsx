/** One match at a glance. Stats, timeline and reports are added here in Phase 3. */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { EVENT_TYPE_LABELS, SURFACE_LABELS, formatSummary, resultLine } from '../../domain/labels';
import { resumeMatch } from '../../domain/log';
import { isResumable } from '../../domain/match';
import { replay } from '../../domain/replay';
import { db } from '../../storage/db';
import { deleteMatch, getSetting, setSetting } from '../../storage/repo';
import { ErrorBox, TopBar } from '../components';
import { namesFor, useMatchEditor, useSettings } from '../hooks';
import { forgetMatch, whenSaved } from '../store';
import { shortDate } from './Home';

export function MatchScreen({ id }: { id: string }) {
  const { match, apply, error } = useMatchEditor(id);
  const settings = useSettings();
  const [, navigate] = useLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (match === undefined) return <div className="screen" />;
  if (match === null) {
    return (
      <div className="screen">
        <TopBar back="/" backLabel="Home" title="Match" />
        <p>That match no longer exists.</p>
      </div>
    );
  }
  const names = namesFor(settings, match);
  const r = replay(match);
  const finished = r.final.winner !== null;
  const details = [
    shortDate(match.date),
    [match.eventName, EVENT_TYPE_LABELS[match.eventType], match.round].filter(Boolean).join(' · '),
    `${SURFACE_LABELS[match.surface]} · ${match.indoor ? 'Indoor' : 'Outdoor'}`,
    formatSummary(match.format),
    [
      match.opponentUtr !== undefined ? `${names.opponent}: UTR ${match.opponentUtr}` : '',
      match.opponentHand ? (match.opponentHand === 'left' ? 'left-handed' : 'right-handed') : '',
    ].filter(Boolean).join(', '),
    match.playerUtr !== undefined ? `${names.player}: UTR ${match.playerUtr}` : '',
  ].filter(Boolean);

  const remove = async () => {
    await whenSaved();
    await deleteMatch(db, id);
    forgetMatch(id);
    if ((await getSetting(db, 'activeMatchId')) === id) await setSetting(db, 'activeMatchId', null);
    navigate('/', { replace: true });
  };

  return (
    <div className="screen">
      <TopBar back="/" backLabel="Home" title={`vs ${names.opponent}`} />
      <p className="result">{resultLine(match, r, names)}</p>
      <ul className="details">
        {details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      {match.notes.trim() && <p className="notes">{match.notes}</p>}
      <ErrorBox message={error} />
      <div className="stack">
        {isResumable(match) && (
          <Link href={`/match/${id}/chart`} className="btn btn-primary">
            Continue charting
          </Link>
        )}
        {!finished && !isResumable(match) && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => apply((m) => resumeMatch(m)) && navigate(`/match/${id}/chart`)}
          >
            Reopen and keep charting
          </button>
        )}
        <Link href={`/match/${id}/points`} className="btn">
          Points ({match.points.length})
        </Link>
        <Link href={`/match/${id}/edit`} className="btn">
          Edit match details
        </Link>
        {confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={() => void remove()}>
            Tap again to delete this match for good
          </button>
        ) : (
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
            Delete match
          </button>
        )}
      </div>
    </div>
  );
}
