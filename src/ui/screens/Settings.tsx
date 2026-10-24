import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { backupFileName, makeBackup, parseBackup, type Backup } from '../../domain/backup';
import { matchesOf, newPlayer } from '../../domain/players';
import type { Match, Player } from '../../domain/types';
import { db } from '../../storage/db';
import { BACKED_UP_SETTINGS, deletePlayer, replaceAllData, requestPersistentStorage, savePlayer } from '../../storage/repo';
import { ErrorBox, Sheet, TopBar } from '../components';
import { errorMessage, useMatches, usePlayers, useSettings } from '../hooks';
import { shareFile } from '../share';
import { forgetAllMatches, forgetMatch, whenSaved } from '../store';
import { shortDate } from '../dates';

const matchCount = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`;
const playerCount = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`;

/** A player's name, renamed as you type (a blank name isn't saved). */
function PlayerRow({ player, matches, onDelete }: { player: Player; matches: number; onDelete: () => void }) {
  const [name, setName] = useState(player.name);
  // The name last saved from this box: `player` can lag a keystroke behind while the save lands.
  const saved = useRef(player.name);
  return (
    <li className="player-row">
      <label className="field">
        <span className="field-label">
          Player <span className="muted">· {matchCount(matches)}</span>
        </span>
        <input
          value={name}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            const trimmed = e.target.value.trim();
            if (!trimmed) return;
            saved.current = trimmed;
            void savePlayer(db, { ...player, name: trimmed });
          }}
          onBlur={() => setName((n) => n.trim() || saved.current)}
        />
      </label>
      <button type="button" className="btn btn-plain player-delete" onClick={onDelete} aria-label={`Delete ${player.name}`}>
        Delete
      </button>
    </li>
  );
}

function PlayersSection({ matches }: { matches: Match[] }) {
  const players = usePlayers();
  const [adding, setAdding] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (name: string) => {
    setAdding(null);
    await savePlayer(db, newPlayer(name));
  };
  const remove = async (player: Player) => {
    setDeleting(null);
    try {
      await whenSaved();
      await deletePlayer(db, player.id);
      for (const m of matchesOf(matches, player.id)) forgetMatch(m.id);
    } catch (e) {
      setError(`Couldn't delete: ${errorMessage(e)}`);
    }
  };
  const deletingCount = deleting ? matchesOf(matches, deleting.id).length : 0;

  return (
    <>
      <h2 className="section-title">Players</h2>
      <ul className="player-list">
        {players.map((p) => (
          <PlayerRow key={p.id} player={p} matches={matchesOf(matches, p.id).length} onDelete={() => setDeleting(p)} />
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => setAdding('')}>
        + Add a player
      </button>
      <ErrorBox message={error} />

      {adding !== null && (
        <Sheet title="Add a player" onClose={() => setAdding(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (adding.trim()) void add(adding);
            }}
          >
            <label className="field">
              <span className="field-label">Name</span>
              <input value={adding} autoComplete="off" autoFocus onChange={(e) => setAdding(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={!adding.trim()}>
              Add player
            </button>
          </form>
        </Sheet>
      )}
      {deleting && (
        <Sheet title={`Delete ${deleting.name}?`} onClose={() => setDeleting(null)}>
          <p>
            {deletingCount === 0
              ? `${deleting.name} has no matches.`
              : `This also deletes ${deleting.name}'s ${matchCount(deletingCount)} for good. Back up first if you might want them.`}
          </p>
          <button type="button" className="btn btn-danger" onClick={() => void remove(deleting)}>
            Delete {deleting.name}
          </button>
        </Sheet>
      )}
    </>
  );
}

export function SettingsScreen() {
  const settings = useSettings();
  const players = usePlayers();
  const matches = useMatches();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted);
  }, []);

  if (!matches) return <div className="screen" />;

  // Built from data already on screen so the share sheet opens straight from the tap.
  const backUp = async () => {
    setError(null);
    const kept = Object.fromEntries(BACKED_UP_SETTINGS.map((k) => [k, settings[k]]));
    const json = JSON.stringify(makeBackup(players, matches, kept), null, 1);
    const file = new File([json], backupFileName(), { type: 'application/json' });
    try {
      const result = await shareFile(file);
      if (result !== 'cancelled') setMessage(`Backup of ${matchCount(matches.length)} ready: ${file.name}`);
    } catch (e) {
      setError(`Couldn't back up: ${errorMessage(e)}`);
    }
  };

  const pickFile = async (file: File | undefined) => {
    setError(null);
    setMessage(null);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (parsed.ok) setPending(parsed.backup);
    else setError(parsed.error);
  };

  const restore = async (backup: Backup) => {
    setPending(null);
    try {
      await whenSaved();
      await replaceAllData(db, backup);
      forgetAllMatches();
      setMessage(`Restored ${matchCount(backup.matches.length)} (${playerCount(backup.players.length)}).`);
    } catch (e) {
      setError(`Restore failed; nothing was changed. ${errorMessage(e)}`);
    }
  };

  return (
    <div className="screen">
      <TopBar back="/" backLabel="Home" title="Settings" />

      <PlayersSection matches={matches} />

      <h2 className="section-title">Backup</h2>
      <p className="muted">
        Everything lives only on this phone. Back up after matches and save the file somewhere safe (Files, iCloud
        Drive, email to yourself).
      </p>
      <div className="stack">
        <button type="button" className="btn btn-primary" onClick={() => void backUp()}>
          Back up all data ({matchCount(matches.length)})
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Restore from a backup…
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="Backup file"
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {message && (
        <p className="ok-box" role="status">
          {message}
        </p>
      )}
      <ErrorBox message={error} />

      <h2 className="section-title">About</h2>
      <p className="muted">
        Storage:{' '}
        {persisted === null ? '…' : persisted ? 'protected from automatic clearing' : 'best effort (keep backups)'}
        <br />
        Build {__APP_VERSION__}
      </p>
      <Link href="/debug" className="muted">
        Testing tools
      </Link>

      {pending && (
        <Sheet title="Replace everything?" onClose={() => setPending(null)}>
          <p>
            This replaces everything on this phone ({playerCount(players.length)}, {matchCount(matches.length)}) with the
            backup{pending.exportedAt ? ` from ${shortDate(pending.exportedAt.slice(0, 10))}` : ''} ({playerCount(pending.players.length)},{' '}
            {matchCount(pending.matches.length)}). This can&apos;t be undone.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => void restore(pending)}>
            Replace with backup
          </button>
        </Sheet>
      )}
    </div>
  );
}
