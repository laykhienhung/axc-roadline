import { monthIndex } from './fiscal.js';
import {
  emptyMappings,
  type Action,
  type Cell,
  type ChangeEntry,
  type Dropdowns,
  type Due,
  type Grid,
  type Mappings,
  type ParseResult,
  type Plan,
  type Problem,
  type Risk,
  type Target,
} from './model.js';
import { quarterEnd, WordResolver } from './resolve.js';
import {
  compareVersion,
  fiscalTitle,
  monthFromName,
  parseWeight,
  text,
  versionText,
} from './values.js';

export const TESTED_TEMPLATE_VERSION = '2.0';

const TARGET_TITLE = /^(T\d+)\s*[-–—]\s*(.+)$/;
const SECTION_ROW = /^[A-Z]\.\s+/;
const BLOCKS = [
  'OBJECTIVE',
  'WHAT THIS MUST ACHIEVE',
  'ACTION PLAN',
  'HOW WE WILL DO IT',
  'WHAT THIS DEPENDS ON',
  'RISK & MITIGATION',
  'CHANGE HISTORY',
] as const;
type BlockName = (typeof BLOCKS)[number];
/** Any "<n>  <UPPERCASE LABEL>" row starts a block, known or not. */
const BLOCK_HEADING = /^\d+\s+([A-Z][A-Z0-9 &/,'-]+)$/;

const ACTION_COLUMNS = {
  no: ['#', 'no', 'no.'],
  quarter: ['quarter', 'qtr'],
  action: ['action'],
  deliverable: ['deliverable', 'deliverables'],
  measure: ['success measure', 'measure', 'kpi'],
  owner: ['owner'],
  due: ['due', 'due date', 'deadline'],
  status: ['status'],
} as const;
type ActionColumn = keyof typeof ACTION_COLUMNS;
const REQUIRED_COLUMNS: ActionColumn[] = [
  'no',
  'quarter',
  'action',
  'deliverable',
  'owner',
  'due',
  'status',
];

type Rows = Cell[][];
interface Block {
  start: number; // row index of the heading
  end: number; // exclusive
}

const cellAt = (rows: Rows, r: number, c: number): Cell => rows[r]?.[c] ?? null;

function findBlocks(rows: Rows): Partial<Record<BlockName, Block>> {
  const heads: { name: string; row: number }[] = [];
  rows.forEach((row, r) => {
    const m = BLOCK_HEADING.exec(text(row?.[0]));
    if (m) heads.push({ name: m[1].trim(), row: r });
  });
  const out: Partial<Record<BlockName, Block>> = {};
  heads.forEach((h, i) => {
    const known = BLOCKS.find((b) => b === h.name);
    if (known) out[known] = { start: h.row, end: heads[i + 1]?.row ?? rows.length };
  });
  return out;
}

/** Numbered list rows: A = number, B = text. */
function listItems(rows: Rows, block: Block | undefined): string[] {
  if (!block) return [];
  const items: string[] = [];
  for (let r = block.start + 1; r < block.end; r++) {
    const b = text(cellAt(rows, r, 1));
    if (b && typeof cellAt(rows, r, 0) === 'number') items.push(b);
  }
  return items;
}

function firstText(rows: Rows, block: Block | undefined): string {
  if (!block) return '';
  for (let r = block.start + 1; r < block.end; r++) {
    for (const c of rows[r] ?? []) {
      const t = text(c);
      if (t) return t;
    }
  }
  return '';
}

/** Find the header row in a block and map wanted columns (by alias) to indexes. */
function headerColumns<K extends string>(
  rows: Rows,
  from: number,
  to: number,
  aliases: Record<K, readonly string[]>,
  anchor: NoInfer<K>[]
): { row: number; cols: Partial<Record<K, number>> } | null {
  for (let r = from; r < to; r++) {
    const cells = (rows[r] ?? []).map((c) => text(c).toLowerCase());
    const cols: Partial<Record<K, number>> = {};
    for (const key of Object.keys(aliases) as K[]) {
      const i = cells.findIndex((c) => aliases[key].includes(c));
      if (i >= 0) cols[key] = i;
    }
    if (anchor.every((k) => cols[k] !== undefined)) return { row: r, cols };
  }
  return null;
}

function parseRisks(rows: Rows, block: Block | undefined): Risk[] {
  if (!block) return [];
  const h = headerColumns(
    rows,
    block.start + 1,
    block.end,
    { risk: ['risk'], mitigation: ['how we handle it', 'mitigation'] },
    ['risk', 'mitigation']
  );
  if (!h) return [];
  const risks: Risk[] = [];
  for (let r = h.row + 1; r < block.end; r++) {
    const risk = text(cellAt(rows, r, h.cols.risk!));
    if (risk) risks.push({ risk, mitigation: text(cellAt(rows, r, h.cols.mitigation!)) });
  }
  return risks;
}

function parseChanges(rows: Rows, block: Block | undefined): ChangeEntry[] {
  if (!block) return [];
  const h = headerColumns(
    rows,
    block.start + 1,
    block.end,
    {
      date: ['date'],
      what: ['what changed'],
      reason: ['reason'],
      by: ['updated by (role)', 'updated by'],
    },
    ['date', 'what']
  );
  if (!h) return [];
  const out: ChangeEntry[] = [];
  for (let r = h.row + 1; r < block.end; r++) {
    const get = (c: number | undefined) => (c === undefined ? '' : text(cellAt(rows, r, c)));
    const entry = {
      date: get(h.cols.date),
      what: get(h.cols.what),
      reason: get(h.cols.reason),
      by: get(h.cols.by),
    };
    if (entry.date || entry.what) out.push(entry);
  }
  return out;
}

/** Label in rows 1-4 (e.g. "Weight"), value in the next non-empty cell to its right. */
function labelled(rows: Rows, label: string): Cell {
  for (let r = 0; r < Math.min(rows.length, 4); r++) {
    const row = rows[r] ?? [];
    const i = row.findIndex((c) => text(c).toLowerCase() === label);
    if (i >= 0) {
      for (let c = i + 1; c < row.length; c++) {
        if (text(row[c]) !== '') return row[c];
        // stop at the next label
        if (c > i + 1) break;
      }
      return null;
    }
  }
  return null;
}

interface Summary {
  fiscal: Plan['fiscal'] | null;
  version: string | null;
  team: string;
}

function parseSummary(rows: Rows | undefined): Summary {
  const out: Summary = { fiscal: null, version: null, team: '' };
  if (!rows) return out;
  const period = /([A-Za-z]+)\s+(\d{4})\s*[-–—]\s*([A-Za-z]+)\s+(\d{4})/;
  rows.forEach((row) => {
    const label = text(row?.[0]).toLowerCase();
    const firstValue = (row ?? []).slice(1).find((c) => text(c) !== '') ?? null;
    if (label === 'version') out.version = versionText(firstValue);
    if (label === 'team') out.team = text(firstValue);
    if (!out.fiscal) {
      for (const c of row ?? []) {
        const m = period.exec(text(c));
        const month = m ? monthFromName(m[1]) : null;
        if (m && month) {
          out.fiscal = { startYear: +m[2], startMonth: month };
          break;
        }
      }
    }
  });
  return out;
}

interface SheetContext {
  resolver: WordResolver;
  /** The file's layout doesn't match the template. */
  layout: Problem[];
  /** Values that can't be mapped (bad #, month outside the year). */
  values: Problem[];
  rowOf: Map<Action, number>;
  fiscal: Plan['fiscal'] | null;
  dropdowns: { ref: string; values: string[] }[];
}

/** "H20:H31 H33:H48" → zero-based boxes. */
function rangeBoxes(ref: string): { c0: number; c1: number; r0: number; r1: number }[] {
  const col = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return ref
    .split(/\s+/)
    .map((part) => /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(part.replace(/\$/g, '')))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({
      c0: col(m[1]),
      r0: +m[2] - 1,
      c1: col(m[3] ?? m[1]),
      r1: +(m[4] ?? m[2]) - 1,
    }));
}

function parseTargetSheet(
  sheet: string,
  rows: Rows,
  id: string,
  name: string,
  ctx: SheetContext
): Target {
  const { resolver, layout, values, rowOf } = ctx;
  const blocks = findBlocks(rows);
  const weight = parseWeight(labelled(rows, 'weight'));
  if (weight === null) values.push({ sheet, row: 2, message: 'weight not found or not a number' });
  const status = resolver.status(labelled(rows, 'status'), { sheet, row: 2 });
  const owner = text(labelled(rows, 'owner'));

  const target: Target = {
    id,
    name,
    weight: weight ?? 0,
    owner,
    status: status?.tone ?? 'not_started',
    statusWord: status?.word ?? '',
    objective: firstText(rows, blocks['OBJECTIVE']),
    mustAchieve: listItems(rows, blocks['WHAT THIS MUST ACHIEVE']),
    how: listItems(rows, blocks['HOW WE WILL DO IT']),
    dependsOn: listItems(rows, blocks['WHAT THIS DEPENDS ON']),
    risks: parseRisks(rows, blocks['RISK & MITIGATION']),
    changes: parseChanges(rows, blocks['CHANGE HISTORY']),
    actions: [],
  };

  const plan = blocks['ACTION PLAN'];
  const header = plan
    ? headerColumns(rows, plan.start + 1, plan.end, ACTION_COLUMNS, ['no', 'quarter', 'action'])
    : null;
  if (!plan || !header) {
    layout.push({
      sheet,
      message: 'action table header not found (looked for # · Quarter · Action · … · Status)',
    });
    return target;
  }
  const missing = REQUIRED_COLUMNS.filter((k) => header.cols[k] === undefined);
  if (missing.length) {
    layout.push({
      sheet,
      row: header.row + 1,
      message: `action table is missing column(s): ${missing.join(', ')}`,
    });
    return target;
  }
  const col = header.cols as Record<ActionColumn, number | undefined>;

  // Status dropdown lists (target status in row 2, or the action Status column).
  for (const list of ctx.dropdowns) {
    const isStatusList = rangeBoxes(list.ref).some(
      (b) => (b.r0 <= 1 && b.r1 >= 1) || (b.c0 <= col.status! && b.c1 >= col.status!)
    );
    if (isStatusList) list.values.forEach((v) => resolver.dropdownStatus(v));
  }

  let section = 'Actions';
  for (let r = header.row + 1; r < plan.end; r++) {
    const a = text(cellAt(rows, r, 0));
    if (/^actions done/i.test(a)) break;
    if (SECTION_ROW.test(a) && typeof cellAt(rows, r, 0) === 'string') {
      section = a;
      continue;
    }
    const noCell = cellAt(rows, r, col.no!);
    const actionText = text(cellAt(rows, r, col.action!));
    if (!actionText) continue; // blank or spare row
    const row = r + 1;
    const where = { sheet, row };
    const quarter = resolver.quarter(cellAt(rows, r, col.quarter!), where);
    // Next-year rows never ask for their due word; rows with an unknown quarter wait for it.
    const due =
      quarter === 'next_year'
        ? ({ kind: 'next_year' } as const)
        : quarter
          ? resolver.due(cellAt(rows, r, col.due!), where)
          : null;
    const st = resolver.status(cellAt(rows, r, col.status!), where);
    const no = Number(text(noCell));
    if (!Number.isFinite(no) || text(noCell) === '') {
      values.push({ sheet, row, message: `action # "${text(noCell)}" is not a number` });
      continue;
    }
    if (!quarter || !due || !st) continue;
    const measure = col.measure === undefined ? '' : text(cellAt(rows, r, col.measure));
    const parsed: Action = {
      targetId: id,
      section,
      no,
      quarter,
      action: actionText,
      deliverable: text(cellAt(rows, r, col.deliverable!)) || actionText,
      measure: measure || null,
      owner: text(cellAt(rows, r, col.owner!)) || owner,
      due: resolveQuarterEnd(due, quarter, ctx.fiscal),
      status: st.tone,
      statusWord: st.word,
    };
    target.actions.push(parsed);
    rowOf.set(parsed, row);
  }
  return target;
}

/** Due mapped to "end of its quarter" → the quarter's last month (ongoing → quarterly). */
function resolveQuarterEnd(
  due: Due | 'quarter_end',
  quarter: Action['quarter'],
  fiscal: Plan['fiscal'] | null
): Due {
  if (due !== 'quarter_end') return due;
  if (quarter === 'ongoing') return { kind: 'recurring', every: 'quarterly' };
  if (quarter === 'next_year') return { kind: 'next_year' };
  return quarterEnd(fiscal ?? { startYear: 0, startMonth: 1 }, quarter);
}

export interface ParseOptions {
  mappings?: Mappings;
  dropdowns?: Dropdowns;
}

export function parseAxcWorkbook(
  grid: Grid,
  fileName: string,
  importedAt: string,
  opts: ParseOptions = {}
): ParseResult {
  const mappings = opts.mappings ?? emptyMappings();
  const layout: Problem[] = [];
  const values: Problem[] = [];
  const warnings: Problem[] = [];
  const resolver = new WordResolver(mappings);

  const summarySheet = Object.keys(grid).find((n) => /executive summary/i.test(n));
  const summary = parseSummary(summarySheet ? grid[summarySheet] : undefined);

  const targets: Target[] = [];
  const rowOf = new Map<Action, number>();
  for (const [sheet, rows] of Object.entries(grid)) {
    const m = TARGET_TITLE.exec(text(rows[0]?.[0]));
    if (!m) continue;
    targets.push(
      parseTargetSheet(sheet, rows, m[1], m[2].trim(), {
        resolver,
        layout,
        values,
        rowOf,
        fiscal: summary.fiscal,
        dropdowns: opts.dropdowns?.[sheet] ?? [],
      })
    );
  }
  if (targets.length === 0)
    layout.push({ message: 'no target sheets found (cell A1 like "T1 - Name")' });

  if (!summary.fiscal)
    layout.push({
      sheet: summarySheet,
      message: 'fiscal period not found (e.g. "September 2026 - August 2027")',
    });

  // 1. layout, 2. unknown words, 3. values that can't be mapped
  if (layout.length || !summary.fiscal) return { ok: false, problems: layout };
  const unknown = resolver.unknownValues();
  if (unknown.length) return { ok: false, needsMapping: unknown };

  const fiscal = summary.fiscal;
  const sheetOf = new Map(
    Object.entries(grid).map(([s, rows]) => [TARGET_TITLE.exec(text(rows[0]?.[0]))?.[1], s])
  );
  for (const t of targets) {
    for (const a of t.actions) {
      if (a.due.kind !== 'month') continue;
      const i = monthIndex(fiscal, a.due.year, a.due.month);
      if (i < 0 || i > 11)
        values.push({
          sheet: sheetOf.get(t.id),
          row: rowOf.get(a),
          message: 'due month is outside the fiscal year',
        });
    }
  }
  if (values.length) return { ok: false, problems: values };

  const version = summary.version;
  if (
    version &&
    compareVersion(version, TESTED_TEMPLATE_VERSION) > 0 &&
    !(mappings.seenVersions ?? []).includes(version)
  )
    warnings.push({
      sheet: summarySheet,
      message: `template version ${version} is newer than tested ${TESTED_TEMPLATE_VERSION}`,
    });

  return {
    ok: true,
    warnings,
    applied: resolver.applied(),
    plan: {
      title: fiscalTitle(summary.team, fiscal.startYear),
      fiscal,
      templateVersion: version,
      source: { fileName, importedAt },
      targets,
    },
  };
}
