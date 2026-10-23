/** Season: record, trends and head-to-head across matches, under one set of filters. */
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { defaultFilter, filterMatches, type SeasonFilter } from '../../domain/seasonView';
import { TopBar } from '../components';
import { today } from '../dates';
import { useMatches, useSettings } from '../hooks';
import { Filters } from '../season/Filters';
import { HeadToHeadView } from '../season/HeadToHeadView';
import { RecordView } from '../season/RecordView';
import { TrendsView } from '../season/TrendsView';

export type SeasonTab = 'record' | 'trends' | 'h2h';

const TABS: [SeasonTab, string, string][] = [
  ['record', 'Record', ''],
  ['trends', 'Trends', '/trends'],
  ['h2h', 'Head-to-head', '/h2h'],
];

// Kept while the app is open, so switching tabs or opening a match and coming back keeps the filters.
let remembered: SeasonFilter | null = null;

/** For tests: start from the default filters. */
export function forgetSeasonFilter(): void {
  remembered = null;
}

export function SeasonScreen({ tab }: { tab: SeasonTab }) {
  const settings = useSettings();
  const all = useMatches();
  const [filter, setFilterState] = useState(() => remembered ?? defaultFilter(today()));
  const setFilter = (f: SeasonFilter) => {
    remembered = f;
    setFilterState(f);
  };
  const matches = useMemo(() => (all ? filterMatches(all, filter) : []), [all, filter]);

  return (
    <div className="screen">
      <TopBar back="/" backLabel="Home" title="Season" />
      <nav className="tabs season-tabs" aria-label="Season">
        {TABS.map(([key, label, path]) => (
          <Link
            key={key}
            href={`/season${path}`}
            className={tab === key ? 'tab on' : 'tab'}
            aria-current={tab === key ? 'page' : undefined}
            replace
          >
            {label}
          </Link>
        ))}
      </nav>
      <Filters filter={filter} onChange={setFilter} />
      {!all ? (
        <p className="muted">Loading…</p>
      ) : tab === 'record' ? (
        <RecordView all={all} matches={matches} filter={filter} playerName={settings.playerName} />
      ) : tab === 'trends' ? (
        <TrendsView matches={matches} />
      ) : (
        <HeadToHeadView matches={matches} playerName={settings.playerName} />
      )}
    </div>
  );
}
