import { describe, expect, it } from 'vitest';
import { readAuthConfig } from '../src/server/auth-config.js';

describe('auth config', () => {
  it('uses the documented defaults', () => {
    expect(readAuthConfig({}, { port: 3000 })).toEqual({
      adminEmails: [],
      publicUrl: 'http://localhost:3000',
      sessionHours: 12,
      secureCookies: false,
    });
  });

  it('normalizes configured administrators and uses the dev URL fallback', () => {
    expect(
      readAuthConfig(
        { ADMIN_EMAILS: ' Hung.Lay@Example.com, ADMIN@example.com ', SESSION_HOURS: '24' },
        { port: 3000, devClientUrl: 'http://localhost:5173' }
      )
    ).toEqual({
      adminEmails: ['hung.lay@example.com', 'admin@example.com'],
      publicUrl: 'http://localhost:5173',
      sessionHours: 24,
      secureCookies: false,
    });
  });

  it('permits an empty admin list and enables secure cookies only for HTTPS', () => {
    expect(
      readAuthConfig(
        { ADMIN_EMAILS: '  ', PUBLIC_URL: 'https://roadline.example', SESSION_HOURS: '1' },
        { port: 3000 }
      )
    ).toMatchObject({ adminEmails: [], secureCookies: true });

    expect(
      readAuthConfig({ PUBLIC_URL: 'http://roadline.example' }, { port: 3000 }).secureCookies
    ).toBe(false);
  });
});
