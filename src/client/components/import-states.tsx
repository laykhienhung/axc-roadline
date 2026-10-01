import { useState } from 'react';
import type { Plan, Problem } from '../../shared/model';
import { formatDateTime } from '../format';
import { ImportButton } from './import-button';

export type ImportState =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'failed'; fileName: string; problems: Problem[] };

/** Problems as a Sheet / Row / Problem table. */
export function ProblemList({ problems }: { problems: Problem[] }) {
  return (
    <table className="problems">
      <thead>
        <tr>
          <th style={{ width: 320 }}>Sheet</th>
          <th style={{ width: 80 }}>Row</th>
          <th>Problem</th>
        </tr>
      </thead>
      <tbody>
        {problems.map((p, i) => (
          <tr key={i}>
            <td>{p.sheet ?? '—'}</td>
            <td className="row">{p.row ?? '—'}</td>
            <td>{p.message.charAt(0).toUpperCase() + p.message.slice(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FileIcon = () => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 17v-6" />
    <path d="m9 14 3-3 3 3" />
  </svg>
);

/** Nothing imported yet: drop zone + file picker + what a file must look like. */
export function EmptyState({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <section className="empty-state" aria-label="No plan loaded">
      <div>
        <h2>No plan loaded yet</h2>
        <p className="intro">
          Import the team’s objectives &amp; action-plan workbook and everyone with this link sees
          the same timeline. The workbook stays the source of truth — Roadline only reads it.
        </p>
      </div>
      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <span className="ico">
          <FileIcon />
        </span>
        <b>Drop the workbook here</b>
        <small>.xlsx workbook or flat .csv</small>
        <ImportButton onFile={onFile} disabled={busy} label="Choose file…" icon={false} />
      </div>
      <div className="formats">
        <div className="card fmt">
          <span>
            <span className="ext tone-on_track">.xlsx</span> <b>AXC workbook</b>
          </span>
          <ul>
            <li>
              An <b>Executive Summary</b> sheet with the fiscal period and version
            </li>
            <li>
              One sheet per target, cell A1 like <span className="mono">T1 - Build AI Tools</span>
            </li>
            <li>An action table with # · Quarter · Action · Deliverable · Owner · Due · Status</li>
          </ul>
        </div>
        <div className="card fmt">
          <span>
            <span className="ext tone-done">.csv</span> <b>Flat CSV</b>
          </span>
          <ul>
            <li>One row per action</li>
            <li>
              Required: <span className="mono">target_id, no, quarter, action, due</span>
            </li>
            <li>
              Optional: target name, weight, owner and status; section, deliverable, success measure
            </li>
          </ul>
        </div>
      </div>
      <p className="hint-line">
        An import replaces the plan for everyone. New words in the file (like “In progress”) are
        asked about once, then remembered.
      </p>
    </section>
  );
}

export function UploadingState({ fileName }: { fileName: string }) {
  return (
    <section className="card uploading" aria-label="Importing" aria-busy="true">
      <b>Uploading &amp; reading {fileName}</b>
      <div className="bar">
        <span />
      </div>
      <small>The current plan stays visible until this finishes.</small>
    </section>
  );
}

const AlertIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

export function ImportError({
  state,
  previous,
  onFile,
  onDismiss,
}: {
  state: Extract<ImportState, { kind: 'failed' }>;
  previous: Plan | null;
  onFile: (f: File) => void;
  onDismiss: () => void;
}) {
  const n = state.problems.length;
  return (
    <section className="card err" role="alert" aria-label="Import failed">
      <div className="err-h">
        <span className="ico">
          <AlertIcon />
        </span>
        <div>
          <b>Couldn&apos;t import {state.fileName}</b>
          <span>
            {n} {n === 1 ? 'problem' : 'problems'} in the file’s layout.{' '}
            {previous
              ? `Nothing was replaced — everyone still sees the import from ${formatDateTime(previous.source.importedAt)}.`
              : 'Nothing was imported.'}
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label="Dismiss" onClick={onDismiss}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <ProblemList problems={state.problems} />
      <div className="err-f">
        <span>Fix these rows in the workbook, save it, and import again.</span>
        {previous && (
          <button type="button" className="btn" onClick={onDismiss}>
            Keep current plan
          </button>
        )}
        <ImportButton onFile={onFile} label="Choose another file" icon={false} />
      </div>
    </section>
  );
}
