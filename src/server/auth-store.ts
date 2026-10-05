import { createHash, randomBytes } from 'node:crypto';
import type { AdminUser, Me, Role } from '../shared/auth.js';

export interface UserRow extends Me {
  passwordHash: string;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface AuthStore {
  createUser(user: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
  }): Promise<UserRow | 'email_taken'>;
  findUserByEmail(email: string): Promise<UserRow | null>;
  markSignedIn(id: number, forceAdmin: boolean): Promise<UserRow>;
  createSession(userId: number, userAgent: string | null, hours: number): Promise<string>;
  findSession(token: string): Promise<UserRow | null>;
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: number, exceptToken?: string): Promise<number>;
  deleteExpiredSessions(): Promise<number>;
  setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void>;
  listUsers(adminEmails: string[]): Promise<AdminUser[]>;
  updateUser(id: number, patch: { role?: Role; disabled?: boolean }): Promise<AdminUser | null>;
}

/** Hash a raw session token before it is persisted. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

/** Create the opaque 32-byte token sent in the session cookie. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}
