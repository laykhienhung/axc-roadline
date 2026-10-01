import { isNextYear } from './fiscal.js';
import type { Target } from './model.js';

/** This fiscal year's progress; next-year actions are counted separately. */
export function progress(target: Target): { done: number; total: number; nextYear: number } {
  const thisYear = target.actions.filter((a) => !isNextYear(a));
  return {
    done: thisYear.filter((a) => a.status === 'done').length,
    total: thisYear.length,
    nextYear: target.actions.length - thisYear.length,
  };
}
