import type { Action, Plan, Quarter, Ymd } from './model.js';

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export interface MonthColumn {
  index: number;
  year: number;
  month: number;
  label: string;
  quarter: Quarter;
}

export interface QuarterColumn {
  index: number;
  quarter: Quarter;
  label: string;
  range: string;
}

type Fiscal = Plan['fiscal'];

function monthAt(fiscal: Fiscal, index: number): { year: number; month: number } {
  const zero = fiscal.startMonth - 1 + index;
  return { year: fiscal.startYear + Math.floor(zero / 12), month: (zero % 12) + 1 };
}

export function monthColumns(plan: Pick<Plan, 'fiscal'>): MonthColumn[] {
  return Array.from({ length: 12 }, (_, i) => {
    const { year, month } = monthAt(plan.fiscal, i);
    return {
      index: i,
      year,
      month,
      label: MONTH_SHORT[month - 1],
      quarter: QUARTERS[Math.floor(i / 3)],
    };
  });
}

export function quarterColumns(plan: Pick<Plan, 'fiscal'>): QuarterColumn[] {
  return QUARTERS.map((quarter, i) => {
    const a = monthAt(plan.fiscal, i * 3);
    const b = monthAt(plan.fiscal, i * 3 + 2);
    const range =
      a.year === b.year
        ? `${MONTH_SHORT[a.month - 1]} – ${MONTH_SHORT[b.month - 1]} ${b.year}`
        : `${MONTH_SHORT[a.month - 1]} ${a.year} – ${MONTH_SHORT[b.month - 1]} ${b.year}`;
    return { index: i, quarter, label: quarter, range };
  });
}

/** Months since fiscal start for a calendar month (may fall outside 0..11). */
export function monthIndex(fiscal: Fiscal, year: number, month: number): number {
  return (year - fiscal.startYear) * 12 + (month - fiscal.startMonth);
}

/** Month-view column for an action (12 = Next year); null for recurring or out-of-year actions. */
export function placeMonth(plan: Pick<Plan, 'fiscal'>, action: Action): number | null {
  if (action.quarter === 'next_year' || action.due.kind === 'next_year') return 12;
  if (action.due.kind !== 'month') return null;
  const i = monthIndex(plan.fiscal, action.due.year, action.due.month);
  return i >= 0 && i < 12 ? i : null;
}

/** Quarter-view column for an action (4 = Next year); null for ongoing actions. */
export function placeQuarter(action: Action): number | null {
  if (action.quarter === 'next_year') return 4;
  return action.quarter === 'ongoing' ? null : QUARTERS.indexOf(action.quarter);
}

export const isNextYear = (action: Action) => action.quarter === 'next_year';

export function hasNextYear(plan: Pick<Plan, 'targets'>): boolean {
  return plan.targets.some((t) => t.actions.some(isNextYear));
}

/** "FY27-28" for a plan whose fiscal year starts in 2026. */
export function nextFiscalLabel(plan: Pick<Plan, 'fiscal'>): string {
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `FY${yy(plan.fiscal.startYear + 1)}-${yy(plan.fiscal.startYear + 2)}`;
}

export function currentPeriod(
  plan: Pick<Plan, 'fiscal'>,
  today: Ymd
): { monthIndex: number; quarter: Quarter; quarterIndex: number } | null {
  const i = monthIndex(plan.fiscal, today.year, today.month);
  if (i < 0 || i > 11) return null;
  const q = Math.floor(i / 3);
  return { monthIndex: i, quarter: QUARTERS[q], quarterIndex: q };
}

export function lastDayOfMonth(year: number, month: number): Ymd {
  return { year, month, day: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

/** Last day of the fiscal quarter containing `day` (quarters continue past the plan year). */
export function lastDayOfFiscalQuarter(fiscal: Fiscal, day: Ymd): Ymd {
  const i = monthIndex(fiscal, day.year, day.month);
  const q = Math.floor(i / 3);
  const end = monthAt(fiscal, q * 3 + 2);
  return lastDayOfMonth(end.year, end.month);
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function parseYmd(text: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

export function ymdFromDate(d: Date): Ymd {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
