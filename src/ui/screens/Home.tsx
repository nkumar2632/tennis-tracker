import { useState } from 'react';
import { Link } from 'wouter';
import { EVENT_TYPE_LABELS, resultLine } from '../../domain/labels';
import { isResumable, matchOutcome } from '../../domain/match';
import { replay } from '../../domain/replay';
import type { Match } from '../../domain/types';
import { db } from '../../storage/db';
import { setSetting } from '../../storage/repo';
import { namesFor, useMatches, useSettings } from '../hooks';

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function NameCard() {
  const [name, setName] = useState('');
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) void setSetting(db, 'playerName', name.trim());
      }}
    >
      <label className="field">
        <span className="field-label">Who are you charting? (your son&apos;s name)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
        Save
      </button>
    </form>
  );
}

function MatchRow({ match, playerName }: { match: Match; playerName: string }) {
  const r = replay(match);
  const names = namesFor({ playerName }, match);
  const outcome = matchOutcome(match, r);
  const badge = outcome.winner ? (outcome.winner === 'player' ? 'W' : 'L') : '';
  const event = [match.eventName, EVENT_TYPE_LABELS[match.eventType], match.round].filter(Boolean).join(' · ');
  return (
    <li>
      <Link href={isResumable(match) ? `/match/${match.id}/chart` : `/match/${match.id}`} className="match-row">
        <span className={`badge badge-${badge || 'none'}`}>{badge}</span>
        <span className="match-row-main">
          <span className="match-row-title">vs {names.opponent}</span>
          <span className="match-row-sub">
            {shortDate(match.date)} · {event}
          </span>
          <span className="match-row-sub">{resultLine(match, r, names)}</span>
        </span>
      </Link>
    </li>
  );
}

export function HomeScreen() {
  const settings = useSettings();
  const matches = useMatches();
  if (!matches) return <div className="screen" />;
  const resumable = matches.filter(isResumable);
  const others = matches.filter((m) => !isResumable(m));
  return (
    <div className="screen">
      <header className="home-header">
        <h1>Tennis Tracker</h1>
        <Link href="/settings" className="icon-btn" aria-label="Settings">
          ⚙︎
        </Link>
      </header>

      {!settings.playerName && <NameCard />}

      {resumable.length > 0 && (
        <section>
          <h2 className="section-title">In progress</h2>
          <ul className="match-list">
            {resumable.map((m) => (
              <MatchRow key={m.id} match={m} playerName={settings.playerName} />
            ))}
          </ul>
        </section>
      )}

      <Link href="/new" className="btn btn-primary btn-big">
        + New match
      </Link>

      <section>
        <h2 className="section-title">Matches</h2>
        {others.length === 0 ? (
          <p className="muted">No finished matches yet.</p>
        ) : (
          <ul className="match-list">
            {others.map((m) => (
              <MatchRow key={m.id} match={m} playerName={settings.playerName} />
            ))}
          </ul>
        )}
      </section>
      <p className="muted version">Build {__APP_VERSION__}</p>
    </div>
  );
}
