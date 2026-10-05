# Tasks: roadline-auth

General notes:
- There's no component library. Reuse `Brand` (`src/client/components/app-header.tsx`), `ImportButton`, `EmptyState`, `.badge` + `.tone-*` and the classes in `src/client/styles.css`. Layouts and states come from `ui.md` and `mockups/*.html`.
- Server and shared imports use `.js` extensions; client imports don't.
- **`npm test` never touches a database**: tests use `FileAuthStore` / `FileStorage` in temp dirs.
- This change builds on `roadline-db` (`Storage`, `db.ts`, `migrations/`). There are no new runtime dependencies.

## 1. Shared auth rules [req-2, req-7, req-8]
- [x] 1.1 [service] New `src/shared/auth.ts` with the following (shapes and copy in design.md / ui.md):
  - Types: `Role`, `Me`, `AdminUser`, `ImportLogItem`, `FieldErrors`.
  - Constants: `MIN_PASSWORD`, `RESET_PASSWORD`.
  - Functions: `normEmail`, `validateSignup`, `validateNewPassword`, `canImport`, `safeNext`, `initials`.
- [x] 1.2 [test] New `tests/auth-rules.test.ts`:
  - `validateSignup`: each message (empty name, bad email, < 10, mismatch); a valid case returns `{}`.
  - `validateNewPassword`: same-as-current rejected.
  - `normEmail(' A@B.com ')` → `a@b.com`.
  - `safeNext` → `/` for `https://evil.example`, `//evil.example`, `/\evil`, `/signin`, `/signup`, `/update-password`, `/auth/signout`; keeps `/target/T1?today=2026-09-28`.
  - `canImport` per role.
Verify: `npx vitest run tests/auth-rules.test.ts`

## 2. Password hashing and config [req-1, req-14]
- [x] 2.1 [backend] New `src/server/password.ts`:
  - `hashPassword` / `verifyPassword`: `scrypt` from `node:crypto` (promisified; N 16384, r 8, p 1, keylen 64; 16-byte salt; format `scrypt$N$r$p$<salt>$<hash>`; `timingSafeEqual`).
  - `DUMMY_HASH`, built once at load.
- [x] 2.2 [backend] New `src/server/auth-config.ts:readAuthConfig(env, { port, devClientUrl })` → `{ adminEmails, publicUrl, sessionHours, secureCookies }`. Lists are lower-cased and trimmed; `SESSION_HOURS` defaults to 12.
- [x] 2.3 [backend] New `src/server/cookies.ts`: `readCookies(req)`, `setSessionCookie(res, token, cfg)`, `clearSessionCookie(res, cfg)` (attributes in design.md).
- [x] 2.4 [test] New `tests/password.test.ts`:
  - The hash starts with `scrypt$` and two hashes of the same password differ.
  - Verify true for the right password, false for a wrong one.
  - A malformed stored string → false, not a throw.
- [x] 2.5 [test] New `tests/auth-config.test.ts`: defaults; normalization; empty `ADMIN_EMAILS` is allowed; `secureCookies` only for https.
Verify: `npx vitest run tests/password.test.ts tests/auth-config.test.ts`

## 3. Auth store and migration [req-4, req-14]
- [x] 3.1 [db] Write migration `migrations/1759400000000_auth.sql` (`-- Up Migration` only) creating `users` and `sessions` exactly as in `db.md`:
  - `users`: identity PK, `users_email_key`, `check (email = lower(email))`, name length check, role check, `must_change_password boolean not null default false`.
  - `sessions`: `token_hash bytea` PK, FK `user_id → users.id on delete cascade`, indexes `sessions_user_id_idx` and `sessions_expires_at_idx`.
  - No `DROP` / `ALTER`.
- [x] 3.2 [backend] New `src/server/auth-store.ts`: `AuthStore` and `UserRow` interfaces, `hashToken` (sha256), `newToken` (`randomBytes(32)` base64url).
- [x] 3.3 [backend] New `src/server/file-auth-store.ts:FileAuthStore(dataDir)`:
  - Storage: `users.json` + `sessions.json` (token hashes hex), tmp+rename writes, promise queue (pattern `src/server/plan-store.ts:28`).
  - Implements the full `AuthStore` contract: `createUser` returns `'email_taken'` on a duplicate; `findSession` skips expired/disabled and touches `last_seen` at most every 5 min; disable and `setPassword(..., mustChange=true)` delete the user's sessions; `deleteUserSessions(id, exceptToken)`.
- [x] 3.4 [backend] New `src/server/pg-auth-store.ts:PgAuthStore(pool)`, the same contract in SQL:
  - `createUser`: `insert … on conflict (email) do nothing returning *` → `'email_taken'` when no row comes back.
  - `findSession`: `sessions join users where token_hash = $1 and expires_at > now() and disabled_at is null`.
  - Disable = `update users set disabled_at = now()` + `delete from sessions where user_id = $1`.
  - Connection errors → `StorageUnavailableError` (roadline-db).
- [x] 3.5 [test] New `tests/auth-store.test.ts` on `FileAuthStore` (temp dir):
  - Create + duplicate → `email_taken`.
  - Session round trip; only the hash is on disk (the raw token is not in `sessions.json`, the password is not in `users.json`).
  - Expired session → null; disabled → null and its sessions are gone; re-enable keeps the role.
  - `setPassword` with `mustChange` revokes sessions; `deleteUserSessions(id, except)` keeps one.
  - `deleteExpiredSessions` returns the count.
- [x] 3.6 [test] `tests/migration.test.ts` (from roadline-db): add checks that the auth file has both tables, the FK cascade, the role check, and no `drop` / `truncate`.
Verify: `npx vitest run tests/auth-store.test.ts tests/migration.test.ts`

## 4. Auth routes [req-2, req-3, req-4, req-5, req-7]
- [x] 4.1 [backend] New `src/server/auth.ts:authRoutes(app, { cfg, store })` with these routes (JSON bodies, `express.json({ limit: '10kb' })`):
  - `POST /auth/signup`: `validateSignup` → 400 `invalid_input {fields}`; `hashPassword`; role `admin` if the email is in `adminEmails`, else `viewer`; `createUser` → 409 `email_taken`; then `createSession`, set the cookie, `200 Me`.
  - `POST /auth/signin`:
    - Unknown email → `verifyPassword(pw, DUMMY_HASH)`, then 401 `invalid_credentials`.
    - Wrong password → 401.
    - Disabled → 403 `account_disabled`.
    - Success → `markSignedIn(id, forceAdmin)`, then `createSession`, cookie, `200 Me`.
  - `POST /auth/signout`: delete the session, clear the cookie, 302 `/signin?signedout=1`.
  - `GET /api/me` → `Me` or 401.
  - `POST /api/me/password`:
    - Requires `current` unless `mustChangePassword`.
    - Runs `validateNewPassword`; a wrong current password → 400 with `fields.current`.
    - On success: `setPassword(id, hash, false)` + `deleteUserSessions(id, currentToken)` → `200 Me`.
  - Any other `/auth/*` → 404.
- [x] 4.2 [backend] Same file, the middleware: `loadSession` (sets `req.user`, `req.token`), `apiGate` (401), `mustChangeGate` (403 `password_change_required` except `/api/me`, `/api/me/password`), `pageGate`, `requireRole(min)`, `originCheck`. Also the sweep (`deleteExpiredSessions` at startup + hourly, `unref`).
- [x] 4.3 [test] New `tests/auth-routes.test.ts` (supertest, `FileAuthStore`):
  - Sign-up success (normalized email, viewer, cookie, `/api/me`); `ADMIN_EMAILS` → admin; invalid → 400 fields; duplicate (other case) → 409.
  - Sign-in success; unknown email and wrong password both → 401 `invalid_credentials`; disabled → 403; `ADMIN_EMAILS` viewer → admin.
  - Sign-out → old cookie 401.
  - Password change: wrong current → 400 `fields.current`; success → another session's cookie is 401, this one still works.
  - Forced change: `/api/plan` → 403 `password_change_required`; update without `current` → flag cleared, `/api/plan` works.
  - Cookie attributes.
Verify: `npx vitest run tests/auth-routes.test.ts`

## 5. Gate, role checks and admin API [req-6, req-8, req-9]
- [x] 5.1 [backend] `src/server/app.ts`: `AppOptions.auth: { cfg, store: AuthStore }`.
  - Order: `authRoutes` (+ `/api/me`) → `apiGate` → `mustChangeGate` → `GET /api/plan` → `POST /api/plan` → `adminRoutes` → `/api` 404 → `express.static` → `pageGate` (serves `/signin`, `/signup`, `/update-password`) → SPA fallback.
  - `POST /api/plan` runs `originCheck` + `requireRole('editor')`; a refusal logs `logImport({ outcome: 'forbidden', userEmail })`.
  - Pass `req.user.email` into `commitImport` / `logImport`.
  - `StorageUnavailableError` → 503 (`db_unavailable` JSON for `/api`, text for pages).
- [x] 5.2 [backend] New `src/server/admin.ts:adminRoutes(app, { store, storage, cfg })`, all under `requireRole('admin')` + `originCheck`:
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id` (`{role}` | `{disabled}`; 400 `invalid_body`, 404, 409 `locked` / `self`)
  - `POST /api/admin/users/:id/reset-password` (`setPassword(id, hash('1111'), true)`; 409 `locked` / `self`)
  - `POST /api/admin/users/:id/signout-all` (409 `self`)
  - `GET /api/admin/imports?before&limit` (limit ≤ 50)
- [x] 5.3 [backend] Extend roadline-db storage with `listImports({ before, limit })` on `Storage` (`src/server/storage.ts`):
  - `FileStorage`: `imports.jsonl` newest first, ids = line numbers.
  - `PgStorage`: `where ($1::bigint is null or id < $1) order by id desc limit $2`; `current` = `plan_id = (select max(id) from plans)`.
  - `detail` per the design.md Decision Defaults.
- [x] 5.4 [backend] `src/server/index.ts`:
  - `readAuthConfig`.
  - `store = DATABASE_URL ? new PgAuthStore(pool) : new FileAuthStore(dataDir)`.
  - Warn when `ADMIN_EMAILS` is empty.
  - `vite.config.ts`: add the proxy key `'/auth/'` next to `'/api/'` (leave `allowedHosts`).
- [x] 5.5 [test] `tests/helpers.ts`: `testAuth(dir, overrides?)` (FileAuthStore, `adminEmails ['admin@example.com']`) and `signIn(app, email, role)` → cookie (signs up, then sets the role through the store). Update `tests/api.test.ts` to use an editor cookie; cases are otherwise unchanged.
- [x] 5.6 [test] New `tests/auth-gate.test.ts`:
  - No cookie → 401 on `/api/plan` (GET/POST), `/api/me`, `/api/admin/users`; the plan is untouched.
  - Viewer POST → 403 `forbidden` + audit `forbidden` with email.
  - Editor POST → 200 + audit `ok` with email.
  - Foreign `Origin` → 403 `bad_origin`.
  - Page without cookie → 302 with encoded `next`; `/signin`, `/signup` and `/assets/x.js` → 200.
- [x] 5.7 [test] New `tests/admin-api.test.ts`:
  - Editor → 403 on every admin route.
  - List users.
  - Role patch applies on the next request.
  - Disable → cookie 401 + sign-in 403; enable restores.
  - Reset → sessions gone, sign-in with `1111` works, `mustChangePassword: true`.
  - Locked → 409 `locked`; self → 409 `self`; bad body → 400; unknown id → 404.
  - signout-all → `{revoked}`.
  - Imports paging with `before`.
Verify: `npx vitest run tests/api.test.ts tests/auth-gate.test.ts tests/admin-api.test.ts`

## 6. Client session, gate and auth pages [req-6, req-10, req-11]
- [x] 6.1 [frontend] `src/client/api.ts`:
  - New calls: `fetchMe`, `signUp`, `signIn`, `changePassword`, plus the admin calls `fetchUsers`, `patchUser`, `resetPassword`, `signOutAll`, `fetchImports(before?)`.
  - A 401 on any data call → `window.location.assign('/signin?expired=1&next=…')`.
  - 403 `password_change_required` → `/update-password?next=…`.
  - `uploadPlan` maps 403 `forbidden` → "Only editors can import the plan."
- [x] 6.2 [frontend] New `src/client/use-session.ts:useSession()` → `loading | signedOut | signedIn(me)`, with `refresh()` and `setMe(me)`.
- [x] 6.3 [frontend] `src/client/app.tsx:App`:
  - Owns `useSession()`.
  - Public routes `/signin`, `/signup` (redirect to `safeNext(?next)` when signed in).
  - `/update-password` for signed-in users.
  - Every other route inside `SignedIn({ me })`, which calls `usePlan()` and passes `me` down. That includes `/admin` and `/admin/imports` → `AdminPage`.
  - Gate: loading → `<p className="muted">Loading…</p>`; signed out → `<Navigate to="/signin?next=…" replace />`; `me.mustChangePassword` → `<Navigate to="/update-password?next=…" replace />`.
- [x] 6.4 [frontend] New `src/client/components/auth-card.tsx:AuthCard({ title, intro, notice?, foot, children })` (reuses `Brand`, `.card`) and `src/client/components/field.tsx:Field({ label, type, autoComplete, hint?, error?, ... })` (`.field`, `.field.bad`, `.hint`, `.err`).
- [x] 6.5 [frontend] New `src/client/pages/signin-page.tsx:SignInPage`, per `mockups/signin.html` states 1–6:
  - Submitting disables the form.
  - `invalid_credentials` clears the password field.
  - "Create an account →" keeps `?next`.
- [x] 6.6 [frontend] New `src/client/pages/signup-page.tsx:SignUpPage`, per `mockups/signup.html`:
  - Client `validateSignup` runs before the request.
  - Server `fields` map onto the fields; `email_taken` shows the notice.
  - On success: `setMe` → navigate to `safeNext(?next)` with the welcome toast (state passed through the router).
- [x] 6.7 [frontend] New `src/client/pages/update-password-page.tsx:UpdatePasswordPage({ me })`, per `mockups/update-password.html`:
  - Forced mode (no header, no current field, "Not you? Sign out") vs voluntary (inside `AppHeader`-style bar with crumbs, Current field, Cancel).
  - Success toast, then navigate.
- [x] 6.8 [frontend] `src/client/styles.css`: `.auth`, `.auth-card`, `.field`, `.hint`, `.err`, `.notice`, `.foot`, `.spin`, `.toast` from the mockups (existing tokens only).
- [x] 6.9 [test] `tests/render.tsx:mockFetch(plan, posts, { me, routes? })`: answers `/api/me` (default editor `Me`; `me: null` → 401) and any extra route responses.
- [x] 6.10 [test] New `tests/auth-pages.test.tsx`:
  - Signed out on `/target/T1` → sign-in page, and `/api/plan` is never fetched.
  - Sign-in success → target page; `invalid_credentials` alert and password cleared; `account_disabled`; `?signedout=1`; `?expired=1`.
  - Sign-up client errors (no request sent); `email_taken`; success → timeline + welcome.
  - `mustChangePassword` → any route shows "Set a new password" with no current field; save → original route.
  - Voluntary change: wrong current → field error.
  - Signed in on `/signin?next=/target/T2` → target page.
Verify: `npx vitest run tests/auth-pages.test.tsx`

## 7. User menu and role-aware import [req-12]
- [x] 7.1 [frontend] New `src/client/components/user-menu.tsx:UserMenu({ me })`:
  - Chip: `aria-label="Account: <name> (<Role>)"`, `aria-haspopup`, `aria-expanded`; `.avatar` initials; `.name`; role `.badge` (Admin `tone-done`, Editor `tone-on_track`, Viewer `tone-not_started`).
  - `.card.menu` with `role="menu"`: name, email, role line (`ui.md`); admin → `Link` "Admin · users & import log"; everyone → `Link` "Change password" to `/update-password`; `<form method="post" action="/auth/signout">` "Sign out".
  - Closes on Escape, outside click and route change.
- [x] 7.2 [frontend] `AppHeader` (`src/client/components/app-header.tsx`) takes `me` and renders `UserMenu` after `actions`. Do the same in the target page header (`src/client/pages/target-page.tsx`). Add the `.plan-meta` ellipsis and the < 900px rule.
- [x] 7.3 [frontend] `src/client/pages/timeline-page.tsx:TimelinePage({ me })`:
  - `canImport(me.role)` → `ImportButton`; otherwise `.readonly` "Read-only", with no button, input or drop zone.
  - Empty plan: editor/admin → `EmptyState`; viewer → new `ViewerEmptyState` (`src/client/components/import-states.tsx`, `.drop.static`).
- [x] 7.4 [frontend] `src/client/styles.css`: `.user`, `.user-chip`, `.avatar`, `.caret`, `.menu`, `.readonly`, `.drop.static` from `mockups/header-roles.html`.
- [x] 7.5 [test] New `tests/header-roles.test.tsx`:
  - Editor `/` → Import + "(Editor)".
  - Admin → Admin badge + menu link `/admin`.
  - Viewer `/` and `/target/T1` → no Import, no `import-input`, "Read-only", Viewer badge.
  - Menu → email, "Change password" link, signout form `post /auth/signout`; Escape closes it.
  - Viewer + 404 → "Ask an editor to import the workbook"; editor + 404 → existing empty state.
  - Upload 403 → "Only editors can import the plan."
  - The existing `timeline-page` / `target-page` / `import` tests still pass with the default editor.
Verify: `npx vitest run tests/header-roles.test.tsx tests/timeline-page.test.tsx tests/target-page.test.tsx tests/import.test.tsx`

## 8. Admin page [req-13]
- [x] 8.1 [frontend] New `src/client/pages/admin-page.tsx:AdminPage({ me })`:
  - Header bar with `.crumbs` "Timeline / Admin" + `UserMenu`.
  - `h2` "Admin" + intro.
  - `.tabs` Users (count) / Import log, chosen by the route (`/admin`, `/admin/imports`).
  - Non-admin → "Admins only" card + "Back to timeline", with no admin fetch.
- [x] 8.2 [frontend] New `src/client/components/users-table.tsx:UsersTable`:
  - `.card` with `aria-label="Users"`; toolbar (`.search`, `.seg` role filter with counts, hint).
  - `table.users` rows per `ui.md`: order, locked 🔒 and "You" rows, "Must update password" badge, disabled rows dimmed + Enable.
  - `select.role-sel` → `patchUser` at once (disabled while saving, revert on error).
  - Reset / Sign out everywhere / Disable go through `ConfirmDialog`.
  - `.toast` status/alert, auto-hide after 5 s.
- [x] 8.3 [frontend] New `src/client/components/confirm-dialog.tsx:ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel })`: `.card.dialog`, `role="dialog"`, Escape cancels.
- [x] 8.4 [frontend] New `src/client/components/import-log.tsx:ImportLog`:
  - `.card` with `aria-label="Import log"`; table When · Who · File · Outcome · Details.
  - Outcome badge map from `ui.md`.
  - Newer/Older paging via `before`.
  - Empty "No imports yet"; loading skeleton.
- [x] 8.5 [frontend] `src/client/styles.css`: `.btn.sm`, `.tabs`, `.toolbar`, `.search`, `table.users`, `.role-sel`, `.lock`, `.dialog-back`, `.dialog`, `.skeleton` from `mockups/admin.html`.
- [x] 8.6 [test] New `tests/admin-page.test.tsx`:
  - Admin `/admin` → Users rows; the locked row has no select; own row shows "You"; the "Must update password" badge.
  - Filter "Editors" narrows the list.
  - Role change → `PATCH {role:'editor'}` + toast; error → revert + alert.
  - Disable confirm → `PATCH {disabled:true}`; Cancel → no call.
  - Reset confirm → `POST …/reset-password` + toast "1111".
  - `/admin/imports` → outcome labels; Older sends `before`; empty → "No imports yet".
  - Viewer `/admin` → "Admins only", with no `/api/admin` fetch.
Verify: `npx vitest run tests/admin-page.test.tsx`

## 9. Docs and context pack [req-14]
- [x] 9.1 [backend] `README.md` "Accounts & roles" section:
  - Sign-up and sign-in, the three roles, `ADMIN_EMAILS` (first admin, locked).
  - Admin page; reset → `1111` + forced update.
  - The accepted risks (open sign-up, no throttle).
  - Env table: `ADMIN_EMAILS`, `PUBLIC_URL`, `SESSION_HOURS`.
  - `npm run db:migrate` applies the auth migration.
  - API table: `/auth/*`, `/api/me`, `/api/me/password`, `/api/admin/*` with 401/403/409.
  - Update the intro ("no login" → accounts) and `.env.example`.
- [x] 9.2 [backend] `devspec/context/rules.md`: replace "no auth by design" with these rules:
  - All routes signed in except auth pages.
  - Roles in `users`; `ADMIN_EMAILS` break-glass.
  - Passwords scrypt-hashed, tokens stored only as hashes.
  - Never log passwords or tokens.
  - The must-change gate.
  - The `'/auth/'` proxy gotcha.

  `summary.md` **Does**: accounts + roles + admin page.
- [x] 9.3 [test] Full check.
Verify: `npm run lint && npm test && npm run build`

## 10. Browser verify [req-10, req-11, req-12, req-13]
- [x] 10.1 [test] Run `ADMIN_EMAILS=admin@example.com npm run dev` (files storage, no DB), then walk through:
  1. Signed-out `/` → sign-in page.
  2. Sign up `admin@example.com` → admin header; import the fixture.
  3. Sign up `viewer@example.com` in a second browser context → viewer header with no Import.
  4. Admin promotes the viewer to Editor → after a reload the viewer sees Import.
  5. Admin resets the viewer → the viewer is signed out; sign in with `1111` → forced update screen → set a new password → timeline.
  6. Admin disables the viewer → sign-in shows "Your access is turned off".
  7. `/admin/imports` lists the attempts.

  Save screenshots to `verify/`.
Verify: `/devspec-verify roadline-auth`

## 11. Real database and visual sign-off [req-4, req-9, req-14]
- [x] 11.1 MANUAL (run by Claude on the user's instruction, 2026-10-01: migration 1759400000000_auth applied — users + sessions created, 2nd run "No migrations to run!"; on Postgres the gate, sign-up as ADMIN_EMAILS admin, import with user_email in roadline.imports, password change, sign-out all passed; password_hash starts with scrypt$16384$8$1$; plans stays at 10): the user runs `npm run db:migrate` on `postgres.roadline` (the `users` and `sessions` tables appear; a second run reports nothing) and repeats the 10.1 flow with `DATABASE_URL` set. `roadline.imports.user_email` is filled, and `roadline.users.password_hash` starts with `scrypt$`.
- [x] 11.2 MANUAL (BA approved in chat 2026-10-01): BA approves the screenshots in `verify/` (sign-in, sign-up, update password, headers by role, admin users + import log).
Verify: MANUAL: user confirms 11.1; BA approves 11.2
