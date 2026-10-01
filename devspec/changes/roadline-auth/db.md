# DB: roadline-auth

**Source**: live, read with `psql` in a read-only session on 2026-10-01.
- Database `postgres`, schema `roadline`. It is **empty today**: `roadline-db` (pending) creates `plans`, `value_mappings`, `template_versions` and `imports`.
- PostgreSQL 17.5. Extensions: only `plpgsql` is installed (`citext` and `pgcrypto` are available but not installed, and neither is needed).
- See `devspec/changes/roadline-db/db.md` for server facts and conventions.

**Depends on**: `roadline-db` (pool, migrations dir, `Storage`, `imports` table).

## Tables touched

### users (new)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | bigint | no | identity | PK |
| email | text | no | — | unique `users_email_key`; `check (email = lower(email))` |
| name | text | no | — | from sign-up; `check (length(name) between 1 and 100)` |
| password_hash | text | no | — | `scrypt$N$r$p$<salt b64>$<hash b64>` (`node:crypto` scrypt, 16-byte salt, 64-byte key) |
| role | text | no | `'viewer'` | `check (role in ('viewer','editor','admin'))` |
| must_change_password | boolean | no | `false` | set by an admin reset (password `1111`), cleared by an update |
| disabled_at | timestamptz | yes | — | non-null means disabled: sign-in is refused and sessions are revoked |
| created_at | timestamptz | no | `now()` | sign-up time ("Signed up" column) |
| last_sign_in_at | timestamptz | yes | — | |
| password_changed_at | timestamptz | yes | — | |

- **Sign-up** inserts a row with `role = 'viewer'`, or `'admin'` when the email is in `ADMIN_EMAILS`.
- An `ADMIN_EMAILS` user is also forced to `admin` at each sign-in, so they stay admin even if the row was edited by hand.

### sessions (new): server-side, revocable
| col | type | null | default | note |
|-----|------|------|---------|------|
| token_hash | bytea | no | — | PK; `sha256(token)`. The raw token only ever lives in the cookie |
| user_id | bigint | no | — | FK → `users.id` `on delete cascade`; index `sessions_user_id_idx` |
| created_at | timestamptz | no | `now()` | |
| expires_at | timestamptz | no | — | `created_at + SESSION_HOURS` (default 12); index `sessions_expires_at_idx` |
| last_seen_at | timestamptz | no | `now()` | updated at most once per 5 minutes |
| user_agent | text | yes | — | |

- Expired rows are removed by a sweep (`delete … where expires_at < now()`) at startup and then hourly. That's routine runtime cleanup of session data, not a migration.
- **Revoking sessions**: these also remove `sessions` rows (routine cleanup). Disable, reset password and "sign out everywhere" remove all of the user's sessions. A password update removes all of the user's sessions except the current one.

### imports (exists after roadline-db): no schema change
- `user_email` is filled from the session.
- `outcome = 'forbidden'` is written when a viewer tries to import.

## Impact
- `plans.imported_by`, `value_mappings.updated_by` and `imports.user_email` come from the signed-in user (roadline-db leaves them null).
- `FileAuthStore` mirrors both tables in `DATA_DIR/users.json` and `sessions.json` when `DATABASE_URL` is unset (tests and local runs). `npm test` never touches a DB.

**Migration verdict**: additive. Two new tables, nothing in `roadline-db`'s tables changes, no backfill. Forward-only `migrations/1759400000000_auth.sql` (`-- Up Migration` only), applied by a person with `npm run db:migrate`.

## Decisions (user, 2026-10-01)
- **Local accounts**: no Google. Open sign-up for any email domain, active immediately as viewer.
- Users are **disabled, never deleted**.
- **Admin reset** sets the password hash to `scrypt('1111')` with `must_change_password = true`. It doesn't expire; the forced update screen is the guard.
- **No sign-in throttle.**
