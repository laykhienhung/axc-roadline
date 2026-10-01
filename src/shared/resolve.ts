import type {
  AppliedMapping,
  Cell,
  Due,
  DueMeaning,
  Mappings,
  MappingField,
  Quarter,
  QuarterMeaning,
  Status,
  UnknownValue,
} from './model.js';
import { parseStatus } from './status.js';
import { normWord, suggestDue, suggestQuarter, suggestStatus } from './suggest.js';
import { parseDue, parseQuarter, text } from './values.js';

type Where = { sheet?: string; row: number };
const MAX_WHERE = 10;

/**
 * Turns status / quarter / due cells into meanings: built-in words first, then saved mappings.
 * Anything else is recorded as an unknown word (with count, locations and a suggestion) so the
 * caller can ask for a mapping instead of failing.
 */
export class WordResolver {
  private readonly unknown = new Map<string, UnknownValue>();
  private readonly used = new Map<string, AppliedMapping>();

  constructor(private readonly mappings: Mappings) {}

  status(cell: Cell | undefined, where: Where): { tone: Status; word: string } | null {
    const word = text(cell);
    const builtIn = parseStatus(word);
    if (builtIn) return { tone: builtIn, word };
    const mapped = this.mapped('status', word);
    if (mapped) return { tone: mapped as Status, word };
    this.record('status', word, where, suggestStatus(word));
    return null;
  }

  quarter(cell: Cell | undefined, where: Where): QuarterMeaning | null {
    const word = text(cell);
    const builtIn = parseQuarter(word);
    if (builtIn) return builtIn;
    const mapped = this.mapped('quarter', word);
    if (mapped) return mapped as QuarterMeaning;
    this.record('quarter', word, where, suggestQuarter(word));
    return null;
  }

  /** `'quarter_end'` is resolved by the caller once the fiscal year is known. */
  due(cell: Cell | undefined, where: Where): Due | 'quarter_end' | null {
    const builtIn = parseDue(cell);
    if (builtIn) return builtIn;
    const word = text(cell);
    const mapped = this.mapped('due', word) as DueMeaning | undefined;
    if (mapped === 'next_year') return { kind: 'next_year' };
    if (mapped === 'quarter_end') return 'quarter_end';
    this.record('due', word, where, suggestDue(word));
    return null;
  }

  /** A word from the file's status dropdown list: unknown if neither built in nor mapped. */
  dropdownStatus(word: string): void {
    if (parseStatus(word) || this.mapped('status', word)) return;
    const key = `status|${normWord(word)}`;
    if (this.unknown.has(key)) return;
    this.unknown.set(key, {
      field: 'status',
      word,
      count: 0,
      where: [],
      fromDropdown: true,
      suggestion: suggestStatus(word),
    });
  }

  /**
   * Words that need a mapping. Words seen only in a dropdown list never stop an import on their
   * own; they are listed when a row word needs a mapping anyway, so they get mapped early.
   */
  unknownValues(): UnknownValue[] {
    const all = [...this.unknown.values()];
    return all.some((u) => !u.fromDropdown) ? all : [];
  }

  applied(): AppliedMapping[] {
    return [...this.used.values()];
  }

  private mapped(field: MappingField, word: string): string | undefined {
    const key = normWord(word);
    const meaning = (this.mappings[field] as Record<string, string>)[key];
    if (meaning && !this.used.has(`${field}|${key}`))
      this.used.set(`${field}|${key}`, { field, word, meaning });
    return meaning;
  }

  private record(
    field: MappingField,
    word: string,
    where: Where,
    suggestion: UnknownValue['suggestion']
  ) {
    const key = `${field}|${normWord(word)}`;
    const u = this.unknown.get(key) ?? {
      field,
      word,
      count: 0,
      where: [],
      fromDropdown: false,
      suggestion,
    };
    u.count++;
    u.fromDropdown = false;
    if (u.where.length < MAX_WHERE) u.where.push(where);
    this.unknown.set(key, u);
  }
}

/** Last month of a quarter in a fiscal year starting at `start`. */
export function quarterEnd(
  start: { startYear: number; startMonth: number },
  quarter: Quarter
): Due {
  const zero = start.startMonth - 1 + (Number(quarter[1]) - 1) * 3 + 2;
  return { kind: 'month', year: start.startYear + Math.floor(zero / 12), month: (zero % 12) + 1 };
}
