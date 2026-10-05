import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authRoutes } from '../src/server/auth';
import type { AuthConfig } from '../src/server/auth-config';
import { FileAuthStore } from '../src/server/file-auth-store';
import { hashPassword } from '../src/server/password';

let app: express.Express;
let store: FileAuthStore;
let cfg: AuthConfig;

beforeEach(() => {
  store = new FileAuthStore(mkdtempSync(path.join(tmpdir(), 'roadline-auth-routes-')));
  cfg = {
    adminEmails: ['admin@example.com'],
    publicUrl: 'http://localhost:3000',
    sessionHours: 12,
    secureCookies: false,
  };
  app = express();
  authRoutes(app, { cfg, store });
});

const signUp = (email = 'person@example.com', password = 'a secure password') =>
  request(app).post('/auth/signup').send({
    name: 'Person Example',
    email,
    password,
    repeat: password,
  });

function cookie(response: request.Response): string {
  const value = response.headers['set-cookie']?.[0];
  if (!value) throw new Error('expected a session cookie');
  return value.split(';', 1)[0];
}

describe('auth routes', () => {
  it('signs up a normalized viewer, sets a safe cookie, and serves /api/me', async () => {
    const signedUp = await signUp(' Person@Example.com ');
    expect(signedUp.status).toBe(200);
    expect(signedUp.body).toMatchObject({ email: 'person@example.com', role: 'viewer' });
    const setCookie: string = signedUp.headers['set-cookie'][0];
    for (const attribute of ['HttpOnly', 'Path=/', 'Max-Age=43200', 'SameSite=Lax'])
      expect(setCookie.split('; ')).toContain(attribute);
    expect(setCookie).not.toMatch(/;\s*Secure/i);

    const me = await request(app).get('/api/me').set('Cookie', cookie(signedUp));
    expect(me.body).toMatchObject({ email: 'person@example.com', role: 'viewer' });
  });

  it('makes configured admins admin and rejects invalid and duplicate sign-ups', async () => {
    expect((await signUp('admin@example.com')).body.role).toBe('admin');
    expect((await signUp('ADMIN@example.com')).status).toBe(409);
    // Break-glass: an ADMIN_EMAILS user stored as viewer is forced back to admin at sign-in.
    const admin = await store.findUserByEmail('admin@example.com');
    if (!admin) throw new Error('expected admin user');
    await store.updateUser(admin.id, { role: 'viewer' });
    const signedIn = await request(app)
      .post('/auth/signin')
      .send({ email: 'admin@example.com', password: 'a secure password' });
    expect(signedIn.body).toMatchObject({ role: 'admin' });
    const invalid = await request(app).post('/auth/signup').send({});
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      error: 'invalid_input',
      fields: { name: expect.any(String) },
    });
  });

  it('keeps unknown and wrong credentials indistinguishable and rejects disabled accounts', async () => {
    const signedUp = await signUp();
    const unknown = await request(app)
      .post('/auth/signin')
      .send({ email: 'nobody@example.com', password: 'a secure password' });
    const wrong = await request(app)
      .post('/auth/signin')
      .send({ email: 'person@example.com', password: 'wrong password' });
    expect(unknown.body).toEqual({ error: 'invalid_credentials' });
    expect(wrong.body).toEqual(unknown.body);

    const user = await store.findUserByEmail('person@example.com');
    if (!user) throw new Error('expected signed-up user');
    await store.updateUser(user.id, { disabled: true });
    const disabled = await request(app)
      .post('/auth/signin')
      .send({ email: 'person@example.com', password: 'a secure password' });
    expect(disabled.body).toEqual({ error: 'account_disabled' });
    expect((await request(app).get('/api/me').set('Cookie', cookie(signedUp))).status).toBe(401);
  });

  it('signs out and revokes the old cookie', async () => {
    const signedUp = await signUp();
    const signedOut = await request(app).post('/auth/signout').set('Cookie', cookie(signedUp));
    expect(signedOut.status).toBe(302);
    expect(signedOut.headers.location).toBe('/signin?signedout=1');
    expect((await request(app).get('/api/me').set('Cookie', cookie(signedUp))).status).toBe(401);
  });

  it('keeps this session and revokes other sessions after a password update', async () => {
    const first = await signUp();
    const second = await request(app)
      .post('/auth/signin')
      .send({ email: 'person@example.com', password: 'a secure password' });
    const bad = await request(app).post('/api/me/password').set('Cookie', cookie(first)).send({
      current: 'wrong password',
      password: 'another safe password',
      repeat: 'another safe password',
    });
    expect(bad.body.fields.current).toBe('Current password is wrong.');

    const changed = await request(app).post('/api/me/password').set('Cookie', cookie(first)).send({
      current: 'a secure password',
      password: 'another safe password',
      repeat: 'another safe password',
    });
    expect(changed.status).toBe(200);
    expect((await request(app).get('/api/me').set('Cookie', cookie(first))).status).toBe(200);
    expect((await request(app).get('/api/me').set('Cookie', cookie(second))).status).toBe(401);
  });

  it('allows a forced password change without the reset password and clears the flag', async () => {
    const signedUp = await signUp();
    const user = await store.findUserByEmail('person@example.com');
    if (!user) throw new Error('expected signed-up user');
    await store.setPassword(user.id, await hashPassword('1111'), true);
    const forced = await request(app)
      .post('/auth/signin')
      .send({ email: user.email, password: '1111' });
    const changed = await request(app)
      .post('/api/me/password')
      .set('Cookie', cookie(forced))
      .send({ password: 'another safe password', repeat: 'another safe password' });
    expect(changed.body.mustChangePassword).toBe(false);
    expect((await request(app).get('/api/me').set('Cookie', cookie(signedUp))).status).toBe(401);
  });
});
