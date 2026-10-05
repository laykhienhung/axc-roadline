import type { Plan } from './model.js';

export interface Noun {
  one: string;
  many: string;
  One: string;
  Many: string;
}

const OBJECTIVE: Noun = {
  one: 'objective',
  many: 'objectives',
  One: 'Objective',
  Many: 'Objectives',
};
const TARGET: Noun = { one: 'target', many: 'targets', One: 'Target', Many: 'Targets' };

/** What the UI calls a plan's targets: "objective" for a 4.2 plan, else "target". */
export function nounFor(plan: Pick<Plan, 'layout'> | null | undefined): Noun {
  return plan?.layout === 'objectives' ? OBJECTIVE : TARGET;
}
