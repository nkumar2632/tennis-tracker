import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { backupFileName, makeBackup, parseBackup, type Backup } from '../../domain/backup';
import { db } from '../../storage/db';
import { BACKED_UP_SETTINGS, replaceAllData, requestPersistentStorage, setSetting } from '../../storage/repo';
import { ErrorBox, Sheet, TopBar } from '../components';
import { errorMessage, useMatches, useSettings } from '../hooks';
import { shareFile } from '../share';
import { forgetAllMatches, whenSaved } from '../store';
import { shortDate } from '../dates';

const matchCount = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`;

export function SettingsScreen() {
  const settings = useSettings();
  const matches = useMatches();
  const [name, setName] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted);
  }, []);

  if (!matches) return <div className="screen" />;
  const shownName = name ?? settings.playerName;

  // Built from data already on screen so the share sheet opens straight from the tap.
  const backUp = async () => {
    setError(null);
    const kept = Object.fromEntries(BACKED_UP_SETTINGS.map((k) => [k, settings[k]]));
    const json = JSON.stringify(makeBackup(matches, kept), null, 1);
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
      await replaceAllData(db, backup.matches, backup.settings);
      forgetAllMatches();
      setName(null);
      setMessage(`Restored ${matchCount(backup.matches.length)}.`);
    } catch (e) {
      setError(`Restore failed; nothing was changed. ${errorMessage(e)}`);
    }
  };

  return (
    <div className="screen">
      <TopBar back="/" backLabel="Home" title="Settings" />

      <label className="field">
        <span className="field-label">Player&apos;s name</span>
        <input
          value={shownName}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            void setSetting(db, 'playerName', e.target.value.trim());
          }}
        />
      </label>

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
            This replaces everything on this phone ({matchCount(matches.length)}) with the{' '}
            {matchCount(pending.matches.length)} in the backup{pending.exportedAt ? ` from ${shortDate(pending.exportedAt.slice(0, 10))}` : ''}. This can&apos;t be
            undone.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => void restore(pending)}>
            Replace with backup
          </button>
        </Sheet>
      )}
    </div>
  );
}
