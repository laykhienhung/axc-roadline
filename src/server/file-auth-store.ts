import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AdminUser, Role } from '../shared/auth.js';
import { normEmail } from '../shared/auth.js';
import { hashToken, newToken, type AuthStore, type UserRow } from './auth-store.js';

interface FileUser extends UserRow {
  passwordChangedAt: string | null;
}

interface FileSession {
  tokenHash: string;
  userId: number;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  userAgent: string | null;
}

const FIVE_MINUTES = 5 * 60 * 1000;

/** JSON-file AuthStore used by local runs and tests, so tests never require PostgreSQL. */
export class FileAuthStore implements AuthStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataDir: string) {}

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
  }): Promise<UserRow | 'email_taken'> {
    return this.mutate(async () => {
      const users = await this.readUsers();
      const email = normEmail(input.email);
      if (users.some((user) => user.email === email)) return 'email_taken';
      const now = new Date().toISOString();
      const user: FileUser = {
        id: Math.max(0, ...users.map(({ id }) => id)) + 1,
        email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
        mustChangePassword: false,
        disabled: false,
        createdAt: now,
        lastSignInAt: null,
        passwordChangedAt: null,
      };
      users.push(user);
      await this.writeUsers(users);
      return user;
    });
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    return (await this.readUsers()).find((user) => user.email === normEmail(email)) ?? null;
  }

  async markSignedIn(id: number, forceAdmin: boolean): Promise<UserRow> {
    return this.mutate(async () => {
      const users = await this.readUsers();
      const user = this.userById(users, id);
      user.lastSignInAt = new Date().toISOString();
      if (forceAdmin) user.role = 'admin';
      await this.writeUsers(users);
      return user;
    });
  }

  async createSession(userId: number, userAgent: string | null, hours: number): Promise<string> {
    return this.mutate(async () => {
      const sessions = await this.readSessions();
      const token = newToken();
      const now = new Date();
      sessions.push({
        tokenHash: hashToken(token).toString('hex'),
        userId,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString(),
        lastSeenAt: now.toISOString(),
        userAgent,
      });
      await this.writeSessions(sessions);
      return token;
    });
  }

  async findSession(token: string): Promise<UserRow | null> {
    return this.mutate(async () => {
      const sessions = await this.readSessions();
      const session = sessions.find((item) => item.tokenHash === hashToken(token).toString('hex'));
      if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
      const user = (await this.readUsers()).find((item) => item.id === session.userId);
      if (!user || user.disabled) return null;
      if (Date.now() - new Date(session.lastSeenAt).getTime() >= FIVE_MINUTES) {
        session.lastSeenAt = new Date().toISOString();
        await this.writeSessions(sessions);
      }
      return user;
    });
  }

  async deleteSession(token: string): Promise<void> {
    await this.mutate(async () => {
      const sessions = await this.readSessions();
      const tokenHash = hashToken(token).toString('hex');
      await this.writeSessions(sessions.filter((session) => session.tokenHash !== tokenHash));
    });
  }

  async deleteUserSessions(userId: number, exceptToken?: string): Promise<number> {
    return this.mutate(async () => {
      const sessions = await this.readSessions();
      const exceptHash = exceptToken ? hashToken(exceptToken).toString('hex') : undefined;
      const kept = sessions.filter(
        (session) => session.userId !== userId || session.tokenHash === exceptHash
      );
      await this.writeSessions(kept);
      return sessions.length - kept.length;
    });
  }

  async deleteExpiredSessions(): Promise<number> {
    return this.mutate(async () => {
      const sessions = await this.readSessions();
      const kept = sessions.filter(
        (session) => new Date(session.expiresAt).getTime() >= Date.now()
      );
      await this.writeSessions(kept);
      return sessions.length - kept.length;
    });
  }

  async setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void> {
    await this.mutate(async () => {
      const users = await this.readUsers();
      const user = this.userById(users, id);
      user.passwordHash = passwordHash;
      user.mustChangePassword = mustChange;
      user.passwordChangedAt = new Date().toISOString();
      await this.writeUsers(users);
      if (mustChange) {
        const sessions = await this.readSessions();
        await this.writeSessions(sessions.filter((session) => session.userId !== id));
      }
    });
  }

  async listUsers(adminEmails: string[]): Promise<AdminUser[]> {
    const lockedEmails = new Set(adminEmails.map(normEmail));
    const order: Record<Role, number> = { admin: 0, editor: 1, viewer: 2 };
    return (await this.readUsers())
      .map((user) => this.toAdminUser(user, lockedEmails))
      .sort(
        (left, right) =>
          (left.disabled ? 3 : order[left.role]) - (right.disabled ? 3 : order[right.role]) ||
          left.name.localeCompare(right.name)
      );
  }

  async updateUser(
    id: number,
    patch: { role?: Role; disabled?: boolean }
  ): Promise<AdminUser | null> {
    return this.mutate(async () => {
      const users = await this.readUsers();
      const user = users.find((item) => item.id === id);
      if (!user) return null;
      if (patch.role !== undefined) user.role = patch.role;
      if (patch.disabled !== undefined) user.disabled = patch.disabled;
      await this.writeUsers(users);
      if (patch.disabled) {
        const sessions = await this.readSessions();
        await this.writeSessions(sessions.filter((session) => session.userId !== id));
      }
      return this.toAdminUser(user, new Set());
    });
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private get usersFile(): string {
    return path.join(this.dataDir, 'users.json');
  }

  private get sessionsFile(): string {
    return path.join(this.dataDir, 'sessions.json');
  }

  private async readUsers(): Promise<FileUser[]> {
    return this.readJson<FileUser[]>(this.usersFile, []);
  }

  private async readSessions(): Promise<FileSession[]> {
    return this.readJson<FileSession[]>(this.sessionsFile, []);
  }

  private async readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
      throw error;
    }
  }

  private writeUsers(users: FileUser[]): Promise<void> {
    return this.writeJson(this.usersFile, users);
  }

  private writeSessions(sessions: FileSession[]): Promise<void> {
    return this.writeJson(this.sessionsFile, sessions);
  }

  private async writeJson(file: string, value: unknown): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const temporary = `${file}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2));
    await rename(temporary, file);
  }

  private userById(users: FileUser[], id: number): FileUser {
    const user = users.find((item) => item.id === id);
    if (!user) throw new Error(`User ${id} not found`);
    return user;
  }

  private toAdminUser(user: FileUser, lockedEmails: Set<string>): AdminUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      disabled: user.disabled,
      locked: lockedEmails.has(user.email),
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    };
  }
}
