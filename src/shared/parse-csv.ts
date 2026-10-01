import { monthIndex } from './fiscal.js';
import {
  emptyMappings,
  type Action,
  type Grid,
  type ParseResult,
  type Plan,
  type Problem,
  type Target,
} from './model.js';
import type { ParseOptions } from './parse-axc.js';
import { quarterEnd, WordResolver } from './resolve.js';
import { fiscalTitle, parseWeight, text } from './values.js';

export const CSV_COLUMNS = [
  'target_id',
  'target_name',
  'target_weight',
  'target_owner',
  'target_status',
  'section',
  'no',
  'quarter',
  'action',
  'deliverable',
  'success_measure',
  'owner',
  'due',
  'status',
] as const;
type Column = (typeof CSV_COLUMNS)[number];
const REQUIRED: Column[] = ['target_id', 'no', 'quarter', 'action', 'due'];
/** CSV fiscal years start in September, like the AXC template. */
const FISCAL_START_MONTH = 9;

export function parseFlatCsv(
  grid: Grid,
  fileName: string,
  importedAt: string,
  opts: ParseOptions = {}
): ParseResult {
  const sheet = Object.keys(grid)[0];
  const rows = sheet ? grid[sheet] : [];
  const header = (rows[0] ?? []).map((c) => text(c).toLowerCase());
  const col = Object.fromEntries(
    CSV_COLUMNS.map((c) => [c, header.indexOf(c)]).filter(([, i]) => (i as number) >= 0)
  ) as Partial<Record<Column, number>>;
  const missing = REQUIRED.filter((c) => col[c] === undefined);
  if (missing.length)
    return {
      ok: false,
      problems: [{ row: 1, message: `missing column(s): ${missing.join(', ')}` }],
    };

  const resolver = new WordResolver(opts.mappings ?? emptyMappings());
  const problems: Problem[] = [];
  const targets = new Map<string, Target>();
  const rowOf = new Map<Action, number>();
  const quarterEnds: Action[] = [];

  for (let r = 1; r < rows.length; r++) {
    const get = (c: Column) => (col[c] === undefined ? '' : text(rows[r]?.[col[c]!]));
    if ((rows[r] ?? []).every((c) => text(c) === '')) continue;
    const row = r + 1;
    const where = { row };
    const id = get('target_id');
    if (!id) {
      problems.push({ row, message: 'target_id is empty' });
      continue;
    }
    let target = targets.get(id);
    if (!target) {
      const tStatus = resolver.status(get('target_status'), where);
      target = {
        id,
        name: get('target_name') || id,
        weight: parseWeight(get('target_weight')) ?? 0,
        owner: get('target_owner'),
        status: tStatus?.tone ?? 'not_started',
        statusWord: tStatus?.word ?? '',
        objective: '',
        mustAchieve: [],
        how: [],
        dependsOn: [],
        risks: [],
        changes: [],
        actions: [],
      };
      targets.set(id, target);
    }
    const no = Number(get('no'));
    const quarter = resolver.quarter(get('quarter'), where);
    const due =
      quarter === 'next_year'
        ? ({ kind: 'next_year' } as const)
        : quarter
          ? resolver.due(get('due'), where)
          : null;
    const status = resolver.status(get('status'), where);
    if (!get('no') || !Number.isFinite(no))
      problems.push({ row, message: `no "${get('no')}" is not a number` });
    const actionText = get('action');
    if (!actionText) problems.push({ row, message: 'action is empty' });
    if (!quarter || !due || !status || !actionText || !Number.isFinite(no)) continue;
    const action: Action = {
      targetId: id,
      section: get('section') || 'Actions',
      no,
      quarter,
      action: actionText,
      deliverable: get('deliverable') || actionText,
      measure: get('success_measure') || null,
      owner: get('owner') || target.owner,
      due:
        due === 'quarter_end'
          ? quarter === 'ongoing'
            ? { kind: 'recurring', every: 'quarterly' }
            : { kind: 'next_year' } // placeholder, resolved once the fiscal year is known
          : due,
      status: status.tone,
      statusWord: status.word,
    };
    if (due === 'quarter_end' && quarter !== 'ongoing') quarterEnds.push(action);
    target.actions.push(action);
    rowOf.set(action, row);
  }

  const unknown = resolver.unknownValues();
  if (unknown.length) return { ok: false, needsMapping: unknown };

  const all = [...targets.values()].flatMap((t) => t.actions);
  const months = all.flatMap((a) => (a.due.kind === 'month' ? [a.due] : []));
  if (targets.size === 0) problems.push({ message: 'no actions found' });
  let fiscal: Plan['fiscal'] | null = null;
  if (months.length) {
    const first = months.reduce((a, b) => (a.year * 12 + a.month <= b.year * 12 + b.month ? a : b));
    fiscal = {
      startYear: first.month >= FISCAL_START_MONTH ? first.year : first.year - 1,
      startMonth: FISCAL_START_MONTH,
    };
    for (const a of quarterEnds)
      if (a.quarter !== 'ongoing' && a.quarter !== 'next_year')
        a.due = quarterEnd(fiscal, a.quarter);
    for (const a of all) {
      if (a.due.kind !== 'month') continue;
      const i = monthIndex(fiscal, a.due.year, a.due.month);
      if (i < 0 || i > 11)
        problems.push({ row: rowOf.get(a), message: 'due month is outside the fiscal year' });
    }
  } else if (targets.size) {
    problems.push({ message: 'no action has a month due, so the fiscal year cannot be found' });
  }

  if (problems.length || !fiscal) return { ok: false, problems };
  return {
    ok: true,
    warnings: [],
    applied: resolver.applied(),
    plan: {
      title: fiscalTitle('', fiscal.startYear),
      fiscal,
      templateVersion: null,
      source: { fileName, importedAt },
      targets: [...targets.values()],
    },
  };
}
