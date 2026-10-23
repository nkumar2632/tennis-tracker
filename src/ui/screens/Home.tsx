import { useState } from 'react';
import { Link } from 'wouter';
import { isResumable } from '../../domain/match';
import { defaultFilter, filterMatches, winLoss } from '../../domain/seasonView';
import { db } from '../../storage/db';
import { setSetting } from '../../storage/repo';
import { useMatches, useSettings } from '../hooks';
import { today } from '../dates';
import { MatchRow } from '../MatchRow';
import { recordText } from '../season/RecordView';

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

export function HomeScreen() {
  const settings = useSettings();
  const matches = useMatches();
  if (!matches) return <div className="screen" />;
  const resumable = matches.filter(isResumable);
  const others = matches.filter((m) => !isResumable(m));
  const lastYear = winLoss(filterMatches(matches, defaultFilter(today())));
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

      {matches.length > 0 && (
        <Link href="/season" className="season-link">
          <span className="season-link-main">
            <span className="season-link-title">Season</span>
            <span className="match-row-sub">
              Last 12 months {recordText(lastYear)} · trends · head-to-head
            </span>
          </span>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      )}

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
