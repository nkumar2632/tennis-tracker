/** Win/loss record for the filtered matches, the record by opponent UTR band, and the match list. */
import { Link } from 'wouter';
import {
  UTR_BANDS,
  UTR_BAND_LABELS,
  filterMatches,
  playerUtrFor,
  utrBand,
  utrBandHint,
  winLoss,
  winPct,
  type SeasonFilter,
  type WinLoss,
} from '../../domain/seasonView';
import type { Match } from '../../domain/types';
import { MatchRow } from '../MatchRow';

export function recordText(r: WinLoss): string {
  return `${r.wins}–${r.losses}`;
}

function UtrLine({ match, all, playerName }: { match: Match; all: readonly Match[]; playerName: string }) {
  if (match.opponentUtr === undefined) return <>Opponent UTR not entered</>;
  const band = utrBand(match, all);
  const theirs = `Opponent UTR ${match.opponentUtr}`;
  if (band === 'unknown' && playerUtrFor(match, all) === undefined) {
    return (
      <>
        {theirs} · {playerName}&apos;s UTR not entered
      </>
    );
  }
  return (
    <>
      {theirs} · {UTR_BAND_LABELS[band]}
    </>
  );
}

export function RecordView({
  all,
  matches,
  filter,
  playerName,
}: {
  all: readonly Match[];
  matches: readonly Match[];
  filter: SeasonFilter;
  playerName: string;
}) {
  const record = winLoss(matches);
  const p = winPct(record);
  // The band breakdown keeps every other filter but looks across all bands.
  const anyBand = filterMatches(all, { ...filter, band: 'all' });
  const byBand = UTR_BANDS.map((band) => ({ band, matches: anyBand.filter((m) => utrBand(m, all) === band) }));

  return (
    <>
      <section className="record card" aria-label="Record">
        <p className="record-big" aria-label={`${record.wins} won, ${record.losses} lost`}>
          {recordText(record)}
        </p>
        <p className="record-sub">
          {record.wins + record.losses === 0
            ? 'No wins or losses in these matches.'
            : `Won ${record.wins} of ${record.wins + record.losses} (${Math.round(p!)}%)`}
        </p>
        {record.notCounted > 0 && (
          <p className="record-sub muted">
            {record.notCounted} more not in the record (stopped or not finished)
          </p>
        )}
      </section>

      <h2 className="section-title">By opponent UTR</h2>
      <table className="band-table">
        <tbody>
          {byBand.map(({ band, matches: ms }) => {
            const r = winLoss(ms);
            return (
              <tr key={band} className={filter.band === band ? 'on' : undefined}>
                <th scope="row">
                  {UTR_BAND_LABELS[band]}
                  <span className="band-hint">{utrBandHint(band, playerName)}</span>
                </th>
                <td>{recordText(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="section-title">Matches ({matches.length})</h2>
      {matches.length === 0 ? (
        <p className="muted">No matches in these filters.</p>
      ) : (
        <ul className="match-list">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              extra={<UtrLine match={m} all={all} playerName={playerName} />}
              action={
                utrBand(m, all) === 'unknown' ? (
                  <Link href={`/match/${m.id}/edit`} className="row-action">
                    Add UTR
                  </Link>
                ) : undefined
              }
            />
          ))}
        </ul>
      )}
    </>
  );
}
