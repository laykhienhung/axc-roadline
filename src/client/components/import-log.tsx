import { useEffect, useState } from 'react';
import type { ImportLogItem } from '../../shared/auth';
import { fetchImports } from '../api';
import { formatDateTime } from '../format';

type Outcome = ImportLogItem['outcome'];

const OUTCOME: Record<Outcome, { label: string; tone: string }> = {
  ok: { label: 'Imported', tone: 'tone-on_track' },
  needs_mapping: { label: 'Needed mapping', tone: 'tone-at_risk' },
  invalid_mapping: { label: 'Mapping refused', tone: 'tone-at_risk' },
  forbidden: { label: 'Not allowed', tone: 'tone-behind' },
  invalid_plan: { label: 'Rejected', tone: 'tone-behind' },
  no_file: { label: 'Rejected', tone: 'tone-behind' },
  file_too_large: { label: 'Rejected', tone: 'tone-behind' },
  unsupported_type: { label: 'Rejected', tone: 'tone-behind' },
};

const size = (bytes: number | null) =>
  bytes === null ? '' : ` · ${bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`}`;

type Page =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: ImportLogItem[]; nextBefore: number | null };

/** Admin › Import log: every import attempt, newest first, 50 per page. */
export function ImportLog() {
  // Cursor stack: [undefined] is the newest page; Older pushes nextBefore, Newer pops.
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [page, setPage] = useState<Page>({ status: 'loading' });
  const before = cursors[cursors.length - 1];

  useEffect(() => {
    let live = true;
    setPage({ status: 'loading' });
    fetchImports(before)
      .then((res) => live && setPage({ status: 'ready', ...res }))
      .catch(() => live && setPage({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [before]);

  if (page.status === 'loading') return <Skeleton label="Loading the import log…" />;
  if (page.status === 'error')
    return (
      <section className="card admin-empty" aria-label="Import log">
        <b>Couldn’t load the import log</b>
        <p className="muted small">Reload the page to try again.</p>
      </section>
    );
  if (page.items.length === 0 && cursors.length === 1)
    return (
      <section className="card admin-empty" aria-label="Import log">
        <b>No imports yet</b>
        <p className="muted small">Every import attempt — successful or not — shows up here.</p>
      </section>
    );

  return (
    <section className="card" aria-label="Import log">
      <table className="users audit">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>File</th>
            <th>Outcome</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((item) => (
            <tr key={item.id}>
              <td>{formatDateTime(item.at)}</td>
              <td>{item.userEmail ?? '—'}</td>
              <td>
                {item.fileName ?? '—'}
                {size(item.fileSize)}
              </td>
              <td>
                <span className={`badge ${OUTCOME[item.outcome].tone}`}>
                  {OUTCOME[item.outcome].label}
                </span>
              </td>
              <td className="muted">
                {item.detail}
                {item.current && ' (current)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar pager">
        <span className="small muted">
          {page.items.length} {page.items.length === 1 ? 'entry' : 'entries'}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="btn sm"
          disabled={cursors.length === 1}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          ← Newer
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={page.nextBefore === null}
          onClick={() => setCursors((c) => [...c, page.nextBefore ?? undefined])}
        >
          Older →
        </button>
      </div>
    </section>
  );
}

export function Skeleton({ label }: { label: string }) {
  return (
    <section className="card admin-loading" aria-busy="true">
      <div className="skeleton" />
      <div className="skeleton" style={{ width: '45%' }} />
      <div className="skeleton" style={{ width: '52%' }} />
      <span className="small muted">{label}</span>
    </section>
  );
}
