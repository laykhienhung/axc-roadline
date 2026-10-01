import { MONTH_SHORT, monthColumns } from '../shared/fiscal';
import type { Action, Plan, Ymd } from '../shared/model';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp → "28 Sep 2026 14:02" in local time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Sep 2026 – Aug 2027" */
export function fiscalRange(plan: Plan): string {
  const cols = monthColumns(plan);
  const a = cols[0];
  const b = cols[11];
  return `${a.label} ${a.year} – ${b.label} ${b.year}`;
}

/** Due text for tables: "Nov 2026" / "monthly" / "quarterly" / "Next year". */
export function dueLong(action: Action): string {
  if (action.due.kind === 'recurring') return action.due.every;
  if (action.due.kind === 'next_year') return 'Next year';
  return `${MONTH_SHORT[action.due.month - 1]} ${action.due.year}`;
}

export const percent = (w: number) => `${Math.round(w * 100)}%`;

/** Short due text for Next-actions cards and rows: "Overdue · Nov", "Due Feb", "↻ monthly". */
export function dueShort(item: { action: Action; overdue: boolean }): string {
  const { due } = item.action;
  if (due.kind === 'recurring') return `↻ ${due.every}`;
  if (due.kind === 'next_year') return 'Next year';
  const month = MONTH_SHORT[due.month - 1];
  return item.overdue ? `Overdue · ${month}` : `Due ${month}`;
}
