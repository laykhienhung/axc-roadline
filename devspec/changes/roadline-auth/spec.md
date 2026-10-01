# Spec: roadline-auth

### Requirement: password hashing [req-1]
The server SHALL store passwords only as salted scrypt hashes and SHALL verify them in constant time.

#### Scenario: hash and verify
- **WHEN** `hashPassword('correct horse 1')` is stored and later checked
- **THEN** the stored string starts with `scrypt$`, differs between two hashes of the same password (random salt), `verifyPassword` returns true for the same password and false for any other

#### Scenario: never stored in clear
- **WHEN** a user signs up or changes their password
- **THEN** neither the password nor `1111` appears in the store (`users.json` / `users` table), only the hash

### Requirement: sign-up [req-2]
The server SHALL let anyone create an account with name, email and a password of at least 10 characters, SHALL make it an active viewer (admin for `ADMIN_EMAILS`), and SHALL sign the user in immediately.

#### Scenario: success
- **WHEN** `POST /auth/signup` `{ name: 'An Nguyen', email: ' An.Nguyen@Example.com ', password: 'abcdefghij', repeat: 'abcdefghij' }`
- **THEN** it returns `200 Me` with `email: 'an.nguyen@example.com'`, `role: 'viewer'`, `mustChangePassword: false`, sets `rl_session`, and `GET /api/me` with that cookie returns the same user

#### Scenario: admin email
- **WHEN** the email is listed in `ADMIN_EMAILS`
- **THEN** the new user's role is `admin`

#### Scenario: invalid input
- **WHEN** the name is empty, the email has no `@`, the password is shorter than 10 characters, or `repeat` differs
- **THEN** it returns `400 { error: 'invalid_input', fields }` with the messages from `ui.md` and creates nothing

#### Scenario: email taken
- **WHEN** an account with that email (any case) already exists
- **THEN** it returns `409 { error: 'email_taken' }`

### Requirement: sign-in [req-3]
The server SHALL sign a user in with email and password, SHALL answer the same way for an unknown email and a wrong password, and SHALL refuse disabled accounts.

#### Scenario: success
- **WHEN** `POST /auth/signin` with the right email (any case) and password
- **THEN** it returns `200 Me`, sets `rl_session`, and updates `last_sign_in_at`

#### Scenario: wrong credentials
- **WHEN** the email is unknown or the password is wrong
- **THEN** both return `401 { error: 'invalid_credentials' }` with no cookie

#### Scenario: disabled
- **WHEN** a disabled user signs in with the right password
- **THEN** it returns `403 { error: 'account_disabled' }` with no cookie

#### Scenario: break-glass admin
- **WHEN** a user listed in `ADMIN_EMAILS` signs in while stored as `viewer`
- **THEN** their role becomes `admin`

### Requirement: server-side sessions [req-4]
The server SHALL create a random-token session per sign-in or sign-up, store only the token's SHA-256 hash, and treat a session as valid only while unexpired and its user is enabled, using the user's current role.

#### Scenario: valid session
- **WHEN** a request carries a token created less than 12 hours ago for an enabled user
- **THEN** it is signed in as that user with their current role

#### Scenario: invalid session
- **WHEN** the token is unknown, expired, or its user is disabled
- **THEN** the request is treated as signed out

#### Scenario: stored form and cookie
- **WHEN** a session is created
- **THEN** the store holds `sha256(token)` and never the raw token, and the cookie has `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=43200`, with `Secure` only for an https `PUBLIC_URL`

#### Scenario: sweep
- **WHEN** the sweep runs (startup, then hourly)
- **THEN** expired sessions are removed

### Requirement: sign out [req-5]
The server SHALL end the current session on `POST /auth/signout`.

#### Scenario: sign out
- **WHEN** a signed-in user posts `/auth/signout`
- **THEN** their session is removed, `rl_session` is cleared, it redirects to `/signin?signedout=1`, and the old token no longer works

### Requirement: everything requires sign-in [req-6]
The server and web page SHALL require a session for every page and `/api/*` route except `/signin`, `/signup`, `/auth/*` and the static bundle.

#### Scenario: API without session
- **WHEN** `GET /api/plan`, `POST /api/plan`, `GET /api/me` or any `/api/admin/*` has no valid session
- **THEN** it returns `401 { error: 'unauthenticated' }` and nothing is read or changed

#### Scenario: page without session (built server)
- **WHEN** `GET /target/T1?today=2026-09-28` has no session
- **THEN** it returns 302 to `/signin?next=%2Ftarget%2FT1%3Ftoday%3D2026-09-28`, while `/signin`, `/signup` and `/assets/*` are served

#### Scenario: client gate
- **WHEN** a protected route loads and `GET /api/me` is 401
- **THEN** the page navigates to `/signin?next=<path+search>` and never requests `/api/plan`

### Requirement: password change and forced update [req-7]
The server SHALL let a signed-in user change their password, and SHALL restrict a user who must change their password to the update endpoint until they do.

#### Scenario: voluntary change
- **WHEN** `POST /api/me/password` `{ current: <right>, password: <new ≥10>, repeat: <same> }`
- **THEN** the password is replaced, `password_changed_at` is set, the user's other sessions stop working, and this session keeps working

#### Scenario: wrong current or invalid new
- **WHEN** `current` is wrong, the new password is shorter than 10 characters, `repeat` differs, or the new password equals the current one
- **THEN** it returns `400 { error: 'invalid_input', fields }` and nothing changes

#### Scenario: forced
- **WHEN** a user with `mustChangePassword` calls `GET /api/plan` or any `/api/admin/*`
- **THEN** it returns `403 { error: 'password_change_required' }`
- **WHEN** they post `/api/me/password` with a valid new password and no `current`
- **THEN** the flag is cleared and `GET /api/plan` works again

### Requirement: role checks on import [req-8]
The server SHALL let only editors and admins import, SHALL record the importer in the audit log, and SHALL reject cross-origin writes.

#### Scenario: viewer refused
- **WHEN** a viewer posts a valid workbook to `/api/plan`
- **THEN** it returns `403 { error: 'forbidden' }`, the plan and mappings are unchanged, and an audit entry `{ outcome: 'forbidden', userEmail }` is stored

#### Scenario: editor import
- **WHEN** an editor imports the v2.0 fixture
- **THEN** it returns 200 as before and the `ok` audit entry carries the editor's email

#### Scenario: cross-origin write
- **WHEN** any `POST`/`PATCH` under `/api` or `/auth` carries `Origin: https://evil.example`
- **THEN** it returns `403 { error: 'bad_origin' }`

### Requirement: user administration API [req-9]
The server SHALL let admins list users, change roles, disable/enable, reset passwords, revoke sessions and read the import log, and SHALL refuse these to non-admins.

#### Scenario: non-admin
- **WHEN** a viewer or editor calls any `/api/admin/*`
- **THEN** it returns `403 { error: 'forbidden' }`

#### Scenario: change role
- **WHEN** an admin sends `PATCH /api/admin/users/<an>` `{ role: 'editor' }`
- **THEN** it returns the updated user, and An's next request has role `editor` without signing in again

#### Scenario: disable and enable
- **WHEN** an admin sends `{ disabled: true }` for Minh
- **THEN** Minh's sessions stop working and his sign-in returns `account_disabled`; `{ disabled: false }` restores sign-in with his previous role

#### Scenario: reset password
- **WHEN** an admin posts `/api/admin/users/<lan>/reset-password`
- **THEN** Lan's sessions stop working, Lan can sign in with `1111`, and `/api/me` shows `mustChangePassword: true`

#### Scenario: guarded rows
- **WHEN** the target is in `ADMIN_EMAILS`
- **THEN** role, disable and reset return `409 { error: 'locked' }`
- **WHEN** the target is the admin themself
- **THEN** role, disable, reset and signout-all return `409 { error: 'self' }`
- **WHEN** the body is invalid
- **THEN** it returns `400 { error: 'invalid_body' }`; an unknown id returns `404 { error: 'not_found' }`

#### Scenario: sign out everywhere
- **WHEN** an admin posts `/api/admin/users/<id>/signout-all`
- **THEN** it returns `{ revoked: <n> }` and all that user's sessions stop working

#### Scenario: import log
- **WHEN** an admin calls `GET /api/admin/imports?limit=2` after 3 imports
- **THEN** it returns the newest 2 (when, email, file, size, outcome, planId, current, detail) and `nextBefore`; `before=<nextBefore>` returns the third

### Requirement: sign-in and sign-up pages [req-10]
The web page SHALL show `/signin` and `/signup` matching `mockups/signin.html` and `mockups/signup.html` with all their states.

#### Scenario: sign-in
- **WHEN** a signed-out user submits the right email and password on `/signin?next=/target/T1`
- **THEN** they land on `/target/T1`
- **WHEN** the server answers `invalid_credentials`
- **THEN** an alert reads "Email or password is wrong" and the password field is cleared
- **WHEN** it answers `account_disabled`
- **THEN** an alert reads "Your access is turned off"
- **WHEN** the URL has `?signedout=1` / `?expired=1`
- **THEN** the heading reads "You're signed out" / a notice reads "Your session ended"

#### Scenario: sign-up
- **WHEN** a visitor submits a valid form on `/signup`
- **THEN** they land on the timeline signed in as Viewer and see "Welcome, <name>"
- **WHEN** fields are invalid
- **THEN** each error shows under its field (`ui.md` copy) and no request is sent
- **WHEN** the server answers `email_taken`
- **THEN** an alert reads "This email already has an account"

#### Scenario: already signed in
- **WHEN** a signed-in user opens `/signin?next=/target/T2` or `/signup`
- **THEN** they are taken to `/target/T2` / `/`

### Requirement: update password page [req-11]
The web page SHALL show `/update-password` matching `mockups/update-password.html`, forced when `mustChangePassword` is set and voluntary from the user menu.

#### Scenario: forced
- **WHEN** a user with `mustChangePassword` opens any route
- **THEN** they are sent to `/update-password` showing "Set a new password" with no current-password field and no app header; saving a valid password takes them to the original route

#### Scenario: voluntary
- **WHEN** a user picks "Change password" in the menu
- **THEN** `/update-password` shows inside the app header with Current / New / Repeat fields; a wrong current password shows "Current password is wrong."; success shows "Password updated" and returns to the previous page

### Requirement: role-aware header and import [req-12]
The web page SHALL show the user chip and menu in every page header, show Import only to editors and admins, and show viewers the "ask an editor" empty state, matching `mockups/header-roles.html`.

#### Scenario: editor or admin header
- **WHEN** an editor opens `/`
- **THEN** the header has "Import workbook" and "Account: <name> (Editor)"; an admin sees an Admin badge and the menu link "Admin · users & import log"

#### Scenario: viewer header
- **WHEN** a viewer opens `/` or `/target/T1`
- **THEN** there is no Import button or file input, "Read-only" is shown, and the badge reads Viewer

#### Scenario: menu
- **WHEN** the chip is clicked
- **THEN** a menu shows name, email, role line, "Change password" and a "Sign out" form posting to `/auth/signout`; Escape closes it

#### Scenario: viewer with no plan
- **WHEN** a viewer opens `/` and `/api/plan` is 404
- **THEN** "Ask an editor to import the workbook" shows with no drop zone or file picker (editors keep the existing empty state)

#### Scenario: forbidden upload
- **WHEN** an upload answers 403 `forbidden`
- **THEN** the import error lists "Only editors can import the plan."

### Requirement: admin page [req-13]
The web page SHALL show `/admin` (Users) and `/admin/imports` (Import log) to admins, matching `mockups/admin.html`.

#### Scenario: users tab
- **WHEN** an admin opens `/admin`
- **THEN** a "Users" card lists users with role select, last sign-in, signed up, "Reset password", "Sign out everywhere" and "Disable"; locked and own rows show no select or actions; a reset user shows "Must update password"; search and the role filter narrow the list

#### Scenario: change role
- **WHEN** the admin picks Editor for An
- **THEN** `PATCH` is sent at once and "An Nguyen is now an Editor" appears; on error the select reverts with an alert toast

#### Scenario: confirmed actions
- **WHEN** the admin clicks Disable, Sign out everywhere or Reset password and confirms in the dialog
- **THEN** the matching request is sent and the row updates (Disabled badge + Enable / Must update password + toast "password is now 1111"); Cancel or Escape sends nothing

#### Scenario: import log tab
- **WHEN** the admin opens `/admin/imports`
- **THEN** entries show newest first with outcome badges (Imported / Needed mapping / Not allowed / Rejected) and Newer/Older paging; empty shows "No imports yet"

#### Scenario: not an admin
- **WHEN** a viewer opens `/admin`
- **THEN** they see "Admins only" and "Back to timeline", and no admin API call is made

### Requirement: auth storage and configuration [req-14]
The server SHALL keep users and sessions in Postgres when `DATABASE_URL` is set and in JSON files otherwise, via one forward-only migration, and SHALL read `ADMIN_EMAILS`, `PUBLIC_URL` and `SESSION_HOURS` from the environment.

#### Scenario: migration content
- **WHEN** `migrations/1759400000000_auth.sql` is read
- **THEN** it creates `users` and `sessions` as in `db.md` (unique lower-case email, role check, FK cascade, both indexes) and contains no `DROP` or `TRUNCATE`

#### Scenario: config defaults
- **WHEN** only `ADMIN_EMAILS=" Hung.Lay@cyberlogitec.com "` is set
- **THEN** adminEmails = `['hung.lay@cyberlogitec.com']`, sessionHours = 12, publicUrl = `http://localhost:<PORT>`; with `ADMIN_EMAILS` empty the server starts and logs a warning

#### Scenario: file fallback
- **WHEN** `DATABASE_URL` is unset
- **THEN** users and sessions are stored in `DATA_DIR/users.json` and `sessions.json` with the same behaviour
