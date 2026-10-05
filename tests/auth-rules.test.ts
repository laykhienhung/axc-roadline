import { describe, expect, it } from 'vitest';
import {
  canImport,
  normEmail,
  safeNext,
  validateNewPassword,
  validateSignup,
  initials,
} from '../src/shared/auth';

describe('auth rules', () => {
  it('validates sign-up fields with the UI copy', () => {
    const valid = {
      name: 'An Nguyen',
      email: 'an.nguyen@example.com',
      password: 'abcdefghij',
      repeat: 'abcdefghij',
    };

    expect(validateSignup({ ...valid, name: '  ' })).toEqual({ name: 'Enter your name.' });
    expect(validateSignup({ ...valid, email: 'not-an-email' })).toEqual({
      email: 'Enter a valid email address.',
    });
    expect(validateSignup({ ...valid, password: 'short', repeat: 'short' })).toEqual({
      password: 'At least 10 characters.',
    });
    expect(validateSignup({ ...valid, repeat: 'different-password' })).toEqual({
      repeat: "Passwords don't match.",
    });
    expect(validateSignup(valid)).toEqual({});
  });

  it('rejects a new password that is the current password', () => {
    expect(
      validateNewPassword({
        current: 'abcdefghij',
        password: 'abcdefghij',
        repeat: 'abcdefghij',
      })
    ).toEqual({ password: "The new password can't be the same as the current one." });
  });

  it('normalizes email addresses', () => {
    expect(normEmail(' A@B.com ')).toBe('a@b.com');
  });

  it('keeps only safe internal next paths', () => {
    for (const next of [
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      '/signin',
      '/signup',
      '/update-password',
      '/auth/signout',
    ]) {
      expect(safeNext(next)).toBe('/');
    }
    expect(safeNext('/target/T1?today=2026-09-28')).toBe('/target/T1?today=2026-09-28');
  });

  it('allows editors and admins to import', () => {
    expect(canImport('viewer')).toBe(false);
    expect(canImport('editor')).toBe(true);
    expect(canImport('admin')).toBe(true);
  });

  it('builds avatar initials', () => {
    expect(initials('Hung Lay')).toBe('HL');
    expect(initials('  an   van nguyen ')).toBe('AN');
    expect(initials('Admin')).toBe('AD');
    expect(initials('   ')).toBe('?');
  });
});
