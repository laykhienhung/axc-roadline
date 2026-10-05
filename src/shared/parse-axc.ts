import { monthIndex } from './fiscal.js';
import {
  emptyMappings,
  type Action,
  type Cell,
  type ChangeEntry,
  type Detail,
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
  parsePercent,
  parseStartMonth,
  parseWeight,
  text,
  versionText,
} from './values.js';

/**
 * Template versions the parser was tested against. A version not in the list and newer than the
 * oldest one gets a one-time "newer than tested" warning. 2.1 still warns (its tests rely on it).
 */
export const TESTED_TEMPLATE_VERSIONS = ['2.0', '4.2'] as const;

/** Plan sheet title in A1: `T1 - Name` (template 2.x) or `O1 - Name` (template 4.2). */
const TARGET_TITLE = /^([TO]\d+)\s*[-–—]\s*(.+)$/;
/** A 4.2 objective-detail number in the # column ("1.1"). */
const DETAIL_ID = /^\d+\.\d+$/;
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
  partners: ['partners', 'partner'],
  due: ['due', 'due date', 'deadline'],
  status: ['status'],
  percent: ['%', 'progress', 'percent', '% done'],
  reference: ['reference document', 'reference documents', 'reference', 'references'],
  note: ['note', 'notes'],
} as const;
type ActionColumn = keyof typeof ACTION_COLUMNS;
/** Deliverable is optional (4.2 has none): the action text stands in for it. */
const REQUIRED_COLUMNS: ActionColumn[] = ['no', 'quarter', 'action', 'owner', 'due', 'status'];

type Rows = Cell[][];
interface Block {
  start: number; // row index of the heading
  end: number; // exclusive
}

const cellAt = (rows: Rows, r: number, c: number): Cell => rows[r]?.[c] ?? null;
/** Like `text`, but keeps line breaks (notes are paragraphs the drawer shows as written). */
const multiline = (cell: Cell): string =>
  cell === null || cell === undefined
    ? ''
    : String(cell)
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');

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

/** Whether rows 1-4 hold the label at all (even with an empty value). */
function hasLabel(rows: Rows, label: string): boolean {
  for (let r = 0; r < Math.min(rows.length, 4); r++)
    if ((rows[r] ?? []).some((c) => text(c).toLowerCase() === label)) return true;
  return false;
}

/** "a; b" or one name per line → ["a", "b"]. */
function splitReferences(cell: Cell): string[] {
  if (cell === null || cell === undefined) return [];
  return String(cell)
    .split(/[;\r\n]+/)
    .map((x) => text(x))
    .filter(Boolean);
}

/**
 * A detail row's description cell: lines starting `Goal:`, `Needs first:`, `JD:` (labels
 * stripped). Lines before any label belong to the goal; later unlabelled lines continue the
 * current field.
 */
function detailFields(cell: Cell): Pick<Detail, 'goal' | 'needsFirst' | 'jd'> {
  const parts: Record<'goal' | 'needsFirst' | 'jd', string[]> = {
    goal: [],
    needsFirst: [],
    jd: [],
  };
  let key: keyof typeof parts = 'goal';
  const labels: [RegExp, keyof typeof parts][] = [
    [/^goal\s*:/i, 'goal'],
    [/^needs first\s*:/i, 'needsFirst'],
    [/^jd\s*:/i, 'jd'],
  ];
  for (const raw of cell === null ? [] : String(cell).split(/\r?\n/)) {
    let line = raw.trim();
    const hit = labels.find(([re]) => re.test(line));
    if (hit) {
      key = hit[1];
      line = line.replace(hit[0], '');
    }
    const t = text(line);
    if (t) parts[key].push(t);
  }
  const join = (k: keyof typeof parts) => (parts[k].length ? parts[k].join(' ') : null);
  return { goal: join('goal'), needsFirst: join('needsFirst'), jd: join('jd') };
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
  let startMonth: Plan['fiscal'] | null = null;
  rows.forEach((row) => {
    // 4.2: "Start month (M1)" label, the date in the next non-empty cell to the right.
    const cells = row ?? [];
    const first = cells.findIndex((c) => text(c) !== '');
    if (!startMonth && first >= 0 && /^start month/i.test(text(cells[first]))) {
      const value = cells.slice(first + 1).find((c) => text(c) !== '');
      startMonth = parseStartMonth(value ?? null);
    }
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
  // The period text wins (2.x); the Start month is the 4.2 fallback.
  if (!out.fiscal) out.fiscal = startMonth;
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

/** What a sheet told the workbook level (weights and progress mode are decided across sheets). */
interface SheetFacts {
  target: Target;
  hasWeight: boolean;
  hasPercent: boolean;
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
): SheetFacts {
  const { resolver, layout, values, rowOf } = ctx;
  const blocks = findBlocks(rows);
  // No Weight label (4.2) is decided at workbook level; a label with a bad value is a problem.
  const hasWeight = hasLabel(rows, 'weight');
  const weight = hasWeight ? parseWeight(labelled(rows, 'weight')) : null;
  if (hasWeight && weight === null)
    values.push({ sheet, row: 2, message: 'weight not found or not a number' });
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
    return { target, hasWeight, hasPercent: false };
  }
  const missing = REQUIRED_COLUMNS.filter((k) => header.cols[k] === undefined);
  if (missing.length) {
    layout.push({
      sheet,
      row: header.row + 1,
      message: `action table is missing column(s): ${missing.join(', ')}`,
    });
    return { target, hasWeight, hasPercent: false };
  }
  const col = header.cols as Record<ActionColumn, number | undefined>;
  const details: Detail[] = [];
  let detail: Detail | null = null;

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
      detail = null;
      continue;
    }
    const noCell = cellAt(rows, r, col.no!);
    const actionText = text(cellAt(rows, r, col.action!));
    if (!actionText) continue; // blank or spare row
    // 4.2 objective detail: "1.1", no quarter, a title in the action column. Never an action, so
    // it never reaches the quarter / due / status resolver.
    if (isDetailNo(noCell) && text(cellAt(rows, r, col.quarter!)) === '') {
      const description = (rows[r] ?? []).slice(col.action! + 1).find((c) => text(c) !== '');
      detail = { id: text(noCell), title: actionText, ...detailFields(description ?? null) };
      details.push(detail);
      section = `${detail.id} · ${detail.title}`;
      continue;
    }
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
    let percent: number | null = null;
    if (col.percent !== undefined) {
      const p = parsePercent(cellAt(rows, r, col.percent));
      if (p === 'invalid') values.push({ sheet, row, message: '% must be 0–100' });
      else percent = p;
    }
    if (!quarter || !due || !st) continue;
    const measure = col.measure === undefined ? '' : text(cellAt(rows, r, col.measure));
    const deliverable = col.deliverable === undefined ? '' : text(cellAt(rows, r, col.deliverable));
    const parsed: Action = {
      targetId: id,
      section,
      no,
      quarter,
      action: actionText,
      deliverable: deliverable || actionText,
      measure: measure || null,
      owner: text(cellAt(rows, r, col.owner!)) || owner,
      due: resolveQuarterEnd(due, quarter, ctx.fiscal),
      status: st.tone,
      statusWord: st.word,
    };
    // 4.2 fields only when the file has them, so 2.x actions keep today's shape.
    if (detail) parsed.detailId = detail.id;
    if (col.partners !== undefined) parsed.partners = text(cellAt(rows, r, col.partners)) || null;
    if (col.percent !== undefined) parsed.percent = percent;
    if (col.reference !== undefined)
      parsed.references = splitReferences(cellAt(rows, r, col.reference));
    if (col.note !== undefined) parsed.note = multiline(cellAt(rows, r, col.note)) || null;
    target.actions.push(parsed);
    rowOf.set(parsed, row);
  }
  if (details.length) target.details = details;
  return { target, hasWeight, hasPercent: col.percent !== undefined };
}

/** "1.1" as text, or a number with a fraction like 1.1. */
function isDetailNo(cell: Cell): boolean {
  if (typeof cell === 'number') return !Number.isInteger(cell) && DETAIL_ID.test(String(cell));
  return typeof cell === 'string' && DETAIL_ID.test(text(cell));
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

  const sheets: (SheetFacts & { sheet: string })[] = [];
  const rowOf = new Map<Action, number>();
  for (const [sheet, rows] of Object.entries(grid)) {
    const m = TARGET_TITLE.exec(text(rows[0]?.[0]));
    if (!m) continue;
    const facts = parseTargetSheet(sheet, rows, m[1], m[2].trim(), {
      resolver,
      layout,
      values,
      rowOf,
      fiscal: summary.fiscal,
      dropdowns: opts.dropdowns?.[sheet] ?? [],
    });
    sheets.push({ ...facts, sheet });
  }
  const targets = sheets.map((s) => s.target);
  if (targets.length === 0)
    layout.push({ message: 'no target sheets found (cell A1 like "T1 - Name" or "O1 - Name")' });
  const kinds = new Set(targets.map((t) => t.id[0]));
  if (kinds.size > 1) layout.push({ message: 'plan sheets mix T… and O… ids' });
  const planLayout: Plan['layout'] = kinds.has('O') ? 'objectives' : 'targets';

  // Weights: from the file when every sheet has a Weight label, equal when none has one.
  if (sheets.length && sheets.every((s) => !s.hasWeight)) {
    for (const t of targets) {
      t.weight = 1 / targets.length;
      t.weightSource = 'equal';
    }
  } else {
    for (const s of sheets)
      if (!s.hasWeight) values.push({ sheet: s.sheet, row: 2, message: 'weight not found' });
  }

  if (!summary.fiscal)
    layout.push({
      sheet: summarySheet,
      message:
        'fiscal period not found (e.g. "September 2026 - August 2027", or a "Start month (M1)" date)',
    });

  // 1. layout, 2. unknown words, 3. values that can't be mapped
  if (layout.length || !summary.fiscal) return { ok: false, problems: layout };
  const unknown = resolver.unknownValues();
  if (unknown.length) return { ok: false, needsMapping: unknown };

  const fiscal = summary.fiscal;
  const sheetOf = new Map(sheets.map((s) => [s.target.id, s.sheet]));
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
  const tested = untestedVersion(version);
  if (version && tested && !(mappings.seenVersions ?? []).includes(version))
    warnings.push({
      sheet: summarySheet,
      message: `template version ${version} is newer than tested ${tested}`,
    });

  const plan: Plan = {
    title: fiscalTitle(summary.team, fiscal.startYear),
    fiscal,
    templateVersion: version,
    source: { fileName, importedAt },
    targets,
    layout: planLayout,
  };
  if (sheets.some((s) => s.hasPercent)) plan.progressBy = 'percent';
  return { ok: true, warnings, applied: resolver.applied(), plan };
}

/**
 * For a version that isn't in the tested list but is newer than the oldest tested one: the
 * newest tested version below it (named in the warning). Otherwise null.
 */
function untestedVersion(version: string | null): string | null {
  if (!version || (TESTED_TEMPLATE_VERSIONS as readonly string[]).includes(version)) return null;
  const below = TESTED_TEMPLATE_VERSIONS.filter((v) => compareVersion(version, v) > 0);
  return below.length ? below[below.length - 1] : null;
}
