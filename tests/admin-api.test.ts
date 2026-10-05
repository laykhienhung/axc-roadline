import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app';
import { FileStorage } from '../src/server/file-storage';
import { signIn, testAuth } from './helpers';

let app: ReturnType<typeof createApp>;
let adminCookie: string;
let editorCookie: string;
let auth: ReturnType<typeof testAuth>;
let storage: FileStorage;

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'roadline-admin-'));
  const dataDir = path.join(root, 'data');
  const clientDir = path.join(root, 'client');
  mkdirSync(clientDir);
  writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><div id="root"></div>');
  auth = testAuth(dataDir);
  storage = new FileStorage(dataDir);
  app = createApp({ dataDir, clientDir, auth, storage });
  adminCookie = await signIn(app, auth.store, 'admin@example.com', 'admin');
  editorCookie = await signIn(app, auth.store, 'editor@example.com', 'editor');
});

describe('admin API', () => {
  it('allows only admins to manage accounts', async () => {
    for (const endpoint of ['/api/admin/users', '/api/admin/imports']) {
      expect((await request(app).get(endpoint).set('Cookie', editorCookie)).status).toBe(403);
    }
    expect(
      (
        await request(app)
          .patch('/api/admin/users/1')
          .set('Cookie', editorCookie)
          .send({ role: 'viewer' })
      ).status
    ).toBe(403);
  });

  it('updates users, revokes sessions, resets passwords, and pages import logs', async () => {
    const users = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
    const editor = users.body.find(
      (user: { email: string }) => user.email === 'editor@example.com'
    );
    expect(users.status).toBe(200);

    const changed = await request(app)
      .patch(`/api/admin/users/${editor.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'viewer' });
    expect(changed.body.role).toBe('viewer');
    expect((await request(app).get('/api/me').set('Cookie', editorCookie)).body.role).toBe(
      'viewer'
    );

    const disabled = await request(app)
      .patch(`/api/admin/users/${editor.id}`)
      .set('Cookie', adminCookie)
      .send({ disabled: true });
    expect(disabled.body.disabled).toBe(true);
    expect((await request(app).get('/api/me').set('Cookie', editorCookie)).status).toBe(401);
    const disabledSignIn = await request(app)
      .post('/auth/signin')
      .send({ email: 'editor@example.com', password: 'password1234' });
    expect(disabledSignIn.status).toBe(403);

    await request(app)
      .patch(`/api/admin/users/${editor.id}`)
      .set('Cookie', adminCookie)
      .send({ disabled: false });
    const reset = await request(app)
      .post(`/api/admin/users/${editor.id}/reset-password`)
      .set('Cookie', adminCookie);
    expect(reset.body.mustChangePassword).toBe(true);
    const resetSignIn = await request(app)
      .post('/auth/signin')
      .send({ email: 'editor@example.com', password: '1111' });
    expect(resetSignIn.body.mustChangePassword).toBe(true);

    await storage.logImport({
      userEmail: 'admin@example.com',
      fileName: 'one.xlsx',
      fileSize: 1,
      outcome: 'ok',
    });
    await storage.logImport({
      userEmail: 'admin@example.com',
      fileName: 'two.xlsx',
      fileSize: 2,
      outcome: 'invalid_plan',
      problems: [{ message: 'bad' }],
    });
    const imports = await request(app).get('/api/admin/imports?limit=1').set('Cookie', adminCookie);
    expect(imports.body.items).toHaveLength(1);
    expect(imports.body.nextBefore).toBeTypeOf('number');
  });

  it('protects locked and self rows and rejects malformed requests', async () => {
    expect(
      (
        await request(app)
          .patch('/api/admin/users/1')
          .set('Cookie', adminCookie)
          .send({ role: 'viewer' })
      ).body
    ).toEqual({ error: 'locked' });
    const users = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
    const self = users.body.find((user: { email: string }) => user.email === 'admin@example.com');
    expect(
      (
        await request(app)
          .post(`/api/admin/users/${self.id}/signout-all`)
          .set('Cookie', adminCookie)
      ).body
    ).toEqual({ error: 'self' });
    expect(
      (
        await request(app)
          .patch('/api/admin/users/999')
          .set('Cookie', adminCookie)
          .send({ role: 'nope' })
      ).body
    ).toEqual({ error: 'invalid_body' });
    expect(
      (
        await request(app)
          .patch('/api/admin/users/999')
          .set('Cookie', adminCookie)
          .send({ role: 'viewer' })
      ).status
    ).toBe(404);
  });
});
