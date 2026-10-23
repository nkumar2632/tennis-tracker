/**
 * One match in a list: W/L badge, opponent, date and event, and how it stands or ended.
 * `extra` adds a line; `action` puts a separate link or button at the end of the row.
 */
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { EVENT_TYPE_LABELS, resultLine } from '../domain/labels';
import { isResumable, matchOutcome } from '../domain/match';
import { replay } from '../domain/replay';
import type { Match } from '../domain/types';
import { shortDate } from './dates';
import { namesFor } from './hooks';

export function MatchRow({
  match,
  playerName,
  extra,
  action,
}: {
  match: Match;
  playerName: string;
  extra?: ReactNode;
  action?: ReactNode;
}) {
  const r = replay(match);
  const names = namesFor({ playerName }, match);
  const outcome = matchOutcome(match, r);
  const badge = outcome.winner ? (outcome.winner === 'player' ? 'W' : 'L') : '';
  const event = [match.eventName, EVENT_TYPE_LABELS[match.eventType], match.round].filter(Boolean).join(' · ');
  return (
    <li className={action ? 'has-action' : undefined}>
      <Link href={isResumable(match) ? `/match/${match.id}/chart` : `/match/${match.id}`} className="match-row">
        <span className={`badge badge-${badge || 'none'}`}>{badge}</span>
        <span className="match-row-main">
          <span className="match-row-title">vs {names.opponent}</span>
          <span className="match-row-sub">
            {shortDate(match.date)} · {event}
          </span>
          <span className="match-row-sub">{resultLine(match, r, names)}</span>
          {extra && <span className="match-row-sub">{extra}</span>}
        </span>
      </Link>
      {action}
    </li>
  );
}
