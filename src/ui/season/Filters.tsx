/** Season filters: dates, event type, surface and opponent UTR band. Shared by every season tab. */
import { EVENT_TYPE_LABELS, SURFACE_LABELS } from '../../domain/labels';
import {
  DATE_PRESET_LABELS,
  UTR_BANDS,
  UTR_BAND_LABELS,
  defaultFilter,
  withDates,
  type DatePreset,
  type EventFilter,
  type SeasonFilter,
  type UtrBand,
} from '../../domain/seasonView';
import type { Surface } from '../../domain/types';
import { today } from '../dates';

const EVENT_OPTIONS: [EventFilter, string][] = [
  ['competitive', 'All but practice'],
  ['all', 'All, with practice'],
  ...(Object.entries(EVENT_TYPE_LABELS) as [EventFilter, string][]),
];
const SURFACE_OPTIONS: ['all' | Surface, string][] = [['all', 'All surfaces'], ...(Object.entries(SURFACE_LABELS) as [Surface, string][])];
const BAND_OPTIONS: ['all' | UtrBand, string][] = [
  ['all', 'All opponents'],
  // Short, so the closed select fits a narrow phone; the Record tab explains each band.
  ...UTR_BANDS.map((b): [UtrBand, string] => [b, UTR_BAND_LABELS[b]]),
];

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="filter">
      <span className="filter-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Filters({ filter, onChange }: { filter: SeasonFilter; onChange: (f: SeasonFilter) => void }) {
  const fresh = defaultFilter(today());
  const isDefault = (Object.keys(fresh) as (keyof SeasonFilter)[]).every((k) => fresh[k] === filter[k]);
  return (
    <div className="filters" role="group" aria-label="Filters">
      <Select
        label="Dates"
        value={filter.dates}
        options={Object.entries(DATE_PRESET_LABELS) as [DatePreset, string][]}
        onChange={(v) => onChange(withDates(filter, v, today()))}
      />
      <Select label="Events" value={filter.events} options={EVENT_OPTIONS} onChange={(v) => onChange({ ...filter, events: v })} />
      {filter.dates === 'custom' && (
        <>
          <label className="filter">
            <span className="filter-label">From</span>
            <input type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => onChange({ ...filter, from: e.target.value })} />
          </label>
          <label className="filter">
            <span className="filter-label">To</span>
            <input type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => onChange({ ...filter, to: e.target.value })} />
          </label>
        </>
      )}
      <Select label="Surface" value={filter.surface} options={SURFACE_OPTIONS} onChange={(v) => onChange({ ...filter, surface: v })} />
      <Select label="Opponent UTR" value={filter.band} options={BAND_OPTIONS} onChange={(v) => onChange({ ...filter, band: v })} />
      {!isDefault && (
        <button type="button" className="filters-reset" onClick={() => onChange(fresh)}>
          Reset filters
        </button>
      )}
    </div>
  );
}
