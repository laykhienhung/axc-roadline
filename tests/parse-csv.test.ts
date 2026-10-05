import { describe, expect, it } from 'vitest';
import { readGrid } from '../src/server/read-grid';
import { parseFlatCsv } from '../src/shared/parse-csv';

const HEADER =
  'target_id,target_name,target_weight,target_owner,target_status,section,no,quarter,action,deliverable,success_measure,owner,due,status';
const ROWS = [
  'T1,Build AI Tools,0.34,Developer,,A. Automation,1,Q1,Inventory processes,Process inventory,Every team covered,Developer,Nov 2026,',
  'T1,,,,,A. Automation,2,Q2,Roll out CV tool,CV tool live,,Developer,Feb 2027,On track',
  'T1,,,,,B. Shared,3,ongoing,Monthly report,12 reports,,Developer,monthly,',
];

const parseCsv = (csv: string) =>
  parseFlatCsv(readGrid(Buffer.from(csv), 'plan.csv').grid, 'plan.csv', '2026-09-28T07:00:00Z');

describe('parseFlatCsv', () => {
  it('reads one target with 3 actions and fiscal start Sep 2026', () => {
    const res = parseCsv([HEADER, ...ROWS].join('\n'));
    if (!res.ok) throw new Error(JSON.stringify(res));
    expect(res.plan.targets).toHaveLength(1);
    const t = res.plan.targets[0];
    expect(t).toMatchObject({ id: 'T1', name: 'Build AI Tools', weight: 0.34, owner: 'Developer' });
    expect(t.actions).toHaveLength(3);
    expect(t.actions[1]).toMatchObject({
      quarter: 'Q2',
      due: { kind: 'month', year: 2027, month: 2 },
      status: 'on_track',
    });
    expect(t.actions[2].due).toEqual({ kind: 'recurring', every: 'monthly' });
    expect(res.plan.fiscal).toEqual({ startYear: 2026, startMonth: 9 });
  });

  it('reports a missing due column', () => {
    const header = HEADER.replace(',due', '');
    const rows = ROWS.map((r) => r.replace(/,(Nov 2026|Feb 2027|monthly),/, ','));
    const res = parseCsv([header, ...rows].join('\n'));
    if (res.ok || !('problems' in res)) throw new Error('expected problems');
    expect(res.problems).toEqual([{ row: 1, message: 'missing column(s): due' }]);
  });

  it('maps unknown CSV words through the mappings', () => {
    const rows = [
      ...ROWS,
      'T1,,,,,B. Shared,4,FY27-28,Pilot search,Pilot running,,Developer,Next year,In progress',
    ];
    const csv = [HEADER, ...rows].join('\n');
    const first = parseCsv(csv);
    if (first.ok || !('needsMapping' in first)) throw new Error('expected needsMapping');
    expect(first.needsMapping.map((u) => u.word)).toEqual(['FY27-28', 'In progress']);
    const res = parseFlatCsv(readGrid(Buffer.from(csv), 'plan.csv').grid, 'plan.csv', 'x', {
      mappings: {
        status: { 'in progress': 'on_track' },
        quarter: { 'fy27-28': 'next_year' },
        due: {},
      },
    });
    if (!res.ok) throw new Error(JSON.stringify(res));
    const a = res.plan.targets[0].actions[3];
    expect(a).toMatchObject({
      quarter: 'next_year',
      due: { kind: 'next_year' },
      status: 'on_track',
      statusWord: 'In progress',
    });
    expect(res.applied).toHaveLength(2);
  });
});
