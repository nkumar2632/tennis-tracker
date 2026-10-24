import { useState } from 'react';
import { Link } from 'wouter';
import { isResumable } from '../../domain/match';
import { matchesOf, newPlayer } from '../../domain/players';
import { defaultFilter, filterMatches, winLoss } from '../../domain/seasonView';
import { db } from '../../storage/db';
import { savePlayer, setSetting } from '../../storage/repo';
import { useCurrentPlayer, useMatches, usePlayers } from '../hooks';
import { today } from '../dates';
import { MatchRow } from '../MatchRow';
import { recordText } from '../season/RecordView';

/** First launch: name the first player. More can be added in Settings. */
function NameCard() {
  const [name, setName] = useState('');
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const player = newPlayer(name);
        void savePlayer(db, player).then(() => setSetting(db, 'currentPlayerId', player.id));
      }}
    >
      <label className="field">
        <span className="field-label">Who are you charting? (the player&apos;s name)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
        Save
      </button>
    </form>
  );
}

/** Who Home (and Season) is showing, when there's more than one player. */
function PlayerSwitch() {
  const players = usePlayers();
  const current = useCurrentPlayer();
  if (players.length < 2) return null;
  return (
    <div className="segmented player-switch" role="radiogroup" aria-label="Player">
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={p.id === current?.id}
          className={p.id === current?.id ? 'seg on' : 'seg'}
          onClick={() => void setSetting(db, 'currentPlayerId', p.id)}
        >
          {p.name.trim() || 'Player'}
        </button>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const player = useCurrentPlayer();
  const everyone = useMatches();
  if (!everyone) return <div className="screen" />;
  const matches = player ? matchesOf(everyone, player.id) : [];
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

      {player ? <PlayerSwitch /> : <NameCard />}

      {resumable.length > 0 && (
        <section>
          <h2 className="section-title">In progress</h2>
          <ul className="match-list">
            {resumable.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </ul>
        </section>
      )}

      {player && (
        <Link href="/new" className="btn btn-primary btn-big">
          + New match
        </Link>
      )}

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
              <MatchRow key={m.id} match={m} />
            ))}
          </ul>
        )}
      </section>
      <p className="muted version">Build {__APP_VERSION__}</p>
    </div>
  );
}
