import { describe, expect, it } from 'vitest';
import { nounFor } from '../src/shared/noun';
import { detailProgress, progress } from '../src/shared/progress';
import { planSummary } from '../src/shared/summary';
import { fixturePlan, fixturePlanV42 } from './helpers';

const OCT = { year: 2026, month: 10, day: 1 };

describe('progress — percent mode (4.2)', () => {
  const plan = fixturePlanV42();
  const o1 = plan.targets[0];
  o1.actions[0].percent = 40; // the rest of O1 stays blank

  it('averages the this-year %, blank counting as 0', () => {
    const p = progress(o1, plan);
    expect(p).toMatchObject({ done: 0, total: 7, nextYear: 0 });
    expect(p.percent).toBeCloseTo(40 / 7, 10);
  });

  it('has no percent without the plan or in done mode', () => {
    expect(progress(o1).percent).toBeUndefined();
    expect(progress(o1, { progressBy: 'done' }).percent).toBeUndefined();
  });

  it('averages one detail', () => {
    expect(detailProgress(o1, '1.1')).toBeCloseTo(40 / 3, 10);
    expect(Math.round(detailProgress(o1, '1.1') * 10) / 10).toBe(13.3);
    expect(detailProgress(o1, '1.2')).toBe(0);
    expect(detailProgress(o1, '9.9')).toBe(0);
  });

  it('makes the year progress the average over the objectives', () => {
    plan.targets[1].actions.forEach((a) => (a.percent = 60)); // O2: 60%
    const s = planSummary(plan, OCT);
    expect(s.yearProgress).toBeCloseTo((40 / 7 / 100 + 0.6) / 6, 10);
    expect(s.total).toBe(84);
  });
});

describe('progress — done mode (2.x)', () => {
  it('keeps the share of Done actions', () => {
    const plan = fixturePlan();
    expect(plan.progressBy).toBeUndefined();
    expect(progress(plan.targets[0], plan)).toEqual({ done: 0, total: 26, nextYear: 0 });
    expect(planSummary(plan, { year: 2026, month: 9, day: 28 })).toMatchObject({
      yearProgress: 0,
      total: 75,
    });
  });
});

describe('nounFor', () => {
  it('says objective for a 4.2 plan', () => {
    expect(nounFor({ layout: 'objectives' })).toEqual({
      one: 'objective',
      many: 'objectives',
      One: 'Objective',
      Many: 'Objectives',
    });
  });

  it('says target otherwise', () => {
    expect(nounFor({ layout: 'targets' })).toEqual({
      one: 'target',
      many: 'targets',
      One: 'Target',
      Many: 'Targets',
    });
    expect(nounFor({})).toMatchObject({ one: 'target' });
    expect(nounFor(null)).toMatchObject({ One: 'Target' });
  });
});
