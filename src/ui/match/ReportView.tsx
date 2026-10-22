/**
 * The match report: season comparison on screen, plus the PDF and Excel files to share.
 * Files are built as soon as this opens, because iOS only shows the share sheet if a tap
 * triggers it directly: the Share buttons just hand over files that are already made.
 */
import { useEffect, useMemo, useState } from 'react';
import { buildReport } from '../../domain/report';
import type { Replay } from '../../domain/replay';
import { percentText } from '../../domain/statRows';
import type { BySide, Match } from '../../domain/types';
import { ErrorBox } from '../components';
import { errorMessage } from '../hooks';
import { shareFiles } from '../share';
import { makeExcelFile, makePdfFile } from '../exportFiles';

type Files = { pdf: File; xlsx: File };

function diffText(diff: number | null): string {
  if (diff === null) return '—';
  const n = Math.round(diff);
  return `${n > 0 ? '+' : ''}${n}`;
}

export function ReportView({ match, r, names, allMatches }: { match: Match; r: Replay; names: BySide<string>; allMatches: Match[] }) {
  const report = useMemo(() => buildReport(match, allMatches, names), [match, allMatches, names]);
  const [files, setFiles] = useState<Files | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setFiles(null);
    setError(null);
    Promise.all([makePdfFile(report, match, names), makeExcelFile(report, r, match, names)])
      .then(([pdf, xlsx]) => alive && setFiles({ pdf, xlsx }))
      .catch((e) => alive && setError(`Couldn't make the report: ${errorMessage(e)}`));
    return () => {
      alive = false;
    };
  }, [report, r, match, names]);

  const share = async (which: File[]) => {
    setMessage(null);
    try {
      const result = await shareFiles(which);
      if (result === 'downloaded') setMessage(`Saved ${which.map((f) => f.name).join(' and ')}.`);
    } catch (e) {
      setError(`Couldn't share: ${errorMessage(e)}`);
    }
  };

  const { comparison } = report;
  const better = comparison.rows.filter((row) => row.highlight === 'better');
  const worse = comparison.rows.filter((row) => row.highlight === 'worse');

  return (
    <div className="report">
      <h2 className="section-title">Send the report</h2>
      <p className="muted">PDF report (1–2 pages) and an Excel file with every point and the stats for each set.</p>
      <div className="stack">
        <button type="button" className="btn btn-primary" disabled={!files} onClick={() => files && void share([files.pdf])}>
          {files ? 'Share PDF report' : 'Preparing PDF and Excel…'}
        </button>
        <button type="button" className="btn" disabled={!files} onClick={() => files && void share([files.xlsx])}>
          Share Excel file
        </button>
        <button type="button" className="btn" disabled={!files} onClick={() => files && void share([files.pdf, files.xlsx])}>
          Share both
        </button>
      </div>
      {message && (
        <p className="ok-box" role="status">
          {message}
        </p>
      )}
      <ErrorBox message={error} />

      <h2 className="section-title">This match vs {names.player}&apos;s season</h2>
      {comparison.tooFew ? (
        <p className="muted">
          The comparison appears once there are at least 3 other finished matches ({report.seasonDescription}). So far:{' '}
          {comparison.matches}.
        </p>
      ) : (
        <>
          <p className="muted">
            Compared with {comparison.matches} matches: {report.seasonDescription}.
          </p>
          {better.length > 0 && <p className="callout callout-better">Better than usual: {better.map((b) => b.label).join('; ')}</p>}
          {worse.length > 0 && <p className="callout callout-worse">Worse than usual: {worse.map((w) => w.label).join('; ')}</p>}
          <table className="stat-table compare-table">
            <thead>
              <tr>
                <th aria-label="Stat" />
                <th>Match</th>
                <th>Season</th>
                <th>+/− pts</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.id} className={row.highlight ? `hl-${row.highlight}` : undefined}>
                  <th scope="row">{row.label}</th>
                  <td>{percentText(row.match)}</td>
                  <td>{percentText(row.season)}</td>
                  <td>{diffText(row.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
