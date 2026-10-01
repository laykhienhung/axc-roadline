import { useState } from 'react';
import type { Mappings, MappingField, Status, UnknownValue } from '../../shared/model';
import { normWord } from '../../shared/suggest';
import { MEANING_OPTIONS } from '../meanings';
import { StatusBadge } from './status-dot';

const GROUPS: [MappingField, string][] = [
  ['status', 'Status'],
  ['quarter', 'Quarter'],
  ['due', 'Due'],
];

function found(u: UnknownValue): { main: string; detail: string } {
  const n = `${u.count} ${u.count === 1 ? 'action' : 'actions'}`;
  if (u.fromDropdown) return { main: n, detail: "listed in the file's Status dropdown" };
  const bySheet = new Map<string, number[]>();
  for (const w of u.where)
    bySheet.set(w.sheet ?? '', [...(bySheet.get(w.sheet ?? '') ?? []), w.row]);
  const detail = [...bySheet]
    .map(
      ([sheet, rows]) =>
        `${sheet ? sheet.split(' ')[0] + ' ' : ''}row${rows.length > 1 ? 's' : ''} ${rows.join(', ')}`
    )
    .join(', ');
  return { main: n, detail: u.count > u.where.length ? `${detail}, …` : detail };
}

/**
 * Asks what each new word in an uploaded file means, pre-filled with suggestions.
 * `onApply` receives the mapping to send with the same file.
 */
export function ImportMappingDialog({
  fileName,
  unknown,
  applying,
  onApply,
  onCancel,
}: {
  fileName: string;
  unknown: UnknownValue[];
  applying: boolean;
  onApply: (mapping: Omit<Mappings, 'seenVersions'>) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(unknown.map((u) => [`${u.field}|${u.word}`, u.suggestion]))
  );
  const nextYearRows = unknown.some(
    (u) => u.field === 'quarter' && choice[`quarter|${u.word}`] === 'next_year'
  );

  function apply() {
    const mapping = { status: {}, quarter: {}, due: {} } as Omit<Mappings, 'seenVersions'>;
    for (const u of unknown)
      (mapping[u.field] as Record<string, string>)[normWord(u.word)] =
        choice[`${u.field}|${u.word}`];
    onApply(mapping);
  }

  return (
    <div className="scrim">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Map new values">
        <div className="dlg-h">
          <h2>
            This file uses {unknown.length} {unknown.length === 1 ? 'word' : 'words'} Roadline
            doesn’t know yet
          </h2>
          <p>
            Choose what each one means in <b>{fileName}</b>. We’ve pre-filled our best guess. Your
            answer is remembered for every future import.
          </p>
        </div>
        <div className="dlg-b">
          {GROUPS.map(([field, title]) => {
            const rows = unknown.filter((u) => u.field === field);
            if (!rows.length) return null;
            return (
              <div className="group" key={field} data-field={field}>
                <h3>{title}</h3>
                {rows.map((u) => {
                  const key = `${u.field}|${u.word}`;
                  const f = found(u);
                  const id = `map-${u.field}-${normWord(u.word) || 'blank'}`;
                  return (
                    <div className="map-row" key={key}>
                      <span className="word">“{u.word || '(blank)'}”</span>
                      <span className="found">
                        {f.main}
                        <small>{f.detail}</small>
                      </span>
                      <span className="means">
                        <span id={`${id}-l`}>
                          Means{choice[key] === u.suggestion ? ' · suggested' : ''}
                        </span>
                        <select
                          id={id}
                          aria-label={`Meaning of ${u.word}`}
                          value={choice[key]}
                          disabled={applying}
                          onChange={(e) => setChoice({ ...choice, [key]: e.target.value })}
                        >
                          {MEANING_OPTIONS[field].map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </span>
                      {field === 'status' ? (
                        <StatusBadge status={choice[key] as Status} word={u.word} />
                      ) : field === 'quarter' && choice[key] === 'next_year' ? (
                        <span className="note">Kept out of this year’s progress</span>
                      ) : field === 'due' && choice[key] === 'quarter_end' ? (
                        <span className="note">Uses the last month of its quarter</span>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
                {field === 'quarter' && nextYearRows && (
                  <div className="info">
                    The due date on next-year actions follows the quarter — nothing to choose.
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="dlg-f">
          <small>
            Saved for everyone using Roadline. To change a mapping later, edit{' '}
            <code>data/mappings.json</code> on the server.
          </small>
          <button type="button" className="btn" disabled={applying} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={applying} onClick={apply}>
            {applying ? (
              <>
                <span className="spin" />
                Importing…
              </>
            ) : (
              'Apply & import'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
