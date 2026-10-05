import { readFileSync } from 'node:fs';
import request from 'supertest';
import type { Express } from 'express';
import { readGrid } from '../src/server/read-grid';
import { readAuthConfig, type AuthConfig } from '../src/server/auth-config';
import { FileAuthStore } from '../src/server/file-auth-store';
import type { Role } from '../src/shared/auth';
import type { Mappings, ParseResult, Plan } from '../src/shared/model';
import { parseAxcWorkbook } from '../src/shared/parse-axc';

export const FIXTURE = 'tests/fixtures/axc-fy2026-27.xlsx';
export const FIXTURE_V21 = 'tests/fixtures/axc-fy2026-27-v2.1.xlsx';
export const FIXTURE_V42 = 'tests/fixtures/axc-fy2026-27-v4.2.xlsx';

/** The mappings a user would accept for the v2.1 workbook (the suggested ones). */
export const V21_MAPPINGS: Mappings = {
  status: { 'in progress': 'on_track', blocked: 'behind' },
  quarter: { 'fy27-28': 'next_year' },
  due: {},
};

/** The mappings a user would give the 4.2 workbook (its status word and free-text due words). */
export const V42_MAPPINGS: Mappings = {
  status: { 'in progress': 'on_track' },
  quarter: {},
  due: {
    yearly: 'quarter_end',
    'per bod schedule': 'quarter_end',
    'per bod review': 'quarter_end',
    'per pilot': 'quarter_end',
    'per course': 'quarter_end',
  },
};

export function parseFixture(path: string, mappings?: Mappings): ParseResult {
  const { grid, dropdowns } = readGrid(readFileSync(path), path.split('/').pop()!);
  return parseAxcWorkbook(grid, path.split('/').pop()!, '2026-09-28T07:02:00.000Z', {
    mappings,
    dropdowns,
  });
}

function okPlan(res: ParseResult): Plan {
  if (!res.ok) throw new Error(JSON.stringify(res));
  return res.plan;
}

/** The real v2.0 AXC workbook parsed into a Plan (fresh copy per call). */
export const fixturePlan = (): Plan => okPlan(parseFixture(FIXTURE));

/** The v2.1 workbook with the suggested mappings applied. */
export const fixturePlanV21 = (): Plan => okPlan(parseFixture(FIXTURE_V21, V21_MAPPINGS));

/** The 4.2 workbook (objectives, % column, objective details) with `V42_MAPPINGS`. */
export const fixturePlanV42 = (): Plan => okPlan(parseFixture(FIXTURE_V42, V42_MAPPINGS));

/** Status per action for the "Dec plan" in the roadline-v2 mockups (unlisted = Not started). */
const DEC_STATUS: Record<string, Partial<Record<Plan['targets'][number]['status'], number[]>>> = {
  T1: { done: [1, 2, 14, 16], behind: [3], at_risk: [4, 15, 17], on_track: [5, 18] },
  T2: { done: [1, 2, 3, 12, 14], behind: [13], on_track: [4, 5, 7, 16, 20] },
  T3: { done: [1, 11, 12], behind: [2], at_risk: [3], on_track: [9, 13] },
  T4: { done: [1, 2, 3], on_track: [4, 8] },
};
const DEC_TARGET = { T1: 'at_risk', T2: 'on_track', T3: 'behind', T4: 'on_track' } as const;

/** The v2.0 fixture with the mockups' statuses, meant to be viewed on 10 Dec 2026. */
export function decPlan(): Plan {
  const plan = fixturePlan();
  for (const t of plan.targets) {
    t.status = DEC_TARGET[t.id as keyof typeof DEC_TARGET];
    t.statusWord = '';
    for (const a of t.actions) {
      const hit = Object.entries(DEC_STATUS[t.id]).find(([, nos]) => nos!.includes(a.no));
      a.status = (hit?.[0] as typeof a.status) ?? 'not_started';
      a.statusWord = '';
    }
  }
  return plan;
}
export const DEC_TODAY = { year: 2026, month: 12, day: 10 };

export function testAuth(dir: string, overrides: Partial<AuthConfig> = {}) {
  const cfg: AuthConfig = {
    ...readAuthConfig({}, { port: 3000 }),
    adminEmails: ['admin@example.com'],
    ...overrides,
  };
  return { cfg, store: new FileAuthStore(dir) };
}

/** Sign a user up through the API, then give them `role` directly in the store. */
export async function signIn(
  app: Express,
  store: FileAuthStore,
  email: string,
  role: Role
): Promise<string> {
  const password = 'password1234';
  const result = await request(app)
    .post('/auth/signup')
    .send({
      name: email.split('@')[0],
      email,
      password,
      repeat: password,
    });
  const user = await store.findUserByEmail(email);
  if (!user) throw new Error(`Could not sign up ${email}`);
  await store.updateUser(user.id, { role });
  return result.headers['set-cookie'][0].split(';')[0];
}
