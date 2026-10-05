import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileAuthStore } from '../src/server/file-auth-store';

function createStore(): FileAuthStore {
  return new FileAuthStore(mkdtempSync(path.join(tmpdir(), 'roadline-auth-store-')));
}

async function createUser(store: FileAuthStore) {
  const user = await store.createUser({
    email: 'person@example.com',
    name: 'Person Example',
    passwordHash: 'hashed-secret',
    role: 'viewer',
  });
  if (user === 'email_taken') throw new Error('expected a new user');
  return user;
}

describe('FileAuthStore', () => {
  it('creates users and rejects duplicates', async () => {
    const store = createStore();
    await createUser(store);

    await expect(
      store.createUser({
        email: 'person@example.com',
        name: 'Another Person',
        passwordHash: 'different-hash',
        role: 'editor',
      })
    ).resolves.toBe('email_taken');
  });

  it('stores only a session token hash and never a raw password', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'roadline-auth-store-'));
    const store = new FileAuthStore(dataDir);
    const user = await store.createUser({
      email: 'person@example.com',
      name: 'Person Example',
      passwordHash: 'scrypt$stored-hash',
      role: 'viewer',
    });
    if (user === 'email_taken') throw new Error('expected a new user');
    const token = await store.createSession(user.id, 'Vitest', 1);

    expect(await store.findSession(token)).toMatchObject({ id: user.id, email: user.email });
    expect(readFileSync(path.join(dataDir, 'sessions.json'), 'utf8')).not.toContain(token);
    expect(readFileSync(path.join(dataDir, 'users.json'), 'utf8')).not.toContain('plain-password');
  });

  it('rejects expired and disabled sessions while keeping an enabled user role', async () => {
    const store = createStore();
    const user = await createUser(store);
    const expired = await store.createSession(user.id, null, -1);
    expect(await store.findSession(expired)).toBeNull();

    const active = await store.createSession(user.id, null, 1);
    await store.updateUser(user.id, { role: 'editor', disabled: true });
    expect(await store.findSession(active)).toBeNull();
    await store.updateUser(user.id, { disabled: false });
    expect(await store.findUserByEmail(user.email)).toMatchObject({
      role: 'editor',
      disabled: false,
    });
  });

  it('revokes sessions on a forced password reset and keeps an excepted session', async () => {
    const store = createStore();
    const user = await createUser(store);
    const first = await store.createSession(user.id, null, 1);
    const second = await store.createSession(user.id, null, 1);

    expect(await store.deleteUserSessions(user.id, first)).toBe(1);
    expect(await store.findSession(first)).not.toBeNull();
    expect(await store.findSession(second)).toBeNull();

    await store.setPassword(user.id, 'new-hash', true);
    expect(await store.findSession(first)).toBeNull();
    expect(await store.findUserByEmail(user.email)).toMatchObject({ mustChangePassword: true });
  });

  it('removes and counts expired sessions', async () => {
    const store = createStore();
    const user = await createUser(store);
    await store.createSession(user.id, null, -1);
    await store.createSession(user.id, null, 1);

    await expect(store.deleteExpiredSessions()).resolves.toBe(1);
  });
});
