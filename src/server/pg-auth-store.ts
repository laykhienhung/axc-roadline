import type { Pool } from 'pg';
import type { AdminUser, Role } from '../shared/auth.js';
import { normEmail } from '../shared/auth.js';
import { hashToken, newToken, type AuthStore, type UserRow } from './auth-store.js';
import { StorageUnavailableError } from './storage.js';

interface DatabaseUser {
  // node-postgres returns bigint (int8) columns as strings.
  id: number | string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  must_change_password: boolean;
  disabled_at: Date | string | null;
  created_at: Date | string;
  last_sign_in_at: Date | string | null;
}

interface SessionUser extends DatabaseUser {
  last_seen_at: Date | string;
}

function unavailable(error: unknown): StorageUnavailableError {
  if (error instanceof StorageUnavailableError) return error;
  return new StorageUnavailableError(
    error instanceof Error ? error.message : 'PostgreSQL auth storage unavailable'
  );
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toUser(row: DatabaseUser): UserRow {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    mustChangePassword: row.must_change_password,
    disabled: row.disabled_at !== null,
    createdAt: asIso(row.created_at),
    lastSignInAt: row.last_sign_in_at === null ? null : asIso(row.last_sign_in_at),
  };
}

const USER_COLUMNS = `id, email, name, password_hash, role, must_change_password,
  disabled_at, created_at, last_sign_in_at`;

/** PostgreSQL AuthStore. All driver failures are exposed as StorageUnavailableError. */
export class PgAuthStore implements AuthStore {
  constructor(private readonly pool: Pool) {}

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
  }): Promise<UserRow | 'email_taken'> {
    try {
      const email = normEmail(input.email);
      const result = await this.pool.query<DatabaseUser>(
        `insert into users (email, name, password_hash, role)
         values ($1, $2, $3, $4)
         on conflict (email) do nothing
         returning ${USER_COLUMNS}`,
        [email, input.name, input.passwordHash, input.role]
      );
      return result.rows[0] ? toUser(result.rows[0]) : 'email_taken';
    } catch (error) {
      throw unavailable(error);
    }
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    try {
      const result = await this.pool.query<DatabaseUser>(
        `select ${USER_COLUMNS} from users where email = $1`,
        [normEmail(email)]
      );
      return result.rows[0] ? toUser(result.rows[0]) : null;
    } catch (error) {
      throw unavailable(error);
    }
  }

  async markSignedIn(id: number, forceAdmin: boolean): Promise<UserRow> {
    try {
      const result = await this.pool.query<DatabaseUser>(
        `update users set last_sign_in_at = now(), role = case when $2 then 'admin' else role end
         where id = $1 returning ${USER_COLUMNS}`,
        [id, forceAdmin]
      );
      const user = result.rows[0];
      if (!user) throw new Error(`User ${id} not found`);
      return toUser(user);
    } catch (error) {
      throw unavailable(error);
    }
  }

  async createSession(userId: number, userAgent: string | null, hours: number): Promise<string> {
    try {
      const token = newToken();
      await this.pool.query(
        `insert into sessions (token_hash, user_id, expires_at, user_agent)
         values ($1, $2, now() + ($3 * interval '1 hour'), $4)`,
        [hashToken(token), userId, hours, userAgent]
      );
      return token;
    } catch (error) {
      throw unavailable(error);
    }
  }

  async findSession(token: string): Promise<UserRow | null> {
    try {
      const result = await this.pool.query<SessionUser>(
        `select users.id, users.email, users.name, users.password_hash, users.role,
                users.must_change_password, users.disabled_at, users.created_at,
                users.last_sign_in_at, sessions.last_seen_at
         from sessions join users on users.id = sessions.user_id
         where sessions.token_hash = $1 and sessions.expires_at > now() and users.disabled_at is null`,
        [hashToken(token)]
      );
      const session = result.rows[0];
      if (!session) return null;
      if (Date.now() - new Date(session.last_seen_at).getTime() >= 5 * 60 * 1000) {
        await this.pool.query('update sessions set last_seen_at = now() where token_hash = $1', [
          hashToken(token),
        ]);
      }
      return toUser(session);
    } catch (error) {
      throw unavailable(error);
    }
  }

  async deleteSession(token: string): Promise<void> {
    try {
      await this.pool.query('delete from sessions where token_hash = $1', [hashToken(token)]);
    } catch (error) {
      throw unavailable(error);
    }
  }

  async deleteUserSessions(userId: number, exceptToken?: string): Promise<number> {
    try {
      const result = exceptToken
        ? await this.pool.query('delete from sessions where user_id = $1 and token_hash <> $2', [
            userId,
            hashToken(exceptToken),
          ])
        : await this.pool.query('delete from sessions where user_id = $1', [userId]);
      return result.rowCount ?? 0;
    } catch (error) {
      throw unavailable(error);
    }
  }

  async deleteExpiredSessions(): Promise<number> {
    try {
      const result = await this.pool.query('delete from sessions where expires_at < now()');
      return result.rowCount ?? 0;
    } catch (error) {
      throw unavailable(error);
    }
  }

  async setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void> {
    try {
      await this.pool.query(
        `update users set password_hash = $2, must_change_password = $3, password_changed_at = now()
         where id = $1`,
        [id, passwordHash, mustChange]
      );
      if (mustChange) await this.deleteUserSessions(id);
    } catch (error) {
      throw unavailable(error);
    }
  }

  async listUsers(adminEmails: string[]): Promise<AdminUser[]> {
    try {
      const result = await this.pool.query<DatabaseUser>(
        `select ${USER_COLUMNS} from users
         order by case when disabled_at is not null then 3
                       when role = 'admin' then 0 when role = 'editor' then 1 else 2 end, name`
      );
      const lockedEmails = new Set(adminEmails.map(normEmail));
      return result.rows.map((row) => this.toAdminUser(toUser(row), lockedEmails));
    } catch (error) {
      throw unavailable(error);
    }
  }

  async updateUser(
    id: number,
    patch: { role?: Role; disabled?: boolean }
  ): Promise<AdminUser | null> {
    try {
      const result = await this.pool.query<DatabaseUser>(
        `update users set
           role = coalesce($2, role),
           disabled_at = case when $3::boolean is true then now()
                              when $3::boolean is false then null else disabled_at end
         where id = $1 returning ${USER_COLUMNS}`,
        [id, patch.role ?? null, patch.disabled ?? null]
      );
      const row = result.rows[0];
      if (!row) return null;
      if (patch.disabled) await this.deleteUserSessions(id);
      return this.toAdminUser(toUser(row), new Set());
    } catch (error) {
      throw unavailable(error);
    }
  }

  private toAdminUser(user: UserRow, lockedEmails: Set<string>): AdminUser {
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
