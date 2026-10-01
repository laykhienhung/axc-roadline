import {
  compareYmd,
  currentPeriod,
  isNextYear,
  lastDayOfFiscalQuarter,
  lastDayOfMonth,
} from './fiscal.js';
import type { Action, Plan, Status, Target, Ymd } from './model.js';

export interface NextAction {
  action: Action;
  target: Target;
  nextDate: Ymd;
  overdue: boolean;
}

/** When an open action is next due, seen from `today`. */
export function nextDate(plan: Pick<Plan, 'fiscal'>, action: Action, today: Ymd): Ymd {
  if (action.due.kind === 'month') return lastDayOfMonth(action.due.year, action.due.month);
  if (action.due.kind === 'next_year')
    return lastDayOfMonth(plan.fiscal.startYear + 2, plan.fiscal.startMonth);
  if (action.due.every === 'monthly') return lastDayOfMonth(today.year, today.month);
  return lastDayOfFiscalQuarter(plan.fiscal, today);
}

/**
 * Open actions of this fiscal year ranked: overdue or Behind first, then next due date, then
 * target weight (high first), then target order, then action number.
 */
export function nextActions(
  plan: Plan,
  today: Ymd,
  opts: { limit: number; targetId?: string }
): NextAction[] {
  const order = new Map(plan.targets.map((t, i) => [t.id, i]));
  const items: NextAction[] = [];
  for (const target of plan.targets) {
    if (opts.targetId && target.id !== opts.targetId) continue;
    for (const action of target.actions) {
      if (action.status === 'done' || isNextYear(action)) continue;
      const d = nextDate(plan, action, today);
      items.push({ action, target, nextDate: d, overdue: compareYmd(d, today) < 0 });
    }
  }
  const urgent = (n: NextAction) => n.overdue || n.action.status === 'behind';
  items.sort(
    (a, b) =>
      Number(urgent(b)) - Number(urgent(a)) ||
      compareYmd(a.nextDate, b.nextDate) ||
      b.target.weight - a.target.weight ||
      order.get(a.target.id)! - order.get(b.target.id)! ||
      a.action.no - b.action.no
  );
  return items.slice(0, opts.limit);
}

/** Where an open action sits in the Next-actions window. */
export type When = 'overdue' | 'thisQuarter' | 'allYear';

export interface OpenItem extends NextAction {
  when: When;
}

export interface OpenNow {
  items: OpenItem[];
  counts: { open: number; overdue: number; thisQuarter: number; allYear: number; nextYear: number };
}

/**
 * Open this-year actions that need attention now: overdue, due in the current quarter, or
 * recurring (all year). Later quarters and next-year actions are left out.
 */
export function openNow(plan: Plan, today: Ymd): OpenNow {
  const quarter = currentPeriod(plan, today)?.quarter;
  const items: OpenItem[] = [];
  for (const n of nextActions(plan, today, { limit: Infinity })) {
    const when: When | null = n.overdue
      ? 'overdue'
      : n.action.due.kind === 'recurring'
        ? 'allYear'
        : quarter && n.action.quarter === quarter
          ? 'thisQuarter'
          : null;
    if (when) items.push({ ...n, when });
  }
  const count = (w: When) => items.filter((i) => i.when === w).length;
  const nextYear = plan.targets
    .flatMap((t) => t.actions)
    .filter((a) => isNextYear(a) && a.status !== 'done').length;
  return {
    items,
    counts: {
      open: items.length,
      overdue: count('overdue'),
      thisQuarter: count('thisQuarter'),
      allYear: count('allYear'),
      nextYear,
    },
  };
}

const WHEN_ORDER: When[] = ['overdue', 'thisQuarter', 'allYear'];
export const OPEN_TONES: Exclude<Status, 'done'>[] = [
  'behind',
  'at_risk',
  'on_track',
  'not_started',
];

/** Ties: target weight (high first), then target order, then action number. */
function tieBreak(plan: Plan) {
  const order = new Map(plan.targets.map((t, i) => [t.id, i]));
  return (a: OpenItem, b: OpenItem) =>
    b.target.weight - a.target.weight ||
    order.get(a.target.id)! - order.get(b.target.id)! ||
    a.action.no - b.action.no;
}

/** Board: one column per open tone; overdue first in each, then this quarter, then all year. */
export function boardColumns(
  plan: Plan,
  items: OpenItem[]
): { status: Exclude<Status, 'done'>; items: OpenItem[] }[] {
  const tie = tieBreak(plan);
  return OPEN_TONES.map((status) => ({
    status,
    items: items
      .filter((i) => i.action.status === status)
      .sort((a, b) => WHEN_ORDER.indexOf(a.when) - WHEN_ORDER.indexOf(b.when) || tie(a, b)),
  }));
}

/** Tasks: one group per `when`; Behind first in each, then At risk, On track, Not started. */
export function taskGroups(plan: Plan, items: OpenItem[]): { when: When; items: OpenItem[] }[] {
  const tie = tieBreak(plan);
  const tone = (i: OpenItem) => OPEN_TONES.indexOf(i.action.status as Exclude<Status, 'done'>);
  return WHEN_ORDER.map((when) => ({
    when,
    items: items.filter((i) => i.when === when).sort((a, b) => tone(a) - tone(b) || tie(a, b)),
  }));
}
