# Design: roadline-auth

Tables are in `db.md` (`users`, `sessions`). Storage follows `roadline-db`: one interface with Postgres and JSON-file implementations, chosen by `DATABASE_URL`. Tests use files.

## Approach

**Local accounts with email and password.**
- Sign-up creates an active **viewer**, or an **admin** when the email is in `ADMIN_EMAILS`, and signs the user in immediately.
- Passwords are hashed with **scrypt** (`node:crypto`, random 16-byte salt, constant-time compare).

**Sessions.**
- Each sign-in creates a **server-side session**: a random 32-byte token goes in the `rl_session` cookie, and only `sha256(token)` is stored.
- Every request looks the session up joined to its user. That's why role changes, disables, resets and revokes act on the user's very next request.

**Must-change-password.**
- An admin reset sets the password to `1111` and the `mustChangePassword` flag.
- While the flag is set, the server allows only `/api/me`, `POST /api/me/password` and sign-out (403 `password_change_required` for the rest). The client sends every route to `/update-password`.

**Shared rules.** The pure rules (`safeNext`, `validateSignup`, `validatePassword`, role checks, initials) live in `src/shared/auth.ts` (`conventions.md` Layout: pure logic in shared), so client and server apply the same messages.

## Architecture

```
Browser ─GET /page (no session)─▶ pageGate ─302─▶ /signin?next=/page
/signup ─POST /auth/signup {name,email,password}─▶ validateSignup ─▶ AuthStore.createUser(role = admin if ADMIN_EMAILS else viewer)
                                                    ├ 409 email_taken
                                                    └ createSession ─▶ Set-Cookie rl_session ─▶ 200 Me
/signin ─POST /auth/signin {email,password}─▶ AuthStore.findUserByEmail ─▶ verifyPassword (scrypt, timingSafeEqual)
                                               ├ 401 invalid_credentials (unknown email or wrong password)
                                               ├ 403 account_disabled
                                               └ createSession ─▶ rl_session ─▶ 200 Me {mustChangePassword}
every request ─▶ loadSession: AuthStore.findSession(sha256(token)) → SessionUser (enabled, unexpired)
GET  /api/me ──────────────▶ 200 Me | 401 unauthenticated
POST /api/me/password ─────▶ (current unless forced) ─▶ setPassword ─▶ revoke other sessions ─▶ 200 Me
/api/* ─▶ apiGate(401) ─▶ mustChangeGate(403 password_change_required)
        ─▶ GET /api/plan · POST /api/plan (originCheck → requireRole editor → audit user_email | 403 forbidden + audit)
        ─▶ /api/admin/* (originCheck → requireRole admin) ─▶ AuthStore / Storage.listImports
POST /auth/signout ─▶ deleteSession ─▶ 302 /signin?signedout=1
sweep (startup + hourly) ─▶ deleteExpiredSessions
AuthStore = PgAuthStore(pool) when DATABASE_URL | FileAuthStore(dataDir: users.json, sessions.json)
```

## Data shapes

```ts
// src/shared/auth.ts
export type Role = 'viewer' | 'editor' | 'admin';
export interface Me { id: number; email: string; name: string; role: Role; mustChangePassword: boolean }
export interface AdminUser { id: number; email: string; name: string; role: Role; disabled: boolean;
  locked: boolean;               // email in ADMIN_EMAILS
  mustChangePassword: boolean; createdAt: string; lastSignInAt: string | null }
export interface ImportLogItem { id: number; at: string; userEmail: string | null; fileName: string | null;
  fileSize: number | null; outcome: ImportOutcome; planId: number | null; current: boolean; detail: string }
export type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'repeat' | 'current', string>>;
export const MIN_PASSWORD = 10;
export const RESET_PASSWORD = '1111';
export function validateSignup(i: { name; email; password; repeat }): FieldErrors;   // copy from ui.md
export function validateNewPassword(i: { password; repeat; current? }): FieldErrors; // ≥10, match, ≠ current
export const canImport = (r: Role) => r === 'editor' || r === 'admin';
export function safeNext(next: unknown): string;  // single leading "/", never /signin, /signup, /update-password, /auth/*
export function initials(name: string): string;

// src/server/password.ts
export function hashPassword(pw: string): Promise<string>;              // "scrypt$16384$8$1$<salt>$<hash>"
export function verifyPassword(pw: string, stored: string): Promise<boolean>;
export const DUMMY_HASH: string;   // verified against when the email is unknown (same timing)

// src/server/auth-store.ts
export interface UserRow extends Me { passwordHash: string; disabled: boolean; createdAt: string; lastSignInAt: string | null }
export interface AuthStore {
  createUser(u: { email; name; passwordHash; role: Role }): Promise<UserRow | 'email_taken'>;
  findUserByEmail(email: string): Promise<UserRow | null>;
  markSignedIn(id: number, forceAdmin: boolean): Promise<UserRow>;
  createSession(userId: number, userAgent: string | null, hours: number): Promise<string>;  // raw token
  findSession(token: string): Promise<UserRow | null>;   // valid + enabled; touches last_seen ≤ 1/5 min
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: number, exceptToken?: string): Promise<number>;
  deleteExpiredSessions(): Promise<number>;
  setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void>;
  listUsers(adminEmails: string[]): Promise<AdminUser[]>;
  updateUser(id: number, patch: { role?: Role; disabled?: boolean }): Promise<AdminUser | null>; // disable → delete sessions
}
// roadline-db Storage gains: listImports({ before?, limit }): Promise<{ items: ImportLogItem[]; nextBefore: number | null }>

// src/server/auth-config.ts
export interface AuthConfig { adminEmails: string[]; publicUrl: string; sessionHours: number; secureCookies: boolean }
```

### API
Errors are `{ error: '<snake_case>', fields?: FieldErrors }` (`conventions.md` API).

| Method | Path | Who | Body → Result |
|---|---|---|---|
| POST | `/auth/signup` | anyone | `{name,email,password,repeat}` → `200 Me` + cookie · `400 invalid_input {fields}` · `409 email_taken` |
| POST | `/auth/signin` | anyone | `{email,password}` → `200 Me` + cookie · `401 invalid_credentials` · `403 account_disabled` |
| POST | `/auth/signout` | anyone | → `302 /signin?signedout=1` (form post) |
| GET | `/api/me` | signed in | `200 Me` · `401 unauthenticated` |
| POST | `/api/me/password` | signed in | `{current?, password, repeat}` → `200 Me` · `400 invalid_input {fields}` (wrong current → `fields.current`) |
| GET/POST | `/api/plan` | viewer / editor+ | as today · 401 · 403 `forbidden` · 403 `password_change_required` |
| GET | `/api/admin/users` | admin | `200 AdminUser[]` |
| PATCH | `/api/admin/users/:id` | admin | `{role}` or `{disabled}` → `200 AdminUser` · 400 `invalid_body` · 404 · 409 `locked` · 409 `self` |
| POST | `/api/admin/users/:id/reset-password` | admin | → `200 AdminUser` (`mustChangePassword: true`) · 404 · 409 `locked` · 409 `self` |
| POST | `/api/admin/users/:id/signout-all` | admin | → `200 { revoked }` · 404 · 409 `self` |
| GET | `/api/admin/imports?before&limit` | admin | `200 { items, nextBefore }` (limit ≤ 50) |

Any non-GET with a foreign `Origin` → `403 bad_origin`.

**Cookie** `rl_session`: raw token (base64url, 32 bytes). Attributes `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age = sessionHours·3600`, and `Secure` when `PUBLIC_URL` is https.

## Decisions

- **Local accounts, open sign-up, active as viewer** (user). Approval, domain restriction and throttling are all out (user). The accepted risk is in `proposal.md` Notes.
- **scrypt** from `node:crypto` (N=16384, r=8, p=1, keylen 64, 16-byte random salt), with the parameters stored in the hash string. That means no native dependency (bcrypt/argon2 would need a build step) and the cost can be raised later.
- **Same response for an unknown email and a wrong password** (`401 invalid_credentials`). An unknown email is still checked against `DUMMY_HASH`, so the timing matches. Sign-up's `409 email_taken` does reveal that an account exists; that's accepted, because open sign-up already implies it.
- **Server-side sessions** with token hashes only, so revoke, disable, reset and "sign out everywhere" take effect immediately.
- **Reset = `1111` + `mustChangePassword`** (user). It doesn't expire. The server blocks every API call except `/api/me`, `POST /api/me/password` and sign-out while the flag is set, so the reset password can't read the plan.
- **Forced update doesn't ask for the current password** (the user just signed in with it). A voluntary change does.
- **A password update** clears the flag, sets `password_changed_at`, and revokes all of the user's **other** sessions.
- **`ADMIN_EMAILS` break-glass**: those users are admin at sign-up and at each sign-in, and `locked` in the API and UI (no role change, disable or reset). An admin can't act on **their own** row (409 `self`), and uses Change password for themselves.
- **No new runtime dependency.** `SESSION_SECRET` is not needed (there are no signed cookies any more).
- **CSRF**: `SameSite=Lax` plus `originCheck` on every non-GET (`/auth/*`, `/api/*`).
- **FileAuthStore** (tmp+rename writes, promise queue, pattern `src/server/plan-store.ts:28`) keeps `npm test` DB-free.
- **Static assets are public** (auth pages need the bundle). In dev, Vite-served pages are guarded by the client gate.

### Rejected
- **Google / OIDC** (the earlier capture): the user doesn't want Google Workspace.
- **Approval of new accounts**: the user wants immediate access.
- **Expiring the reset password**: the user chose the forced update screen as the guard.
- **Sign-in throttle**: the user chose to skip it.
- **bcrypt / argon2**: native builds. scrypt is built in.
- **JWT / stateless sessions**: can't revoke.

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|-----------|------------------|---------------------------------|
| Required env | none required. `ADMIN_EMAILS` empty → warning "no ADMIN_EMAILS — nobody can manage users" | — |
| `PUBLIC_URL` unset | dev: `devClientUrl`; else `http://localhost:${PORT}` (used for the Origin check and `Secure`) | — |
| Email normalization | `trim().toLowerCase()`; valid = one `@`, something on both sides, a dot in the domain part | — |
| Name | trimmed, 1–100 chars | — |
| Password limits | min 10, max 200 chars (avoid huge scrypt input); no other complexity rules | — |
| `1111` and the min-10 rule | only the reset path may set it; sign-up and update always enforce ≥ 10 | — |
| Sign-up with an `ADMIN_EMAILS` email | role `admin`; welcome toast says Admin | — |
| `ADMIN_EMAILS` user whose row says viewer | forced to `admin` at sign-in (`markSignedIn(id, true)`) | — |
| Disabled user signs in with the right password | 403 `account_disabled` (after the password check, so the message isn't an oracle for wrong passwords) | — |
| `mustChangePassword` and API calls | allowed: `/api/me`, `POST /api/me/password`, `/auth/signout`; other `/api/*` → 403 `password_change_required` | — |
| After a password update | revoke the user's other sessions; keep the current one | — |
| `next` | `safeNext()`; never back to auth pages | — |
| Signed-in user opens `/signin` or `/signup` | client redirects to `safeNext(?next)` | — |
| Session expires or is revoked mid-use | 401 → client `window.location.assign('/signin?expired=1&next=<current>')` | — |
| Session store down | `/api/*` → 503 `db_unavailable`; pages → 503 text "Roadline can't reach its database" | — |
| `last_seen_at` writes | ≤ once per 5 min per session | — |
| Expired-session sweep | at startup and hourly (`setInterval(...).unref()`) | — |
| Viewer `POST /api/plan` | 403 `forbidden` + audit `forbidden` with email; client "Only editors can import the plan." | — |
| Admin acts on a locked or own row | 409 `locked` / `self`; UI never offers it | — |
| Import log `detail` | ok → `plan #<id>`; needs_mapping → `<n> new words`; others → first problem, 80 chars + "…" | — |
| Users order | admins, editors, viewers, disabled; then name | — |
| Toasts | auto-hide after 5 s | — |
| Vite dev proxy | add the key `'/auth/'` (with slash) next to `'/api/'`; leave the uncommitted `allowedHosts` edit | — |
| Existing tests | `createApp` gets `auth` from `tests/helpers.ts:testAuth(dir)` (FileAuthStore, `adminEmails ['admin@example.com']`) and `signIn(app, role)` → cookie; `mockFetch` answers `/api/me` with an editor by default | — |
| Logging | never log passwords, hashes or tokens; log sign-in failures as `signin failed <email>` only | — |
| Commit message | `roadline-auth: <summary>` | — |

### Blast Radius
- `migrations/1759400000000_auth.sql` (new: `users`, `sessions`): safe/reversible (additive; applied by a person)
- `src/shared/auth.ts` (new): safe/reversible
- `src/server/password.ts`, `auth-config.ts`, `cookies.ts`, `auth-store.ts`, `file-auth-store.ts`, `pg-auth-store.ts`, `auth.ts`, `admin.ts` (new): **risky**. This is the security boundary; review hashing, the constant-time compare, token hashing, role checks and the must-change gate
- `src/server/app.ts` (wiring order): **risky**. Wrong order would leave `/api/plan` or `/api/admin` open
- `src/server/storage.ts`, `file-storage.ts`, `pg-storage.ts` (`listImports`, `userEmail`): safe/reversible
- `src/server/index.ts`, `vite.config.ts`: safe/reversible
- Client: `api.ts`, `app.tsx`, `use-session.ts`, `pages/signin-page.tsx`, `signup-page.tsx`, `update-password-page.tsx`, `admin-page.tsx`, `components/auth-card.tsx`, `field.tsx`, `user-menu.tsx`, `users-table.tsx`, `import-log.tsx`, `confirm-dialog.tsx`, `app-header.tsx`, `pages/timeline-page.tsx`, `target-page.tsx`, `import-states.tsx`, `styles.css`: safe/reversible
- Tests (adjusted + new), README, `devspec/context/*`: safe/reversible
- Applying the migration to `postgres.roadline`: **external side effect**, so a MANUAL gate
- Open sign-up, no throttle, reset `1111`: **accepted risk** (user decision; see proposal Notes)

## Open questions
None blocking. Later: sign-in throttle, a dedicated DB role, email-based reset.
