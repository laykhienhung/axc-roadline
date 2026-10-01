import { useState } from 'react';
import type { AppliedMapping, Problem } from '../../shared/model';
import { meaningLabel } from '../meanings';

export interface Notes {
  applied: AppliedMapping[];
  warnings: Problem[];
  cancelled?: string;
}

function Line({ kind, children }: { kind: 'info' | 'warn'; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className={`note-line ${kind}`} role={kind === 'warn' ? 'status' : undefined}>
      {kind === 'warn' ? '⚠' : 'ⓘ'} <span>{children}</span>
      <button
        type="button"
        className="x"
        title="Dismiss"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
      >
        ×
      </button>
    </div>
  );
}

/** Dismissable notes shown after an import: applied mappings, warnings, or a cancelled import. */
export function ImportNotes({ notes }: { notes: Notes }) {
  if (!notes.applied.length && !notes.warnings.length && !notes.cancelled) return null;
  return (
    <div className="notes" aria-label="Import notes">
      {notes.cancelled && (
        <Line kind="info">Import cancelled — {notes.cancelled} was not imported.</Line>
      )}
      {notes.applied.length > 0 && (
        <Line kind="info">
          Applied saved mappings:{' '}
          {notes.applied.map((m, i) => (
            <span key={`${m.field}|${m.word}`}>
              {i > 0 && ' · '}
              <b>{m.word}</b> → {meaningLabel(m.field, m.meaning)}
            </span>
          ))}
        </Line>
      )}
      {notes.warnings.map((w, i) => (
        <Line key={i} kind="warn">
          {w.message.charAt(0).toUpperCase() + w.message.slice(1)}. Shown once for this version.
        </Line>
      ))}
    </div>
  );
}
