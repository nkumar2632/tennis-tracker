/**
 * New match and "Match details". Only opponent, first server and format are required; everything else
 * can be filled in now or later. Remembers the last event, surface and format.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { FORMAT_PRESETS, FORMAT_PRESET_LABELS, type FormatPresetKey } from '../../domain/format';
import { EVENT_TYPE_LABELS, SURFACE_LABELS, formatSummary } from '../../domain/labels';
import { createMatch, setupOf, updateSetup, validateSetup, type MatchSetup } from '../../domain/match';
import { findOpponent, pastOpponents } from '../../domain/opponents';
import type { EventType, Handedness, Match, MatchFormat, Side, StartingScore, Surface } from '../../domain/types';
import { db } from '../../storage/db';
import { setSetting, type SetupDefaults } from '../../storage/repo';
import { Segmented, TopBar } from '../components';
import { errorMessage, namesFor, useMatchEditor, useMatches, useSettings } from '../hooks';
import { commitMatch } from '../store';
import { today } from '../dates';


/** Draft of the form. Numbers are kept as text while typing. */
interface Draft {
  date: string;
  eventName: string;
  eventType: EventType;
  round: string;
  surface: Surface;
  indoor: boolean;
  opponentName: string;
  opponentUtr: string;
  opponentHand: Handedness | undefined;
  playerUtr: string;
  notes: string;
  format: MatchFormat;
  firstServer: Side | undefined;
  lateStart: boolean;
  startSets: [string, string][];
  startGames: [string, string];
}

function draftFrom(setup: MatchSetup): Draft {
  const s = setup.startingScore;
  return {
    date: setup.date,
    eventName: setup.eventName,
    eventType: setup.eventType,
    round: setup.round ?? '',
    surface: setup.surface,
    indoor: setup.indoor,
    opponentName: setup.opponentName,
    opponentUtr: setup.opponentUtr?.toString() ?? '',
    opponentHand: setup.opponentHand,
    playerUtr: setup.playerUtr?.toString() ?? '',
    notes: setup.notes,
    format: setup.format,
    firstServer: setup.firstServer,
    lateStart: !!s,
    startSets: s ? s.completedSets.map((set) => [String(set.games.player), String(set.games.opponent)]) : [],
    startGames: s ? [String(s.games.player), String(s.games.opponent)] : ['0', '0'],
  };
}

function newDraft(defaults: SetupDefaults | null): Draft {
  return {
    date: today(),
    eventName: defaults?.eventName ?? '',
    eventType: defaults?.eventType ?? 'usta',
    round: '',
    surface: defaults?.surface ?? 'hard',
    indoor: defaults?.indoor ?? false,
    opponentName: '',
    opponentUtr: '',
    opponentHand: undefined,
    playerUtr: defaults?.playerUtr?.toString() ?? '',
    notes: '',
    format: defaults?.format ?? FORMAT_PRESETS.twoSetsMatchTiebreak,
    firstServer: undefined,
    lateStart: false,
    startSets: [],
    startGames: ['0', '0'],
  };
}

function parseUtr(text: string, label: string, errors: string[]): number | undefined {
  if (!text.trim()) return undefined;
  const n = Number(text.trim());
  if (!Number.isFinite(n) || n < 1 || n > 16.5) {
    errors.push(`${label} should be a UTR between 1 and 16.5, or left blank.`);
    return undefined;
  }
  return n;
}

const toInt = (t: string) => (t.trim() === '' ? NaN : Number(t));

/** Turn the draft into a setup, or list what's wrong with it. */
function toSetup(d: Draft, playerName: string): { setup?: MatchSetup; errors: string[] } {
  const errors: string[] = [];
  if (!d.opponentName.trim()) errors.push("Enter the opponent's name.");
  if (!d.firstServer) errors.push(d.lateStart ? 'Choose who serves next.' : 'Choose who serves first.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.push('Enter the match date.');
  const opponentUtr = parseUtr(d.opponentUtr, "Opponent's UTR", errors);
  const playerUtr = parseUtr(d.playerUtr, `${playerName}'s UTR`, errors);
  let startingScore: StartingScore | undefined;
  if (d.lateStart) {
    startingScore = {
      completedSets: d.startSets.map(([p, o]) => ({ games: { player: toInt(p), opponent: toInt(o) } })),
      games: { player: toInt(d.startGames[0]), opponent: toInt(d.startGames[1]) },
    };
  }
  const setup: MatchSetup = {
    date: d.date,
    eventName: d.eventName.trim(),
    eventType: d.eventType,
    surface: d.surface,
    indoor: d.indoor,
    opponentName: d.opponentName.trim().replace(/\s+/g, ' '),
    notes: d.notes,
    format: d.format,
    firstServer: d.firstServer ?? 'player',
  };
  if (d.round.trim()) setup.round = d.round.trim();
  if (opponentUtr !== undefined) setup.opponentUtr = opponentUtr;
  if (d.opponentHand) setup.opponentHand = d.opponentHand;
  if (playerUtr !== undefined) setup.playerUtr = playerUtr;
  if (startingScore) setup.startingScore = startingScore;
  errors.push(...validateSetup(setup));
  return errors.length > 0 ? { errors } : { setup, errors };
}

function presetOf(f: MatchFormat): FormatPresetKey | undefined {
  return (Object.keys(FORMAT_PRESETS) as FormatPresetKey[]).find((k) => {
    const p = FORMAT_PRESETS[k];
    return (
      p.bestOf === f.bestOf &&
      p.gamesPerSet === f.gamesPerSet &&
      p.tiebreakAt === f.tiebreakAt &&
      p.tiebreakPoints === f.tiebreakPoints &&
      p.finalSetMatchTiebreak === f.finalSetMatchTiebreak &&
      (!p.finalSetMatchTiebreak || p.matchTiebreakPoints === f.matchTiebreakPoints)
    );
  });
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="field field-inline">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
    </label>
  );
}

function FormatPicker({ format, onChange }: { format: MatchFormat; onChange: (f: MatchFormat) => void }) {
  const preset = presetOf(format);
  return (
    <div className="field">
      <span className="field-label">Format</span>
      <div className="segmented segmented-stack" role="radiogroup" aria-label="Format">
        {(Object.keys(FORMAT_PRESETS) as FormatPresetKey[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={preset === k}
            className={preset === k ? 'seg on' : 'seg'}
            onClick={() => onChange({ ...FORMAT_PRESETS[k], noAd: format.noAd })}
          >
            {FORMAT_PRESET_LABELS[k]}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={format.noAd} onChange={(e) => onChange({ ...format, noAd: e.target.checked })} />
        No-ad scoring (deciding point at deuce)
      </label>
      <details className="adjust">
        <summary>Adjust: {formatSummary(format)}</summary>
        <Segmented
          label="Sets"
          value={String(format.bestOf) as '1' | '3'}
          options={[
            ['3', 'Best of 3'],
            ['1', 'One set'],
          ]}
          onChange={(v) => v && onChange({ ...format, bestOf: Number(v) as 1 | 3, finalSetMatchTiebreak: v === '3' && format.finalSetMatchTiebreak })}
        />
        <NumberField label="Games to win a set" value={format.gamesPerSet} onChange={(n) => onChange({ ...format, gamesPerSet: n })} />
        <NumberField label="Set tiebreak at (games all)" value={format.tiebreakAt} onChange={(n) => onChange({ ...format, tiebreakAt: n })} />
        <NumberField label="Tiebreak points" value={format.tiebreakPoints} onChange={(n) => onChange({ ...format, tiebreakPoints: n })} />
        {format.bestOf === 3 && (
          <label className="check">
            <input
              type="checkbox"
              checked={format.finalSetMatchTiebreak}
              onChange={(e) => onChange({ ...format, finalSetMatchTiebreak: e.target.checked })}
            />
            3rd set is a match tiebreak
          </label>
        )}
        {format.bestOf === 3 && format.finalSetMatchTiebreak && (
          <NumberField
            label="Match tiebreak points"
            value={format.matchTiebreakPoints}
            onChange={(n) => onChange({ ...format, matchTiebreakPoints: n })}
          />
        )}
      </details>
    </div>
  );
}

function ScorePair({ label, value, names, onChange, onRemove }: {
  label: string;
  value: [string, string];
  names: [string, string];
  onChange: (v: [string, string]) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="score-pair">
      <span className="field-label">{label}</span>
      <input aria-label={`${label}: ${names[0]}`} inputMode="numeric" value={value[0]} onChange={(e) => onChange([e.target.value, value[1]])} />
      <span>–</span>
      <input aria-label={`${label}: ${names[1]}`} inputMode="numeric" value={value[1]} onChange={(e) => onChange([value[0], e.target.value])} />
      {onRemove && (
        <button type="button" className="btn-small" onClick={onRemove} aria-label={`Remove ${label}`}>
          ✕
        </button>
      )}
    </div>
  );
}

function SetupForm({ initial, mode, onSubmit }: { initial: Draft; mode: 'new' | 'edit'; onSubmit: (setup: MatchSetup) => string | null }) {
  const settings = useSettings();
  const matches = useMatches();
  const opponents = useMemo(() => pastOpponents(matches ?? []), [matches]);
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const names = namesFor(settings, { opponentName: d.opponentName });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const onOpponent = (name: string) => {
    setD((prev) => {
      const next = { ...prev, opponentName: name };
      const known = mode === 'new' ? findOpponent(opponents, name) : undefined;
      if (known) {
        if (!prev.opponentUtr && known.utr !== undefined) next.opponentUtr = String(known.utr);
        if (!prev.opponentHand && known.hand) next.opponentHand = known.hand;
      }
      return next;
    });
  };

  const submit = () => {
    const { setup, errors: problems } = toSetup(d, names.player);
    if (!setup) {
      setErrors(problems);
      return;
    }
    const failure = onSubmit(setup);
    setErrors(failure ? [failure] : []);
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="field">
        <span className="field-label">Opponent</span>
        <input list="past-opponents" value={d.opponentName} autoComplete="off" onChange={(e) => onOpponent(e.target.value)} />
        <datalist id="past-opponents">
          {opponents.map((o) => (
            <option key={o.name} value={o.name} />
          ))}
        </datalist>
      </label>

      <Segmented
        label={d.lateStart ? 'Who serves next?' : 'Who serves first?'}
        value={d.firstServer}
        options={[
          ['player', names.player],
          ['opponent', names.opponent],
        ]}
        onChange={(v) => set('firstServer', v)}
      />

      <FormatPicker format={d.format} onChange={(f) => set('format', f)} />

      <label className="check">
        <input type="checkbox" checked={d.lateStart} onChange={(e) => set('lateStart', e.target.checked)} />
        Charting started mid-match
      </label>
      {d.lateStart && (
        <div className="late-start">
          <p className="muted">Score when charting starts (at the start of a game), {names.player} first.</p>
          {d.startSets.map((pair, i) => (
            <ScorePair
              key={i}
              label={`Set ${i + 1}`}
              value={pair}
              names={[names.player, names.opponent]}
              onChange={(v) => set('startSets', d.startSets.map((p, j) => (j === i ? v : p)))}
              onRemove={() => set('startSets', d.startSets.filter((_, j) => j !== i))}
            />
          ))}
          {d.startSets.length < d.format.bestOf - 1 && (
            <button type="button" className="btn-small" onClick={() => set('startSets', [...d.startSets, ['', '']])}>
              + Add a finished set
            </button>
          )}
          <ScorePair label="Current set" value={d.startGames} names={[names.player, names.opponent]} onChange={(v) => set('startGames', v)} />
        </div>
      )}

      <h2 className="form-section">Details (optional)</h2>
      <label className="field">
        <span className="field-label">Date</span>
        <input type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Event</span>
        <input value={d.eventName} onChange={(e) => set('eventName', e.target.value)} placeholder="e.g. Fall Junior Open" />
      </label>
      <Segmented
        label="Event type"
        value={d.eventType}
        options={Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]}
        onChange={(v) => v && set('eventType', v)}
      />
      <label className="field">
        <span className="field-label">Round</span>
        <input value={d.round} onChange={(e) => set('round', e.target.value)} placeholder="e.g. R16, #2 singles" />
      </label>
      <Segmented
        label="Surface"
        value={d.surface}
        options={Object.entries(SURFACE_LABELS) as [Surface, string][]}
        onChange={(v) => v && set('surface', v)}
      />
      <Segmented
        label="Indoor or outdoor"
        value={d.indoor ? 'indoor' : 'outdoor'}
        options={[
          ['outdoor', 'Outdoor'],
          ['indoor', 'Indoor'],
        ]}
        onChange={(v) => v && set('indoor', v === 'indoor')}
      />
      <label className="field">
        <span className="field-label">Opponent&apos;s UTR</span>
        <input inputMode="decimal" value={d.opponentUtr} onChange={(e) => set('opponentUtr', e.target.value)} placeholder="Leave blank if unknown" />
      </label>
      <Segmented
        label="Opponent plays"
        value={d.opponentHand}
        options={[
          ['right', 'Right-handed'],
          ['left', 'Left-handed'],
        ]}
        onChange={(v) => set('opponentHand', v)}
        allowClear
      />
      <label className="field">
        <span className="field-label">{names.player}&apos;s UTR</span>
        <input inputMode="decimal" value={d.playerUtr} onChange={(e) => set('playerUtr', e.target.value)} placeholder="Leave blank if unknown" />
      </label>
      <label className="field">
        <span className="field-label">Notes</span>
        <textarea rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {errors.length > 0 && (
        <div className="error-box" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <div className="form-footer">
        <button type="submit" className="btn btn-primary">
          {mode === 'new' ? 'Start match' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function NewMatchScreen() {
  const settings = useSettings();
  const [, navigate] = useLocation();
  return (
    <div className="screen">
      <TopBar back="/" backLabel="Home" title="New match" />
      <SetupForm
        initial={newDraft(settings.lastSetup)}
        mode="new"
        onSubmit={(setup) => {
          const match = createMatch(setup);
          const defaults: SetupDefaults = {
            eventName: setup.eventName,
            eventType: setup.eventType,
            surface: setup.surface,
            indoor: setup.indoor,
            format: setup.format,
          };
          if (setup.playerUtr !== undefined) defaults.playerUtr = setup.playerUtr;
          void commitMatch(match);
          void setSetting(db, 'lastSetup', defaults);
          void setSetting(db, 'activeMatchId', match.id);
          navigate(`/match/${match.id}/chart`, { replace: true });
          return null;
        }}
      />
    </div>
  );
}

export function EditMatchScreen({ id }: { id: string }) {
  const { match, apply } = useMatchEditor(id);
  const [, navigate] = useLocation();
  const [initial, setInitial] = useState<Draft | null>(null);
  useEffect(() => {
    if (match && !initial) setInitial(draftFrom(setupOf(match)));
  }, [match, initial]);
  if (match === null) {
    return (
      <div className="screen">
        <TopBar back="/" backLabel="Home" title="Match details" />
        <p>That match no longer exists.</p>
        <Link href="/">Home</Link>
      </div>
    );
  }
  if (!match || !initial) return <div className="screen" />;
  return (
    <div className="screen">
      <TopBar back={`/match/${id}`} title="Match details" />
      <SetupForm
        initial={initial}
        mode="edit"
        onSubmit={(setup) => {
          let next: Match;
          try {
            next = updateSetup(match, setup);
          } catch (e) {
            return errorMessage(e);
          }
          apply(() => next);
          // Return to wherever details were opened from (the chart menu or the match page).
          if (history.length > 1) history.back();
          else navigate(`/match/${id}`);
          return null;
        }}
      />
    </div>
  );
}
