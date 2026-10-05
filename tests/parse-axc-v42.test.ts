import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGrid } from '../src/server/read-grid';
import type { Grid, ParseResult, Plan, Problem, UnknownValue } from '../src/shared/model';
import { parseAxcWorkbook } from '../src/shared/parse-axc';
import { quarterEnd } from '../src/shared/resolve';
import { FIXTURE_V42, parseFixture, V42_MAPPINGS } from './helpers';

const { grid, dropdowns } = readGrid(readFileSync(FIXTURE_V42), 'v42.xlsx');
const clone = (): Grid => structuredClone(grid);
const parse = (g: Grid, mappings = V42_MAPPINGS): ParseResult =>
  parseAxcWorkbook(g, 'v42.xlsx', '2026-10-01T00:00:00Z', { mappings, dropdowns });

function planOf(res: ParseResult): Plan {
  if (!res.ok) throw new Error(JSON.stringify(res));
  return res.plan;
}
function problemsOf(res: ParseResult): Problem[] {
  if (res.ok || !('problems' in res)) throw new Error('expected problems: ' + JSON.stringify(res));
  return res.problems;
}
function unknownOf(res: ParseResult): UnknownValue[] {
  if (res.ok || !('needsMapping' in res))
    throw new Error('expected needsMapping: ' + JSON.stringify(res));
  return res.needsMapping;
}
/** Zero-based row index of action `no` on a sheet. */
const actionRow = (rows: Grid[string], no: number) =>
  rows.findIndex((r, i) => i > 8 && r?.[0] === no);

describe('4.2 workbook — with V42_MAPPINGS', () => {
  const res = parseFixture(FIXTURE_V42, V42_MAPPINGS);
  const plan = planOf(res);
  const o1 = plan.targets[0];

  it('reads six objectives with 84 actions', () => {
    expect(plan.layout).toBe('objectives');
    expect(plan.progressBy).toBe('percent');
    expect(plan.targets.map((t) => t.id)).toEqual(['O1', 'O2', 'O3', 'O4', 'O5', 'O6']);
    expect(plan.targets.map((t) => t.name)).toEqual([
      'Strategy & Roadmap',
      'Process Change',
      'Tools & Licenses',
      'People & Skills',
      'Measurement & AML',
      'Safety & Governance',
    ]);
    expect(plan.targets.map((t) => t.actions.length)).toEqual([7, 21, 15, 14, 12, 15]);
    expect(plan.targets.flatMap((t) => t.actions)).toHaveLength(84);
  });

  it('reads version 4.2 without a "newer than tested" warning', () => {
    expect(plan.templateVersion).toBe('4.2');
    if (!res.ok) throw new Error();
    expect(res.warnings).toEqual([]);
  });

  it('takes the fiscal year from the Start month (Oct 2026 – Sep 2027)', () => {
    expect(plan.fiscal).toEqual({ startYear: 2026, startMonth: 10 });
    expect(quarterEnd(plan.fiscal, 'Q1')).toEqual({ kind: 'month', year: 2026, month: 12 });
    expect(quarterEnd(plan.fiscal, 'Q4')).toEqual({ kind: 'month', year: 2027, month: 9 });
    expect(o1.actions[0].due).toEqual({ kind: 'month', year: 2026, month: 10 });
  });

  it('gives every objective an equal weight', () => {
    for (const t of plan.targets) {
      expect(t.weight).toBeCloseTo(1 / 6, 10);
      expect(t.weightSource).toBe('equal');
    }
  });

  it('reads target header facts (owner, status)', () => {
    expect(o1).toMatchObject({ owner: 'AXC Lead + Coordinator', status: 'not_started' });
  });

  it('reads the 4.2 columns of O1 action 2', () => {
    const a = o1.actions.find((x) => x.no === 2)!;
    expect(a).toMatchObject({
      partners: 'BOD sponsor',
      percent: null,
      deliverable: a.action,
      measure: null,
      status: 'on_track',
      statusWord: 'In progress',
    });
    expect(a.action).toBe('Write strategy + roadmap');
    expect(a.references).toEqual([
      '[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027.xlsx',
      'AXC_AI_Transformation_Objectives_BOD.xlsx',
      'AXC_AI_Transformation_Objectives.pptx',
    ]);
    expect(a.note).toMatch(/^Roadmap \+ objectives drafted/);
  });

  it('reads O1 details 1.1 and 1.2 and links the actions to them', () => {
    expect(o1.details).toHaveLength(2);
    expect(o1.details![0]).toEqual({
      id: '1.1',
      title: 'AI strategy & roadmap approved',
      goal: 'One company AI strategy and 12-month roadmap, approved by the BOD, that all functions follow.',
      needsFirst: expect.stringMatching(/^BOD names a sponsor/),
      jd: '1.1, 1.2',
    });
    expect(o1.details![1]).toMatchObject({ id: '1.2', title: 'Quarterly transformation review' });
    expect(o1.actions.map((a) => a.detailId)).toEqual([
      '1.1',
      '1.1',
      '1.1',
      '1.2',
      '1.2',
      '1.2',
      '1.2',
    ]);
    expect(o1.actions[0].section).toBe('1.1 · AI strategy & roadmap approved');
    expect(o1.actions[3].section).toBe('1.2 · Quarterly transformation review');
  });

  it('reads 18 details and never counts a detail row as an action', () => {
    expect(plan.targets.map((t) => t.details?.length)).toEqual([2, 4, 3, 3, 3, 3]);
    const actions = plan.targets.flatMap((t) => t.actions);
    expect(actions.every((a) => Number.isInteger(a.no))).toBe(true);
  });

  it('places a mapped free-text due word ("Per BOD schedule", ongoing)', () => {
    const a = o1.actions.find((x) => x.no === 7)!;
    expect(a.quarter).toBe('ongoing');
    expect(a.due).toEqual({ kind: 'recurring', every: 'quarterly' });
  });
});

describe('4.2 workbook — without mappings', () => {
  it('asks for the five due words and "In progress"', () => {
    const unknown = unknownOf(parseFixture(FIXTURE_V42));
    const fromRows = unknown.filter((u) => !u.fromDropdown);
    expect(fromRows.map((u) => `${u.field}:${u.word}`).sort()).toEqual([
      'due:Per BOD review',
      'due:Per BOD schedule',
      'due:Per course',
      'due:Per pilot',
      'due:Yearly',
      'status:In progress',
    ]);
  });
});

describe('4.2 workbook — synthetic changes', () => {
  it('rejects plan sheets that mix T and O ids', () => {
    const g = clone();
    g['O2 Process'][0][0] = 'T2 - Process Change';
    expect(problemsOf(parse(g))).toContainEqual({ message: 'plan sheets mix T… and O… ids' });
  });

  it('rejects a summary with neither a period text nor a Start month', () => {
    const g = clone();
    const rows = g['Executive Summary'];
    rows[rows.findIndex((r) => r[0] === 'Start month (M1)')] = [];
    const problems = problemsOf(parse(g));
    expect(problems).toHaveLength(1);
    expect(problems[0].sheet).toBe('Executive Summary');
    expect(problems[0].message).toMatch(/September 2026 - August 2027/);
    expect(problems[0].message).toMatch(/Start month \(M1\)/);
  });

  it('lets a period text win over the Start month', () => {
    const g = clone();
    g['Executive Summary'][1][0] = 'September 2026 - August 2027';
    // Oct 2026 – Sep 2027 dues now partly fall outside Sep 2026 – Aug 2027.
    const problems = problemsOf(parse(g));
    expect(problems[0].message).toBe('due month is outside the fiscal year');
  });

  it('reports "weight not found" on sheets without a Weight label when another has one', () => {
    const g = clone();
    g['O1 Strategy'][2] = ['Weight', null, 0.5];
    const problems = problemsOf(parse(g));
    expect(problems.map((p) => p.sheet)).toEqual([
      'O2 Process',
      'O3 Tools',
      'O4 People',
      'O5 Measurement',
      'O6 Governance',
    ]);
    expect(problems[0]).toEqual({ sheet: 'O2 Process', row: 2, message: 'weight not found' });
  });

  it('keeps today’s problem for a Weight label with a bad value', () => {
    const g = clone();
    for (const s of Object.keys(g).filter((n) => /^O\d/.test(n))) g[s][2] = ['Weight', null, 'x'];
    expect(problemsOf(parse(g))).toContainEqual({
      sheet: 'O1 Strategy',
      row: 2,
      message: 'weight not found or not a number',
    });
  });

  it('reads % as 0.4 / 40 / "40%" → 40 and rejects 150', () => {
    const g = clone();
    const rows = g['O1 Strategy'];
    const pct = 7; // column H
    rows[actionRow(rows, 1)][pct] = 0.4;
    rows[actionRow(rows, 2)][pct] = 40;
    rows[actionRow(rows, 3)][pct] = '40%';
    const ok = planOf(parse(structuredClone(g)));
    expect(ok.targets[0].actions.map((a) => a.percent)).toEqual([
      40,
      40,
      40,
      null,
      null,
      null,
      null,
    ]);

    rows[actionRow(rows, 4)][pct] = 150;
    expect(problemsOf(parse(g))).toEqual([
      { sheet: 'O1 Strategy', row: actionRow(rows, 4) + 1, message: '% must be 0–100' },
    ]);
  });
});
