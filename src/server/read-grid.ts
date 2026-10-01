import * as XLSX from 'xlsx';
import type { Cell, Dropdowns, Grid } from '../shared/model.js';

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const decodeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

type BookFiles = Record<string, { content?: Uint8Array }>;

function fileText(files: BookFiles, path: string): string | null {
  const entry = files[path] ?? files['/' + path];
  return entry?.content ? Buffer.from(entry.content).toString('utf8') : null;
}

/**
 * Data-validation lists per sheet. Sheet names are mapped to their XML through the workbook
 * relationships — SheetJS's `Directory.sheets` is not in sheet order. Lists whose formula is a
 * range reference (not an inline "a,b,c") are skipped.
 */
function readDropdowns(files: BookFiles): Dropdowns {
  const out: Dropdowns = {};
  const book = fileText(files, 'xl/workbook.xml');
  const rels = fileText(files, 'xl/_rels/workbook.xml.rels');
  if (!book || !rels) return out;
  const targetOf = new Map<string, string>();
  for (const rel of rels.match(/<Relationship\s[^>]*>/g) ?? []) {
    const id = attr(rel, 'Id');
    const target = attr(rel, 'Target');
    if (id && target) targetOf.set(id, target.replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/'));
  }
  for (const tag of book.match(/<sheet\s[^>]*>/g) ?? []) {
    const name = attr(tag, 'name');
    const path = targetOf.get(attr(tag, 'r:id') ?? '');
    const xml = path ? fileText(files, path) : null;
    if (!name || !xml) continue;
    const lists: { ref: string; values: string[] }[] = [];
    for (const m of xml.matchAll(/<dataValidation\s([^>]*)>([\s\S]*?)<\/dataValidation>/g)) {
      if (attr(' ' + m[1], 'type') !== 'list') continue;
      const formula = /<formula1>([\s\S]*?)<\/formula1>/.exec(m[2])?.[1];
      const inline = formula ? /^"([\s\S]*)"$/.exec(decodeXml(formula).trim()) : null;
      const ref = attr(' ' + m[1], 'sqref');
      if (!inline || !ref) continue;
      lists.push({
        ref,
        values: inline[1]
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      });
    }
    if (lists.length) out[decodeXml(name)] = lists;
  }
  return out;
}

/**
 * Read a workbook (.xlsx) or a .csv into a normalized grid: one 2D array per sheet, where
 * grid[sheet][r][c] is Excel row r+1, column c+1. Formulas are read as their cached values.
 * Also returns the workbook's dropdown (data-validation) lists; CSV has none.
 */
export function readGrid(buffer: Buffer, fileName: string): { grid: Grid; dropdowns: Dropdowns } {
  const isCsv = /\.csv$/i.test(fileName);
  const wb = isCsv
    ? XLSX.read(stripBom(buffer.toString('utf8')), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'buffer', bookFiles: true });
  const grid: Grid = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });
    // sheet_to_json starts at the sheet's used range; pad so indexes match Excel's A1.
    const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    const top = ref?.s.r ?? 0;
    const left = ref?.s.c ?? 0;
    const padded: Cell[][] = Array.from({ length: top }, () => []);
    for (const row of rows) padded.push([...Array<Cell>(left).fill(null), ...row]);
    grid[name] = padded;
  }
  let dropdowns: Dropdowns = {};
  if (!isCsv) {
    try {
      dropdowns = readDropdowns((wb as unknown as { files?: BookFiles }).files ?? {});
    } catch {
      dropdowns = {}; // unreadable lists are skipped; rows are still checked
    }
  }
  return { grid, dropdowns };
}
