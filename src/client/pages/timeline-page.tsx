import { useCallback, useState } from 'react';
import { canImport, type Me } from '../../shared/auth';
import type { Mappings, Plan, UnknownValue } from '../../shared/model';
import { uploadPlan } from '../api';
import { ActionDrawer } from '../components/action-drawer';
import { AppHeader } from '../components/app-header';
import { ImportButton } from '../components/import-button';
import { ImportMappingDialog } from '../components/import-mapping-dialog';
import { ImportNotes, type Notes } from '../components/import-notes';
import {
  EmptyState,
  ImportError,
  type ImportState,
  UploadingState,
  ViewerEmptyState,
} from '../components/import-states';
import { type ActionRef, TimelineTree } from '../components/timeline-tree';
import type { PlanState } from '../use-plan';
import { useToday } from '../use-today';

const NO_NOTES: Notes = { applied: [], warnings: [] };

/** The file waiting for a mapping; kept so "Apply & import" can send it again. */
interface Pending {
  file: File;
  unknown: UnknownValue[];
  applying: boolean;
}

export function TimelinePage({
  state,
  replace,
  me,
}: {
  state: PlanState;
  replace: (plan: Plan) => void;
  me: Me;
}) {
  const today = useToday();
  const [selected, setSelected] = useState<ActionRef | null>(null);
  const closeDrawer = useCallback(() => setSelected(null), []);
  const [imp, setImp] = useState<ImportState>({ kind: 'idle' });
  const [pending, setPending] = useState<Pending | null>(null);
  const [notes, setNotes] = useState<Notes>(NO_NOTES);
  const plan = state.status === 'ready' ? state.plan : null;
  const editable = canImport(me.role);
  const busy = imp.kind === 'uploading' || pending !== null;

  async function send(file: File, mapping?: Omit<Mappings, 'seenVersions'>) {
    const res = await uploadPlan(file, mapping);
    setPending(null);
    if (res.ok) {
      replace(res.plan);
      setImp({ kind: 'idle' });
      setNotes({ applied: res.applied, warnings: res.warnings });
    } else if ('needsMapping' in res) {
      setImp({ kind: 'idle' });
      setPending({ file, unknown: res.needsMapping, applying: false });
    } else {
      setImp({ kind: 'failed', fileName: file.name, problems: res.problems });
    }
  }

  function onFile(file: File) {
    setNotes(NO_NOTES);
    setImp({ kind: 'uploading', fileName: file.name });
    void send(file);
  }

  return (
    <>
      <AppHeader
        plan={plan}
        me={me}
        actions={
          editable ? (
            <ImportButton onFile={onFile} disabled={busy} />
          ) : (
            <span className="readonly">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="lbl">Read-only</span>
            </span>
          )
        }
      />
      <main className={plan && selected ? 'with-drawer' : undefined}>
        <ImportNotes notes={notes} />
        {imp.kind === 'uploading' && <UploadingState fileName={imp.fileName} />}
        {imp.kind === 'failed' && (
          <ImportError
            state={imp}
            previous={plan}
            onFile={onFile}
            onDismiss={() => setImp({ kind: 'idle' })}
          />
        )}
        {state.status === 'loading' && <p className="muted">Loading plan…</p>}
        {state.status === 'error' && (
          <section className="card state err" role="alert">
            <b>Couldn&apos;t load the plan</b>
            <span>{state.message}</span>
          </section>
        )}
        {state.status === 'empty' &&
          (editable ? <EmptyState onFile={onFile} busy={busy} /> : <ViewerEmptyState />)}
        {plan && (
          <TimelineTree plan={plan} today={today} selected={selected} onSelect={setSelected} />
        )}
      </main>
      {plan && selected && (
        <ActionDrawer
          plan={plan}
          today={today}
          selected={selected}
          onSelect={setSelected}
          onClose={closeDrawer}
        />
      )}
      {pending && (
        <ImportMappingDialog
          fileName={pending.file.name}
          unknown={pending.unknown}
          applying={pending.applying}
          onApply={(mapping) => {
            setPending({ ...pending, applying: true });
            void send(pending.file, mapping);
          }}
          onCancel={() => {
            setNotes({ ...NO_NOTES, cancelled: pending.file.name });
            setPending(null);
          }}
        />
      )}
    </>
  );
}
