import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGrid } from '../src/server/read-grid';
import type { Grid, ParseResult, Plan } from '../src/shared/model';
import { parseAxcWorkbook } from '../src/shared/parse-axc';

const FIXTURE = 'tests/fixtures/axc-fy2026-27.xlsx';
const { grid } = readGrid(readFileSync(FIXTURE), 'axc-fy2026-27.xlsx');
const clone = (): Grid => structuredClone(grid);
const parse = (g: Grid): ParseResult => parseAxcWorkbook(g, 'axc.xlsx', '2026-09-28T07:00:00Z');

function okPlan(r: ParseResult): Plan {
  if (!r.ok) throw new Error('parse failed: ' + JSON.stringify(r, null, 1));
  return r.plan;
}

describe('parseAxcWorkbook — real FY2026-27 workbook', () => {
  const plan = okPlan(parse(grid));
  const t = (id: string) => plan.targets.find((x) => x.id === id)!;

  it('reads 4 targets with 26/21/18/10 actions, fiscal start Sep 2026, version 2.0', () => {
    expect(plan.targets.map((x) => x.id)).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(plan.targets.map((x) => x.actions.length)).toEqual([26, 21, 18, 10]);
    expect(plan.fiscal).toEqual({ startYear: 2026, startMonth: 9 });
    expect(plan.templateVersion).toBe('2.0');
    expect(plan.title).toBe('AI Transformation Team (AXC) · FY2026-27');
  });

  it('reads target header facts', () => {
    expect(t('T1')).toMatchObject({
      name: 'Build AI Tools & Automation',
      weight: 0.34,
      owner: 'Developer',
      status: 'not_started',
    });
    expect(t('T1').objective).toMatch(/^Build the tools that put AI into everyday work/);
  });

  it('reads the fields of T1 action #1', () => {
    expect(t('T1').actions[0]).toEqual({
      targetId: 'T1',
      section: 'A. Automation workflows',
      no: 1,
      quarter: 'Q1',
      action:
        'Inventory candidate processes across all teams and survey duties and pain points, ESG and LSG first',
      deliverable: 'Process inventory + needs survey',
      measure: 'Every team in scope covered',
      owner: 'Developer',
      due: { kind: 'month', year: 2026, month: 11 },
      status: 'not_started',
      statusWord: '',
    });
  });

  it('reads T4 (table at a different row) with section "Actions"', () => {
    expect(new Set(t('T4').actions.map((a) => a.section))).toEqual(new Set(['Actions']));
    expect(t('T4').actions[0].deliverable).toBe('Technology view published');
  });

  it('reads recurring actions', () => {
    const a = t('T3').actions.find((x) => x.no === 9)!;
    expect(a.quarter).toBe('ongoing');
    expect(a.due).toEqual({ kind: 'recurring', every: 'monthly' });
  });

  it('reads target detail blocks', () => {
    expect(t('T2').mustAchieve).toHaveLength(7);
    expect(t('T2').dependsOn).toHaveLength(3);
    expect(t('T4').risks).toHaveLength(2);
    expect(t('T4').risks[0]).toEqual({
      risk: 'Seen as research rather than delivery',
      mitigation: expect.stringMatching(/^A named use case is required/),
    });
    expect(t('T1').changes).toEqual([]);
  });
});

describe('parseAxcWorkbook — invalid files', () => {
  it('reports a missing action table on the sheet', () => {
    const g = clone();
    const rows = g['T2 Adoption'];
    const r = rows.findIndex((row) => row[0] === '#' && row[1] === 'Quarter');
    rows[r] = [];
    const res = parse(g);
    expect(res.ok).toBe(false);
    if (res.ok || !('problems' in res)) throw new Error('expected problems');
    expect(res.problems).toContainEqual({
      sheet: 'T2 Adoption',
      message: expect.stringMatching(/action table header not found/),
    });
  });

  it('reports a due month outside the fiscal year with sheet and row', () => {
    const g = clone();
    g['T3 Management'][26][6] = 'Nov 2028';
    const res = parse(g);
    if (res.ok || !('problems' in res)) throw new Error('expected problems');
    expect(res.problems).toContainEqual({
      sheet: 'T3 Management',
      row: 27,
      message: 'due month is outside the fiscal year',
    });
  });

  it('asks for a mapping for an unknown status or due word instead of failing', () => {
    const g = clone();
    g['T1 Build'][19][7] = 'Blocked';
    g['T3 Management'][26][6] = 'Q5 2027';
    const res = parse(g);
    if (res.ok || !('needsMapping' in res)) throw new Error('expected needsMapping');
    expect(res.needsMapping).toEqual([
      expect.objectContaining({ field: 'status', word: 'Blocked', count: 1, suggestion: 'behind' }),
      expect.objectContaining({ field: 'due', word: 'Q5 2027', count: 1 }),
    ]);
    expect(res.needsMapping[0].where).toEqual([{ sheet: 'T1 Build', row: 20 }]);
  });

  it('accepts a newer template version with a warning', () => {
    const g = clone();
    const row = g['Executive Summary'].find((r) => r[0] === 'Version')!;
    row[1] = '3.0';
    const res = parse(g);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings).toContainEqual({
      sheet: 'Executive Summary',
      message: 'template version 3.0 is newer than tested 2.0',
    });
  });
});
