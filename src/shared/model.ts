/** The tone of a status: drives color, ranking and progress. */
export type Status = 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'done';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type Due =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'recurring'; every: 'monthly' | 'quarterly' }
  | { kind: 'next_year' };

export interface Action {
  targetId: string;
  section: string;
  no: number;
  quarter: Quarter | 'ongoing' | 'next_year';
  action: string;
  deliverable: string;
  measure: string | null;
  owner: string;
  due: Due;
  status: Status;
  /** The status text as written in the file ("" when blank). */
  statusWord: string;
  /** The objective detail this action belongs to ("1.1", template 4.2); absent for 2.x. */
  detailId?: string | null;
  partners?: string | null;
  /** 0..100, null when blank. */
  percent?: number | null;
  /** Reference document names ("a; b; c" → ["a", "b", "c"]). */
  references?: string[];
  note?: string | null;
}

/** A template 4.2 "objective detail" row (`1.1  Title  Goal: … Needs first: … JD: …`). */
export interface Detail {
  id: string;
  title: string;
  goal: string | null;
  needsFirst: string | null;
  jd: string | null;
}

export interface Risk {
  risk: string;
  mitigation: string;
}

export interface ChangeEntry {
  date: string;
  what: string;
  reason: string;
  by: string;
}

export interface Target {
  id: string;
  name: string;
  /** 0..1 */
  weight: number;
  owner: string;
  status: Status;
  /** The status text as written in the file ("" when blank). */
  statusWord: string;
  objective: string;
  mustAchieve: string[];
  how: string[];
  dependsOn: string[];
  risks: Risk[];
  changes: ChangeEntry[];
  actions: Action[];
  /** Where the weight came from; absent = 'file'. */
  weightSource?: 'file' | 'equal';
  details?: Detail[];
}

export interface Plan {
  title: string;
  fiscal: { startYear: number; startMonth: number };
  templateVersion: string | null;
  source: { fileName: string; importedAt: string };
  targets: Target[];
  /** `T1 - …` sheets (2.x) or `O1 - …` sheets (4.2); absent = 'targets'. */
  layout?: 'targets' | 'objectives';
  /** Share of actions Done, or the average action %; absent = 'done'. */
  progressBy?: 'done' | 'percent';
}

export interface Problem {
  sheet?: string;
  row?: number;
  message: string;
}

export type MappingField = 'status' | 'quarter' | 'due';
export type QuarterMeaning = Quarter | 'ongoing' | 'next_year';
export type DueMeaning = 'next_year' | 'quarter_end';

/** Saved value mappings (`data/mappings.json`) and the `mapping` field of an upload. */
export interface Mappings {
  /** key = normalized word, e.g. "in progress" */
  status: Record<string, Status>;
  quarter: Record<string, QuarterMeaning>;
  due: Record<string, DueMeaning>;
  /** Server only: template versions already warned about. */
  seenVersions?: string[];
}

export interface UnknownValue {
  field: MappingField;
  word: string;
  count: number;
  /** First 10 locations. */
  where: { sheet?: string; row: number }[];
  /** The word appears only in the file's dropdown list, not in any row. */
  fromDropdown: boolean;
  suggestion: Status | QuarterMeaning | DueMeaning;
}

export interface AppliedMapping {
  field: MappingField;
  word: string;
  meaning: string;
}

export type ParseResult =
  | { ok: true; plan: Plan; warnings: Problem[]; applied: AppliedMapping[] }
  | { ok: false; problems: Problem[] }
  | { ok: false; needsMapping: UnknownValue[] };

export type Cell = string | number | boolean | null;
export type Grid = Record<string, Cell[][]>;

/** Data-validation lists per sheet: `ref` is the Excel range, `values` the allowed words. */
export type Dropdowns = Record<string, { ref: string; values: string[] }[]>;

export const emptyMappings = (): Mappings => ({ status: {}, quarter: {}, due: {} });

/** A calendar day without time zone. */
export interface Ymd {
  year: number;
  month: number;
  day: number;
}
