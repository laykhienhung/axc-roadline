import type { DueMeaning, QuarterMeaning, Status } from './model.js';

/** Key used to compare and store words: trimmed, whitespace collapsed, lower-case. */
export function normWord(word: string): string {
  return word.replace(/\s+/g, ' ').trim().toLowerCase();
}

const STATUS_KEYWORDS: [RegExp, Status][] = [
  [/^(done|complete|completed|finished)$/, 'done'],
  [/^(behind|blocked|overdue|late|stuck|on hold)$/, 'behind'],
  [/^(at risk|risk|delayed|slipping)$/, 'at_risk'],
  [/^(in progress|on track|started|wip|ongoing)$/, 'on_track'],
];

export function suggestStatus(word: string): Status {
  const w = normWord(word);
  return STATUS_KEYWORDS.find(([re]) => re.test(w))?.[1] ?? 'not_started';
}

export function suggestQuarter(word: string): QuarterMeaning {
  const w = normWord(word).replace(/\s+/g, '');
  const q = /^q([1-4])$/.exec(w);
  if (q) return `Q${q[1]}` as QuarterMeaning;
  if (w === 'ongoing' || w === 'allyear') return 'ongoing';
  return 'next_year';
}

export function suggestDue(word: string): DueMeaning {
  return /^(next year|later)$/.test(normWord(word)) ? 'next_year' : 'quarter_end';
}
