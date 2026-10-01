import { currentPeriod, isNextYear } from './fiscal.js';
import type { Plan, Target, Ymd } from './model.js';
import { openNow } from './next-actions.js';
import { progress } from './progress.js';

export interface PlanSummary {
  /** 0..1, each target's done share weighted by its weight (this year only). */
  yearProgress: number;
  done: number;
  total: number;
  /** Open this-year actions in the current quarter; null outside the fiscal year. */
  openThisQuarter: number | null;
  overdue: number;
  /** Targets whose tone is At risk or Behind, in plan order. */
  attention: Target[];
}

export function planSummary(plan: Plan, today: Ymd): PlanSummary {
  let done = 0;
  let total = 0;
  let weighted = 0;
  let weights = 0;
  for (const t of plan.targets) {
    const p = progress(t);
    done += p.done;
    total += p.total;
    if (p.total > 0) {
      weighted += t.weight * (p.done / p.total);
      weights += t.weight;
    }
  }
  const quarter = currentPeriod(plan, today)?.quarter;
  const openThisQuarter = quarter
    ? plan.targets
        .flatMap((t) => t.actions)
        .filter((a) => a.quarter === quarter && a.status !== 'done' && !isNextYear(a)).length
    : null;
  return {
    yearProgress: weights ? weighted / weights : 0,
    done,
    total,
    openThisQuarter,
    overdue: openNow(plan, today).counts.overdue,
    attention: plan.targets.filter((t) => t.status === 'at_risk' || t.status === 'behind'),
  };
}
