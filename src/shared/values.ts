import type { Cell, Due, Quarter } from './model.js';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Trim and collapse runs of whitespace; null/undefined → ''. */
export function text(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).replace(/\s+/g, ' ').trim();
}

export function monthFromName(name: string): number | null {
  const n = name.toLowerCase().replace(/\.$/, '');
  if (n.length < 3) return null;
  const i = MONTHS.findIndex((m) => m.startsWith(n));
  return i >= 0 ? i + 1 : null;
}

export function parseQuarter(cell: Cell | undefined): Quarter | 'ongoing' | null {
  const t = text(cell).replace(/\s+/g, '').toUpperCase();
  if (t === 'ONGOING') return 'ongoing';
  return /^Q[1-4]$/.test(t) ? (t as Quarter) : null;
}

/** "Nov 2026" / "November 2026" / Excel date serial → month; "monthly" / "quarterly" → recurring. */
export function parseDue(cell: Cell | undefined): Due | null {
  if (typeof cell === 'number' && cell > 20000 && cell < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(cell) * 86400000);
    return { kind: 'month', year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }
  const t = text(cell).toLowerCase();
  if (t === 'monthly' || t === 'quarterly') return { kind: 'recurring', every: t };
  const m = /^([a-z]+)\.?\s+(\d{4})$/.exec(t);
  if (!m) return null;
  const month = monthFromName(m[1]);
  return month ? { kind: 'month', year: +m[2], month } : null;
}

/** 0.34 / "0.34" / "34%" / 34 → 0.34; invalid → null. */
export function parseWeight(cell: Cell | undefined): number | null {
  const t = text(cell);
  if (t === '') return null;
  const pct = t.endsWith('%');
  const n = Number(t.replace('%', ''));
  if (!Number.isFinite(n)) return null;
  return pct || n > 1 ? n / 100 : n;
}

/** 2 → "2.0", "2.0" → "2.0". */
export function versionText(cell: Cell | undefined): string | null {
  if (typeof cell === 'number') return Number.isInteger(cell) ? cell.toFixed(1) : String(cell);
  const t = text(cell);
  return t === '' ? null : t;
}

export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function fiscalTitle(team: string, startYear: number): string {
  const fy = `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  return team ? `${team} · ${fy}` : `Action Plan · ${fy}`;
}
