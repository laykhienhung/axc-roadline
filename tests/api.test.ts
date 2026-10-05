import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app';
import { emptyMappings } from '../src/shared/model';
import { StorageUnavailableError, type Storage } from '../src/server/storage';
import { FIXTURE, FIXTURE_V21, testAuth, V21_MAPPINGS } from './helpers';

const workbook = readFileSync(FIXTURE);
const workbookV21 = readFileSync(FIXTURE_V21);
let dataDir: string;
let app: ReturnType<typeof createApp>;
let cookie: string;
let auth: ReturnType<typeof testAuth>;

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'roadline-'));
  dataDir = path.join(root, 'data');
  const clientDir = path.join(root, 'client');
  mkdirSync(clientDir);
  writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><div id="root"></div>');
  auth = testAuth(dataDir);
  app = createApp({ dataDir, clientDir, auth });
  const signedUp = await request(app).post('/auth/signup').send({
    name: 'Editor',
    email: 'editor@example.com',
    password: 'password1234',
    repeat: 'password1234',
  });
  const user = await auth.store.findUserByEmail('editor@example.com');
  await auth.store.updateUser(user!.id, { role: 'editor' });
  cookie = signedUp.headers['set-cookie'][0].split(';')[0];
});

const upload = (buf: Buffer, name: string) =>
  request(app).post('/api/plan').set('Cookie', cookie).attach('file', buf, name);

describe('plan API', () => {
  it('returns 404 no_plan before any import', async () => {
    const res = await request(app).get('/api/plan').set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'no_plan' });
  });

  it('imports a valid workbook, stores it, and serves it', async () => {
    const res = await upload(workbook, 'axc-fy2026-27.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.plan.targets).toHaveLength(4);
    expect(res.body.warnings).toEqual([]);
    expect(existsSync(path.join(dataDir, 'plan.json'))).toBe(true);
    const get = await request(app).get('/api/plan').set('Cookie', cookie);
    expect(get.status).toBe(200);
    expect(get.body.source.fileName).toBe('axc-fy2026-27.xlsx');
  });

  it('writes an ok audit entry after an import', async () => {
    const res = await upload(workbook, 'axc-fy2026-27.xlsx');
    expect(res.status).toBe(200);
    const entries = readFileSync(path.join(dataDir, 'imports.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { outcome: string; fileName: string; at: string });
    expect(entries).toEqual([
      expect.objectContaining({
        outcome: 'ok',
        fileName: 'axc-fy2026-27.xlsx',
        at: expect.any(String),
      }),
    ]);
  });

  it('keeps the previous plan on a second import', async () => {
    await upload(workbook, 'first.xlsx');
    await upload(workbook, 'second.xlsx');
    const prev = JSON.parse(readFileSync(path.join(dataDir, 'plan.prev.json'), 'utf8'));
    expect(prev.source.fileName).toBe('first.xlsx');
  });

  it('rejects an invalid file and keeps the current plan', async () => {
    await upload(workbook, 'good.xlsx');
    const bad = await upload(Buffer.from('target_id,no\nT1,1\n'), 'bad.csv');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('invalid_plan');
    expect(bad.body.problems.length).toBeGreaterThan(0);
    const get = await request(app).get('/api/plan').set('Cookie', cookie);
    expect(get.body.source.fileName).toBe('good.xlsx');
  });

  it('writes invalid_plan audit entries with their problems', async () => {
    const res = await upload(Buffer.from('target_id,no\nT1,1\n'), 'bad.csv');
    expect(res.status).toBe(400);
    const [entry] = readFileSync(path.join(dataDir, 'imports.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { outcome: string; problems: unknown[] });
    expect(entry.outcome).toBe('invalid_plan');
    expect(entry.problems).toEqual(res.body.problems);
  });

  it('rejects unsupported types with 415', async () => {
    const res = await upload(Buffer.from('%PDF-1.4'), 'plan.pdf');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'unsupported_type' });
    expect(existsSync(path.join(dataDir, 'plan.json'))).toBe(false);
  });

  it('audits rejected .txt files as unsupported_type', async () => {
    const res = await upload(Buffer.from('not a plan'), 'plan.txt');
    expect(res.status).toBe(415);
    expect(readFileSync(path.join(dataDir, 'imports.jsonl'), 'utf8')).toContain(
      '"unsupported_type"'
    );
  });

  it('rejects files over 5 MB with 413', async () => {
    const res = await upload(Buffer.alloc(6 * 1024 * 1024), 'big.xlsx');
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'file_too_large' });
    expect(existsSync(path.join(dataDir, 'plan.json'))).toBe(false);
  });

  it('audits files over 5 MB as file_too_large', async () => {
    const res = await upload(Buffer.alloc(6 * 1024 * 1024), 'big.xlsx');
    expect(res.status).toBe(413);
    expect(readFileSync(path.join(dataDir, 'imports.jsonl'), 'utf8')).toContain('"file_too_large"');
  });

  it('returns the original rejection when non-ok audit logging fails', async () => {
    const storage: Storage = {
      loadPlan: async () => null,
      loadMappings: async () => emptyMappings(),
      commitImport: async () => {},
      logImport: async () => {
        throw new Error('audit unavailable');
      },
      listImports: async () => ({ items: [], nextBefore: null }),
      close: async () => {},
    };
    const withFailedAudit = createApp({
      dataDir,
      clientDir: path.join(path.dirname(dataDir), 'client'),
      storage,
      auth,
    });
    const res = await request(withFailedAudit)
      .post('/api/plan')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('x'), 'plan.xlsx')
      .field('mapping', '{not json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_mapping' });
  });

  it('returns db_unavailable when storage cannot load the plan', async () => {
    const storage: Storage = {
      loadPlan: async () => {
        throw new StorageUnavailableError('database unavailable');
      },
      loadMappings: async () => emptyMappings(),
      commitImport: async () => {},
      logImport: async () => {},
      listImports: async () => ({ items: [], nextBefore: null }),
      close: async () => {},
    };
    const unavailable = createApp({
      dataDir,
      clientDir: path.join(path.dirname(dataDir), 'client'),
      storage,
      auth,
    });
    const res = await request(unavailable).get('/api/plan').set('Cookie', cookie);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'db_unavailable' });
  });

  it('serves the web page for deep links', async () => {
    const res = await request(app).get('/target/T1').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });
});

const uploadWith = (buf: Buffer, name: string, mapping: unknown) =>
  request(app)
    .post('/api/plan')
    .set('Cookie', cookie)
    .attach('file', buf, name)
    .field('mapping', typeof mapping === 'string' ? mapping : JSON.stringify(mapping));

describe('plan API — mapping round trip', () => {
  const mappingsFile = () => path.join(dataDir, 'mappings.json');

  it('answers 422 needs_mapping for unknown words and saves nothing', async () => {
    await upload(workbook, 'v20.xlsx');
    const before = readFileSync(path.join(dataDir, 'plan.json'), 'utf8');
    const res = await upload(workbookV21, 'v21.xlsx');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('needs_mapping');
    expect(res.body.unknown.map((u: { word: string }) => u.word).sort()).toEqual([
      'Blocked',
      'FY27-28',
      'In progress',
    ]);
    expect(readFileSync(path.join(dataDir, 'plan.json'), 'utf8')).toBe(before);
    const saved = JSON.parse(readFileSync(mappingsFile(), 'utf8'));
    expect(saved.status).toEqual({}); // only the v2.0 version was recorded
  });

  it('imports with a mapping, saves it, and reuses it next time', async () => {
    const first = await uploadWith(workbookV21, 'v21.xlsx', V21_MAPPINGS);
    expect(first.status).toBe(200);
    expect(first.body.applied).toHaveLength(3);
    expect(first.body.warnings).toContainEqual(
      expect.objectContaining({ message: 'template version 2.1 is newer than tested 2.0' })
    );
    const saved = JSON.parse(readFileSync(mappingsFile(), 'utf8'));
    expect(saved).toMatchObject({
      status: { 'in progress': 'on_track', blocked: 'behind' },
      quarter: { 'fy27-28': 'next_year' },
      seenVersions: ['2.1'],
    });

    const again = await upload(workbookV21, 'v21.xlsx');
    expect(again.status).toBe(200);
    expect(again.body.applied).toHaveLength(3);
    expect(again.body.warnings).toEqual([]);
  });

  it('rejects a bad mapping field with 400 invalid_mapping', async () => {
    const bad = await uploadWith(workbookV21, 'v21.xlsx', '{not json');
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'invalid_mapping' });
    const unknownMeaning = await uploadWith(workbookV21, 'v21.xlsx', {
      status: { 'in progress': 'sort of' },
    });
    expect(unknownMeaning.status).toBe(400);
    expect(existsSync(mappingsFile())).toBe(false);
    expect(existsSync(path.join(dataDir, 'plan.json'))).toBe(false);
  });
});

describe('dev mode', () => {
  it('redirects page requests to the Vite dev server and still serves the API', async () => {
    const dev = createApp({
      dataDir,
      clientDir: '/nowhere',
      devClientUrl: 'http://localhost:5173',
      auth,
    });
    const page = await request(dev).get('/target/T1?today=2026-09-29');
    expect(page.status).toBe(302);
    expect(page.headers.location).toBe('http://localhost:5173/target/T1?today=2026-09-29');
    const api = await request(dev).get('/api/plan').set('Cookie', cookie);
    expect(api.status).toBe(404);
    expect(api.body).toEqual({ error: 'no_plan' });
  });
});
