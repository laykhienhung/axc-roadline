import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGrid } from '../src/server/read-grid';
import type { ParseResult, Plan, UnknownValue } from '../src/shared/model';
import { parseAxcWorkbook } from '../src/shared/parse-axc';
import { progress } from '../src/shared/progress';
import { FIXTURE, FIXTURE_V21, parseFixture, V21_MAPPINGS } from './helpers';

function unknownOf(res: ParseResult): UnknownValue[] {
  if (res.ok || !('needsMapping' in res))
    throw new Error('expected needsMapping: ' + JSON.stringify(res));
  return res.needsMapping;
}

function planOf(res: ParseResult): Plan {
  if (!res.ok) throw new Error(JSON.stringify(res));
  return res.plan;
}

describe('v2.1 workbook — dropdown lists', () => {
  it('reads the status dropdowns per sheet (mapped through workbook relationships)', () => {
    const { dropdowns } = readGrid(readFileSync(FIXTURE_V21), 'v21.xlsx');
    expect(dropdowns['T1 Apply']).toEqual([
      { ref: 'G2', values: ['Not started', 'On track', 'At risk', 'Behind', 'Done'] },
      { ref: 'H20:H31 H33:H48', values: ['Not started', 'In progress', 'Done', 'Blocked'] },
    ]);
    expect(dropdowns['T3 Management'][1].ref).toBe('H20:H29 H31:H40');
  });
});

describe('v2.1 workbook — without mappings', () => {
  const unknown = unknownOf(parseFixture(FIXTURE_V21));
  const find = (word: string) => unknown.find((u) => u.word === word)!;

  it('asks for exactly In progress, Blocked and FY27-28', () => {
    expect(unknown.map((u) => `${u.field}:${u.word}`).sort()).toEqual([
      'quarter:FY27-28',
      'status:Blocked',
      'status:In progress',
    ]);
  });

  it('counts rows, keeps locations and suggests meanings', () => {
    expect(find('In progress')).toMatchObject({
      count: 7,
      fromDropdown: false,
      suggestion: 'on_track',
    });
    expect(find('In progress').where[0]).toEqual({ sheet: 'T1 Apply', row: 23 });
    expect(find('Blocked')).toMatchObject({ count: 0, fromDropdown: true, suggestion: 'behind' });
    expect(find('FY27-28')).toMatchObject({ count: 14, suggestion: 'next_year' });
  });
});

describe('v2.1 workbook — with mappings', () => {
  const res = parseFixture(FIXTURE_V21, V21_MAPPINGS);
  const plan = planOf(res);
  const t1 = plan.targets[0];

  it('imports with next-year actions and this-year progress', () => {
    expect(progress(t1)).toEqual({ done: 2, total: 12, nextYear: 7 });
    const thisYear = plan.targets.reduce((n, t) => n + progress(t).total, 0);
    expect(thisYear).toBe(52);
    const next = t1.actions.find((a) => a.no === 8)!;
    expect(next).toMatchObject({ quarter: 'next_year', due: { kind: 'next_year' } });
  });

  it('keeps the file word with the mapped tone', () => {
    expect(t1.actions.find((a) => a.no === 4)).toMatchObject({
      status: 'on_track',
      statusWord: 'In progress',
    });
    expect(t1).toMatchObject({ status: 'on_track', statusWord: 'On track' });
  });

  it('lists the mappings the file used', () => {
    if (!res.ok) throw new Error();
    expect(res.applied.map((m) => `${m.field}:${m.word}→${m.meaning}`).sort()).toEqual([
      'quarter:FY27-28→next_year',
      'status:Blocked→behind',
      'status:In progress→on_track',
    ]);
  });

  it('warns about the newer template version until it has been seen', () => {
    if (!res.ok) throw new Error();
    expect(res.warnings).toContainEqual(
      expect.objectContaining({ message: 'template version 2.1 is newer than tested 2.0' })
    );
    const again = parseFixture(FIXTURE_V21, { ...V21_MAPPINGS, seenVersions: ['2.1'] });
    if (!again.ok) throw new Error();
    expect(again.warnings).toEqual([]);
  });
});

describe('v2.1 workbook — due words and layout', () => {
  const { grid, dropdowns } = readGrid(readFileSync(FIXTURE_V21), 'v21.xlsx');
  const rows = grid['T1 Apply'];
  const q3 = rows.findIndex((r) => r[0] === 7 && r[1] === 'Q3'); // T1 #7, Q3, May 2027

  it('asks for a due word on a normal quarter, then places it at the quarter end', () => {
    const g = structuredClone(grid);
    g['T1 Apply'][q3][6] = 'TBD';
    const first = parseAxcWorkbook(g, 'v21.xlsx', 'x', { mappings: V21_MAPPINGS, dropdowns });
    expect(unknownOf(first)).toEqual([
      expect.objectContaining({ field: 'due', word: 'TBD', suggestion: 'quarter_end' }),
    ]);
    const res = parseAxcWorkbook(g, 'v21.xlsx', 'x', {
      mappings: { ...V21_MAPPINGS, due: { tbd: 'quarter_end' } },
      dropdowns,
    });
    const a = planOf(res).targets[0].actions.find((x) => x.no === 7)!;
    expect(a.due).toEqual({ kind: 'month', year: 2027, month: 5 });
  });

  it('still fails on a broken layout, without asking for mappings', () => {
    const g = structuredClone(grid);
    const r = g['T2 Adoption'].findIndex((row) => row[0] === '#' && row[1] === 'Quarter');
    g['T2 Adoption'][r] = [];
    const res = parseAxcWorkbook(g, 'v21.xlsx', 'x', { dropdowns });
    if (res.ok || !('problems' in res)) throw new Error('expected problems');
    expect(res.problems[0].message).toMatch(/action table header not found/);
  });
});

describe('v2.0 workbook — dropdown-only words', () => {
  it('imports without a mapping even though its dropdown lists In progress and Blocked', () => {
    expect(parseFixture(FIXTURE).ok).toBe(true);
  });
});
