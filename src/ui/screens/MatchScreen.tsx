/** One match: result and details, then Stats, Timeline and Report tabs. */
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { resultLine } from '../../domain/labels';
import { resumeMatch } from '../../domain/log';
import { isResumable } from '../../domain/match';
import { matchInfo } from '../../domain/report';
import { replay } from '../../domain/replay';
import { db } from '../../storage/db';
import { deleteMatch, getSetting, setSetting } from '../../storage/repo';
import { ErrorBox, Sheet, TopBar } from '../components';
import { namesFor, useMatchEditor, useMatches, usePlayers } from '../hooks';
import { ReportView } from '../match/ReportView';
import { StatsView } from '../match/StatsView';
import { Timeline } from '../match/Timeline';
import { forgetMatch, whenSaved } from '../store';

export type MatchTab = 'stats' | 'timeline' | 'report';

const TABS: [MatchTab, string, string][] = [
  ['stats', 'Stats', ''],
  ['timeline', 'Timeline', '/timeline'],
  ['report', 'Report', '/report'],
];

export function MatchScreen({ id, tab }: { id: string; tab: MatchTab }) {
  const { match, apply, error } = useMatchEditor(id);
  const players = usePlayers();
  const matches = useMatches();
  const [, navigate] = useLocation();
  const [sheet, setSheet] = useState<'none' | 'menu' | 'delete'>('none');
  // Stable across re-renders so the report (and its files) is only rebuilt when a name changes.
  const latest = namesFor(players, match);
  const names = useMemo(() => latest, [latest.player, latest.opponent]);
  const r = useMemo(() => (match ? replay(match) : null), [match]);

  if (!match || !r) {
    return match === null ? (
      <div className="screen">
        <TopBar back="/" backLabel="Home" title="Match" />
        <p>That match no longer exists.</p>
      </div>
    ) : (
      <div className="screen" />
    );
  }
  const won = r.final.winner !== null;

  const remove = async () => {
    await whenSaved();
    await deleteMatch(db, id);
    forgetMatch(id);
    if ((await getSetting(db, 'activeMatchId')) === id) await setSetting(db, 'activeMatchId', null);
    navigate('/', { replace: true });
  };

  return (
    <div className="screen">
      <TopBar
        back="/"
        backLabel="Home"
        title={`vs ${names.opponent}`}
        right={
          <button type="button" className="icon-btn" aria-label="Match menu" onClick={() => setSheet('menu')}>
            •••
          </button>
        }
      />
      <p className="result">{resultLine(match, r, names)}</p>
      <p className="match-info muted">
        {matchInfo(match, r, names).map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </p>
      {match.notes.trim() && (
        <details className="notes-box">
          <summary>Notes</summary>
          <p className="notes">{match.notes}</p>
        </details>
      )}
      <ErrorBox message={error} />
      {isResumable(match) && (
        <Link href={`/match/${id}/chart`} className="btn btn-primary">
          Continue charting
        </Link>
      )}
      {!won && !isResumable(match) && (
        <button type="button" className="btn" onClick={() => apply((m) => resumeMatch(m)) && navigate(`/match/${id}/chart`)}>
          Reopen and keep charting
        </button>
      )}

      <nav className="tabs" aria-label="Match">
        {TABS.map(([key, label, path]) => (
          <Link
            key={key}
            href={`/match/${id}${path}`}
            className={tab === key ? 'tab on' : 'tab'}
            aria-current={tab === key ? 'page' : undefined}
            replace
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'stats' && <StatsView r={r} names={names} />}
      {tab === 'timeline' && <Timeline r={r} names={names} editBase={`/match/${id}/timeline`} />}
      {tab === 'report' &&
        (matches ? <ReportView match={match} r={r} names={names} allMatches={matches} /> : <p className="muted">Loading…</p>)}

      {sheet === 'menu' && (
        <Sheet title={`vs ${names.opponent}`} onClose={() => setSheet('none')}>
          <Link href={`/match/${id}/edit`} className="btn">
            Edit match details
          </Link>
          <button type="button" className="btn btn-danger-outline" onClick={() => setSheet('delete')}>
            Delete match…
          </button>
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Sheet title="Delete this match?" onClose={() => setSheet('none')}>
          <p>
            This deletes the match against {names.opponent} and all {match.points.length} points for good.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => void remove()}>
            Delete match
          </button>
        </Sheet>
      )}
    </div>
  );
}
