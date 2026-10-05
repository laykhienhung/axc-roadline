import { describe, expect, it } from 'vitest';
import { boardColumns, nextActions, openNow, taskGroups } from '../src/shared/next-actions';
import { progress } from '../src/shared/progress';
import { DEC_TODAY, decPlan, fixturePlan, fixturePlanV21 } from './helpers';

const today = { year: 2026, month: 9, day: 28 };
const key = (n: { target: { id: string }; action: { no: number } }) =>
  `${n.target.id}#${n.action.no}`;

describe('nextActions', () => {
  it('ranks the fixture on 28 Sep 2026: monthly report, then T1 Q1 actions', () => {
    const list = nextActions(fixturePlan(), today, { limit: 5 });
    expect(list.map(key)).toEqual(['T3#9', 'T1#1', 'T1#2', 'T1#3', 'T1#4']);
    expect(list[0].nextDate).toEqual({ year: 2026, month: 9, day: 30 });
    expect(list[0].overdue).toBe(false);
  });

  it('lists overdue actions first and skips done ones', () => {
    const plan = fixturePlan();
    const t4 = plan.targets.find((t) => t.id === 'T4')!;
    t4.actions[9].due = { kind: 'month', year: 2026, month: 8 }; // T4 #10 → Aug 2026, overdue
    plan.targets[2].actions.find((a) => a.no === 9)!.status = 'done'; // T3 #9 done
    const list = nextActions(plan, today, { limit: 5 });
    expect(key(list[0])).toBe('T4#10');
    expect(list[0].overdue).toBe(true);
    expect(list.map(key)).not.toContain('T3#9');
  });

  it('scopes to one target', () => {
    const list = nextActions(fixturePlan(), today, { limit: 3, targetId: 'T2' });
    expect(list).toHaveLength(3);
    expect(list.every((n) => n.target.id === 'T2')).toBe(true);
  });
});

describe('nextActions — Behind and next year', () => {
  it('ranks Behind actions first and never lists next-year actions', () => {
    const plan = fixturePlan();
    const t4 = plan.targets.find((t) => t.id === 'T4')!;
    t4.actions[9].status = 'behind'; // T4 #10, due Aug 2027
    t4.actions[9].statusWord = 'Blocked';
    const t1 = plan.targets[0];
    t1.actions[0].quarter = 'next_year'; // T1 #1 → next year
    t1.actions[0].due = { kind: 'next_year' };
    const list = nextActions(plan, today, { limit: 5 });
    expect(key(list[0])).toBe('T4#10');
    expect(list.map(key)).not.toContain('T1#1');
  });
});

describe('progress', () => {
  it('counts done actions', () => {
    const t = fixturePlan().targets[0];
    expect(progress(t)).toEqual({ done: 0, total: 26, nextYear: 0 });
    t.actions[0].status = 'done';
    t.actions[1].quarter = 'next_year';
    expect(progress(t)).toEqual({ done: 1, total: 25, nextYear: 1 });
  });
});

describe('openNow', () => {
  const k = (i: { target: { id: string }; action: { no: number } }) =>
    `${i.target.id}#${i.action.no}`;

  it('on 28 Sep 2026 holds Q1 open actions plus recurring ones, none overdue', () => {
    const { items, counts } = openNow(fixturePlan(), today);
    expect(counts).toEqual({ open: 25, overdue: 0, thisQuarter: 21, allYear: 4, nextYear: 0 });
    expect(items.every((i) => i.action.quarter === 'Q1' || i.when === 'allYear')).toBe(true);
  });

  it('groups the Dec plan into overdue, this quarter and all year', () => {
    const plan = decPlan();
    const { items, counts } = openNow(plan, DEC_TODAY);
    expect(counts).toEqual({ open: 29, overdue: 6, thisQuarter: 19, allYear: 4, nextYear: 0 });
    expect(items.some((i) => i.action.status === 'done')).toBe(false);
    expect(items.some((i) => i.action.quarter === 'Q3' || i.action.quarter === 'Q4')).toBe(false);

    const board = boardColumns(plan, items);
    expect(board.map((c) => [c.status, c.items.length])).toEqual([
      ['behind', 3],
      ['at_risk', 4],
      ['on_track', 11],
      ['not_started', 11],
    ]);
    expect(board[0].items.map(k)).toEqual(['T1#3', 'T2#13', 'T3#2']);
    expect(board[1].items.map((i) => i.when)).toEqual([
      'overdue',
      'overdue',
      'overdue',
      'thisQuarter',
    ]);

    const groups = taskGroups(plan, items);
    expect(groups.map((g) => [g.when, g.items.length])).toEqual([
      ['overdue', 6],
      ['thisQuarter', 19],
      ['allYear', 4],
    ]);
    expect(groups[0].items[0].action.status).toBe('behind');
    expect(groups[0].items.map(k)).toEqual(['T1#3', 'T2#13', 'T3#2', 'T1#4', 'T1#15', 'T3#3']);
  });

  it('counts next-year actions but never lists them', () => {
    const { items, counts } = openNow(fixturePlanV21(), { year: 2026, month: 9, day: 29 });
    expect(counts.nextYear).toBe(14);
    expect(items.some((i) => i.action.quarter === 'next_year')).toBe(false);
  });
});
