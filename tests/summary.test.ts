import { describe, expect, it } from 'vitest';
import { planSummary } from '../src/shared/summary';
import { DEC_TODAY, decPlan, fixturePlan } from './helpers';

describe('planSummary', () => {
  it('starts the year at zero', () => {
    const s = planSummary(fixturePlan(), { year: 2026, month: 9, day: 28 });
    expect(s).toMatchObject({
      yearProgress: 0,
      done: 0,
      total: 75,
      openThisQuarter: 21,
      overdue: 0,
    });
    expect(s.attention).toEqual([]);
  });

  it('summarises the Dec plan', () => {
    const s = planSummary(decPlan(), DEC_TODAY);
    expect(Math.round(s.yearProgress * 100)).toBe(19);
    expect(s).toMatchObject({ done: 15, total: 75, openThisQuarter: 19, overdue: 6 });
    expect(s.attention.map((t) => t.id)).toEqual(['T1', 'T3']);
  });

  it('has no current quarter outside the fiscal year', () => {
    expect(
      planSummary(fixturePlan(), { year: 2027, month: 10, day: 1 }).openThisQuarter
    ).toBeNull();
  });
});
