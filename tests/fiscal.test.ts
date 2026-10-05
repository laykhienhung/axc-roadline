import { describe, expect, it } from 'vitest';
import {
  currentPeriod,
  hasNextYear,
  nextFiscalLabel,
  monthColumns,
  placeMonth,
  placeQuarter,
  quarterColumns,
} from '../src/shared/fiscal';
import type { Action } from '../src/shared/model';

const plan = { fiscal: { startYear: 2026, startMonth: 9 } };

function action(over: Partial<Action>): Action {
  return {
    targetId: 'T1',
    section: 'Actions',
    no: 1,
    quarter: 'Q1',
    action: 'x',
    deliverable: 'x',
    measure: null,
    owner: 'Dev',
    due: { kind: 'month', year: 2026, month: 11 },
    status: 'not_started',
    statusWord: '',
    ...over,
  };
}

describe('fiscal calendar', () => {
  it('builds 12 month columns Sep 2026 … Aug 2027 with quarter labels', () => {
    const cols = monthColumns(plan);
    expect(cols).toHaveLength(12);
    expect(cols[0]).toMatchObject({ year: 2026, month: 9, label: 'Sep', quarter: 'Q1' });
    expect(cols[2]).toMatchObject({ month: 11, quarter: 'Q1' });
    expect(cols[9]).toMatchObject({ year: 2027, month: 6, quarter: 'Q4' });
    expect(cols[11]).toMatchObject({ year: 2027, month: 8, label: 'Aug', quarter: 'Q4' });
  });

  it('builds quarter columns with date ranges', () => {
    expect(quarterColumns(plan).map((c) => c.range)).toEqual([
      'Sep – Nov 2026',
      'Dec 2026 – Feb 2027',
      'Mar – May 2027',
      'Jun – Aug 2027',
    ]);
  });

  it('places a Feb 2027 / Q2 action in the Feb 2027 column and the Q2 column', () => {
    const a = action({ quarter: 'Q2', due: { kind: 'month', year: 2027, month: 2 } });
    const i = placeMonth(plan, a);
    expect(i).toBe(5);
    expect(monthColumns(plan)[i!]).toMatchObject({ year: 2027, month: 2 });
    expect(placeQuarter(a)).toBe(1);
  });

  it('places ongoing actions in no column', () => {
    const a = action({ quarter: 'ongoing', due: { kind: 'recurring', every: 'monthly' } });
    expect(placeMonth(plan, a)).toBeNull();
    expect(placeQuarter(a)).toBeNull();
  });

  it('finds the current period', () => {
    expect(currentPeriod(plan, { year: 2026, month: 9, day: 28 })).toEqual({
      monthIndex: 0,
      quarter: 'Q1',
      quarterIndex: 0,
    });
    expect(currentPeriod(plan, { year: 2027, month: 10, day: 1 })).toBeNull();
  });

  it('places next-year actions in the Next-year column and labels the next fiscal year', () => {
    const a = action({ quarter: 'next_year', due: { kind: 'next_year' } });
    expect(placeMonth(plan, a)).toBe(12);
    expect(placeQuarter(a)).toBe(4);
    expect(nextFiscalLabel(plan)).toBe('FY27-28');
    expect(hasNextYear({ targets: [] })).toBe(false);
  });
});
