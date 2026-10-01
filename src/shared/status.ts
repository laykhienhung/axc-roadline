import type { Status } from './model.js';

export const STATUS_ORDER: Status[] = ['not_started', 'on_track', 'at_risk', 'behind', 'done'];

export const STATUS_LABEL: Record<Status, string> = {
  not_started: 'Not started',
  on_track: 'On track',
  at_risk: 'At risk',
  behind: 'Behind',
  done: 'Done',
};

const BY_LABEL = new Map(STATUS_ORDER.map((s) => [STATUS_LABEL[s].toLowerCase(), s]));

/** Blank → not_started; unknown text → null. */
export function parseStatus(text: unknown): Status | null {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (t === '') return 'not_started';
  return BY_LABEL.get(t) ?? null;
}
