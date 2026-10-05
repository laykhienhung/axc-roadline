import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/server/password.js';

describe('password hashing', () => {
  it('salts scrypt hashes', async () => {
    const first = await hashPassword('correct horse 1');
    const second = await hashPassword('correct horse 1');

    expect(first).toMatch(/^scrypt\$/);
    expect(second).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
  });

  it('verifies only the matching password', async () => {
    const hash = await hashPassword('correct horse 1');

    await expect(verifyPassword('correct horse 1', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('treats malformed stored values as invalid', async () => {
    await expect(verifyPassword('correct horse 1', 'not-a-scrypt-hash')).resolves.toBe(false);
  });

  it('reads cost parameters from the stored hash', async () => {
    const { scryptSync, randomBytes } = await import('node:crypto');
    const salt = randomBytes(16);
    const key = scryptSync('correct horse 1', salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const raised = `scrypt$32768$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
    await expect(verifyPassword('correct horse 1', raised)).resolves.toBe(true);
  });

  it('rejects unbounded cost parameters without running scrypt', async () => {
    const salt = Buffer.alloc(16).toString('base64');
    const key = Buffer.alloc(64).toString('base64');
    await expect(verifyPassword('x', `scrypt$1073741824$8$1$${salt}$${key}`)).resolves.toBe(false);
    await expect(verifyPassword('x', `scrypt$1000$8$1$${salt}$${key}`)).resolves.toBe(false);
  });
});
