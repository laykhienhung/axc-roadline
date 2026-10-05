export type Role = 'viewer' | 'editor' | 'admin';

export interface Me {
  id: number;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface ImportLogItem {
  id: number;
  at: string;
  userEmail: string | null;
  fileName: string | null;
  fileSize: number | null;
  outcome:
    | 'ok'
    | 'invalid_plan'
    | 'needs_mapping'
    | 'invalid_mapping'
    | 'no_file'
    | 'file_too_large'
    | 'unsupported_type'
    | 'forbidden';
  planId: number | null;
  current: boolean;
  detail: string;
}

export type FieldErrors = Partial<
  Record<'name' | 'email' | 'password' | 'repeat' | 'current', string>
>;

export const MIN_PASSWORD = 10;
export const RESET_PASSWORD = '1111';
const MAX_PASSWORD = 200;

export function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateSignup(input: {
  name: string;
  email: string;
  password: string;
  repeat: string;
}): FieldErrors {
  const fields: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 1 || name.length > 100) fields.name = 'Enter your name.';
  if (!isEmail(normEmail(input.email))) fields.email = 'Enter a valid email address.';
  addPasswordErrors(fields, input.password, input.repeat);
  return fields;
}

export function validateNewPassword(input: {
  password: string;
  repeat: string;
  current?: string;
}): FieldErrors {
  const fields: FieldErrors = {};
  addPasswordErrors(fields, input.password, input.repeat);
  if (input.current !== undefined && input.password === input.current) {
    fields.password = "The new password can't be the same as the current one.";
  }
  return fields;
}

export const canImport = (role: Role): boolean => role === 'editor' || role === 'admin';

export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.includes('\\')) return '/';

  const pathname = next.split(/[?#]/, 1)[0];
  if (
    pathname === '/signin' ||
    pathname === '/signup' ||
    pathname === '/update-password' ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/')
  ) {
    return '/';
  }
  return next;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  // "Hung Lay" → HL; a single word gives its first two letters ("Admin" → AD).
  const letters =
    words.length > 1
      ? firstCharacter(words[0]) + firstCharacter(words[words.length - 1])
      : Array.from(words[0]).slice(0, 2).join('');
  return letters.toUpperCase();
}

function isEmail(email: string): boolean {
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  return domain.length > 0 && domain.includes('.');
}

function addPasswordErrors(fields: FieldErrors, password: string, repeat: string): void {
  if (password.length < MIN_PASSWORD) fields.password = `At least ${MIN_PASSWORD} characters.`;
  else if (password.length > MAX_PASSWORD) fields.password = `At most ${MAX_PASSWORD} characters.`;
  if (password !== repeat) fields.repeat = "Passwords don't match.";
}

function firstCharacter(word: string): string {
  return Array.from(word)[0] ?? '';
}
