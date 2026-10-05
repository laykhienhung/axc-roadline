import { isNextYear } from './fiscal.js';
import type { Action, Plan, Target } from './model.js';

export interface Progress {
  done: number;
  total: number;
  nextYear: number;
  /** Percent mode only: average % of this year's actions (blank = 0), 0..100. */
  percent?: number;
}

/** Average `%` of actions, blank counting as 0; 0 when there are none. */
function averagePercent(actions: Action[]): number {
  if (actions.length === 0) return 0;
  return actions.reduce((sum, a) => sum + (a.percent ?? 0), 0) / actions.length;
}

/**
 * This fiscal year's progress; next-year actions are counted separately. In a plan read with a
 * `%` column (`progressBy: 'percent'`) it also has the average %.
 */
export function progress(target: Target, plan?: Pick<Plan, 'progressBy'>): Progress {
  const thisYear = target.actions.filter((a) => !isNextYear(a));
  const out: Progress = {
    done: thisYear.filter((a) => a.status === 'done').length,
    total: thisYear.length,
    nextYear: target.actions.length - thisYear.length,
  };
  if (plan?.progressBy === 'percent') out.percent = averagePercent(thisYear);
  return out;
}

/** Average % (0..100) of one objective detail's this-year actions. */
export function detailProgress(target: Target, detailId: string): number {
  return averagePercent(target.actions.filter((a) => a.detailId === detailId && !isNextYear(a)));
}
