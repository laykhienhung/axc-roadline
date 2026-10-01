import type { DueMeaning, MappingField, QuarterMeaning, Status } from '../shared/model';
import { STATUS_LABEL, STATUS_ORDER } from '../shared/status';

/** Options offered in the mapping dialog, per field: [value, label]. */
export const MEANING_OPTIONS: Record<MappingField, [string, string][]> = {
  status: STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]]),
  quarter: [
    ['Q1', 'Q1'],
    ['Q2', 'Q2'],
    ['Q3', 'Q3'],
    ['Q4', 'Q4'],
    ['ongoing', 'Ongoing'],
    ['next_year', 'Next year'],
  ],
  due: [
    ['next_year', 'Next year'],
    ['quarter_end', 'End of its quarter'],
  ],
};

export function meaningLabel(field: MappingField, value: string): string {
  return MEANING_OPTIONS[field].find(([v]) => v === value)?.[1] ?? value;
}

export type Meaning = Status | QuarterMeaning | DueMeaning;
