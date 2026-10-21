import type { ReactNode } from 'react';
import { Link } from 'wouter';

export function TopBar({ back, backLabel = 'Back', title, right }: { back?: string; backLabel?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-side">
        {back && (
          <Link href={back} className="topbar-back">
            ‹ {backLabel}
          </Link>
        )}
      </div>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-side topbar-right">{right}</div>
    </header>
  );
}

/** A panel that slides up from the bottom; tapping outside closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">{title}</h2>
        {children}
        <button type="button" className="btn btn-plain" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** A row of mutually exclusive choices. Tapping the selected one again clears it when `allowClear`. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  allowClear = false,
}: {
  label: string;
  value: T | undefined;
  options: readonly (readonly [T, string])[];
  onChange: (value: T | undefined) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={value === v ? 'seg on' : 'seg'}
            onClick={() => onChange(value === v && allowClear ? undefined : v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="error-box" role="alert">
      {message}
    </div>
  );
}
