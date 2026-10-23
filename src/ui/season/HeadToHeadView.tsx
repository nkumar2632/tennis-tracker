/** Opponents he has played more than once in the filtered matches, with the record and each match. */
import { headToHead } from '../../domain/seasonView';
import type { Match } from '../../domain/types';
import { MatchRow } from '../MatchRow';
import { recordText } from './RecordView';

export function HeadToHeadView({ matches, playerName }: { matches: readonly Match[]; playerName: string }) {
  const opponents = headToHead(matches);
  if (opponents.length === 0) return <p className="muted">No opponent played more than once in these matches.</p>;
  return (
    <>
      {opponents.map((h) => (
        <section key={h.name} className="h2h" aria-label={`vs ${h.name}`}>
          <h2 className="h2h-title">
            <span>vs {h.name}</span>
            <span className="h2h-record" aria-label={`${h.record.wins} won, ${h.record.losses} lost`}>
              {recordText(h.record)}
            </span>
          </h2>
          {h.record.notCounted > 0 && (
            <p className="muted h2h-sub">
              {h.record.notCounted} more not in the record (stopped or not finished)
            </p>
          )}
          <ul className="match-list">
            {h.matches.map((m) => (
              <MatchRow key={m.id} match={m} playerName={playerName} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
