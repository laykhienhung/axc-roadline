import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app';
import { FIXTURE, signIn, testAuth } from './helpers';

let app: ReturnType<typeof createApp>;
let viewerCookie: string;
let editorCookie: string;
let dataDir: string;

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'roadline-auth-gate-'));
  dataDir = path.join(root, 'data');
  const clientDir = path.join(root, 'client');
  mkdirSync(path.join(clientDir, 'assets'), { recursive: true });
  writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(path.join(clientDir, 'assets', 'x.js'), 'export {};');
  const auth = testAuth(dataDir);
  app = createApp({ dataDir, clientDir, auth });
  viewerCookie = await signIn(app, auth.store, 'viewer@example.com', 'viewer');
  editorCookie = await signIn(app, auth.store, 'editor@example.com', 'editor');
});

describe('authenticated application gate', () => {
  it('rejects anonymous API calls without changing the plan', async () => {
    for (const endpoint of ['/api/plan', '/api/me', '/api/admin/users']) {
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(401);
    }
    const post = await request(app)
      .post('/api/plan')
      .attach('file', readFileSync(FIXTURE), 'plan.xlsx');
    expect(post.status).toBe(401);
    expect(await request(app).get('/api/plan').set('Cookie', editorCookie)).toMatchObject({
      status: 404,
    });
  });

  it('audits viewer import refusals and editor imports with their email', async () => {
    const forbidden = await request(app)
      .post('/api/plan')
      .set('Cookie', viewerCookie)
      .attach('file', readFileSync(FIXTURE), 'plan.xlsx');
    expect(forbidden).toMatchObject({ status: 403, body: { error: 'forbidden' } });

    const imported = await request(app)
      .post('/api/plan')
      .set('Cookie', editorCookie)
      .attach('file', readFileSync(FIXTURE), 'plan.xlsx');
    expect(imported.status).toBe(200);
    const audit = readFileSync(path.join(dataDir, 'imports.jsonl'), 'utf8');
    expect(audit).toContain('"forbidden"');
    expect(audit).toContain('viewer@example.com');
    expect(audit).toContain('editor@example.com');
  });

  it('rejects a foreign origin and redirects unprotected pages to sign-in', async () => {
    const foreign = await request(app)
      .post('/api/plan')
      .set('Cookie', editorCookie)
      .set('Origin', 'https://evil.example');
    expect(foreign).toMatchObject({ status: 403, body: { error: 'bad_origin' } });

    expect(await request(app).get('/target/T1?today=2026-09-28')).toMatchObject({
      status: 302,
      headers: { location: '/signin?next=%2Ftarget%2FT1%3Ftoday%3D2026-09-28' },
    });
    expect((await request(app).get('/signin')).status).toBe(200);
    expect((await request(app).get('/signup')).status).toBe(200);
    expect((await request(app).get('/assets/x.js')).status).toBe(200);
  });
});
