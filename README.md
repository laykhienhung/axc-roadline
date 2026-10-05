# Roadline

A small internal web app that turns the AXC team's objectives & action-plan workbook into a shared, read-only view:

- **Timeline** — targets as rows, months (default) or quarters as columns across the fiscal year (Sep → Aug), with a **Next year** column for actions moved to the following year. Each cell lists the topics due then, with a status dot.
- **Next actions** — the top 5 open actions of this year: overdue and Behind/Blocked first, then by due date and target weight.
- **Target detail** (`/target/:id`) — weight, owner, status, this-year progress, objective, the next 3 actions, the action plan by quarter (+ Next year) and the target's notes (must achieve, how, depends on, risks, change history).
- **Import** — editors and admins upload `.xlsx` or `.csv`; the plan is replaced for everyone. A file whose layout can't be read is rejected with row-level problems and the current plan stays.
- **Adaptive import** — when a file uses new words (e.g. status "In progress", quarter "FY27-28"), a dialog asks once what each means, pre-filled with suggestions. The answer is saved and reused on every later import.

- **Accounts & roles** — everyone signs in; viewers read the plan, editors also import, admins also manage users and see the import log.

The workbook stays the source of truth; the web page never edits it.

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run build
npm start
```

Set `ADMIN_EMAILS=you@company.com` (in `.env`), open http://localhost:3000, create an account with that email (it becomes an admin), then import a workbook (e.g. `tests/fixtures/axc-fy2026-27.xlsx`).

Add `?today=YYYY-MM-DD` to any URL to view the plan as of another date (handy for demos).

### Configuration

| Env var      | Default       | Meaning                                                                      |
| ------------ | ------------- | ---------------------------------------------------------------------------- |
| `PORT`       | `3000`        | HTTP port                                                                    |
| `DATA_DIR`   | `./data`      | Where the current plan, previous plan, uploads and value mappings are stored |
| `CLIENT_DIR` | `dist/client` | Built web page to serve                                                      |

Sign-in settings (`ADMIN_EMAILS`, `PUBLIC_URL`, `SESSION_HOURS`) are under [Accounts & roles](#accounts--roles); `DATABASE_URL` under [Database](#database).

## Accounts & roles

Every page and API call needs a signed-in account. Anyone who can reach the server can **create an account** at `/signup` (name, any email, a password of at least 10 characters) and is signed in straight away as a **Viewer**. An admin decides who gets more:

| Role   | Can                                                                      |
| ------ | ------------------------------------------------------------------------ |
| Viewer | view the timeline, target pages and next actions                         |
| Editor | also import or replace the plan                                          |
| Admin  | also manage users on `/admin` and read the import log (`/admin/imports`) |

- **First admin / break-glass**: emails in `ADMIN_EMAILS` become admins when they sign up, are forced back to admin at every sign-in, and are locked on the Admin page (no role change, disable or reset). Admins can't change, disable or reset themselves.
- **Admin page**: change a role (applies on the user's next page load), **Reset password**, **Sign out everywhere**, **Disable / Enable**. Nobody is ever deleted.
- **Forgot password**: there is no email. An admin clicks **Reset password**; the password becomes `1111` and the user must set a new one on the **Update password** screen before they can open anything else. Tell the user right after a reset.
- **Change password**: from the user menu. It signs the user out on their other devices.
- Passwords are stored as scrypt hashes (Node's built-in `crypto`); sessions are server-side (only a SHA-256 of the cookie token is stored, 12 h). Without `DATABASE_URL`, users and sessions live in `DATA_DIR/users.json` + `sessions.json` (that is what `npm test` uses). `npm run db:migrate` creates the `users` and `sessions` tables.

| Env var         | Default                                      | Meaning                                                                                                                                                                                                  |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAILS`  | _(empty; the server warns)_                  | Comma-separated admin emails (case-insensitive)                                                                                                                                                          |
| `PUBLIC_URL`    | `http://localhost:$PORT` (dev: the Vite URL) | The URL people open. Writes from any other `Origin` are refused (`403 bad_origin`), and `https://` turns on `Secure` cookies. **Set it to the public URL** when serving through ngrok or a reverse proxy |
| `SESSION_HOURS` | `12`                                         | Session length                                                                                                                                                                                           |

**Accepted risks** (team decision): open sign-up for any email domain, no sign-in throttling, and the `1111` reset (anyone who knows a reset user's email can sign in with it until that user does; it only opens the Update password screen). Admins can disable unknown accounts.

## Database

Roadline uses JSON files in `DATA_DIR` while `DATABASE_URL` is unset. This is the
default used by automated tests. Set `DATABASE_URL` to use PostgreSQL instead; it
must point at the `postgres` database and select the `roadline` schema:

```bash
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres?options=-csearch_path%3Droadline
```

Create the schema and tables before starting the application with PostgreSQL:

```bash
npm run db:migrate
```

To move existing JSON-file data into an empty database once, run:

```bash
npm run db:import-files
```

Set `DB_MIGRATE_ON_START=1` only when the server should run pending migrations at
startup. Otherwise migrations are run explicitly with `npm run db:migrate`.

PostgreSQL keeps the newest 10 imported plans as history. It also records every
import attempt in the `imports` audit log; pruning old plans keeps those audit rows
and clears their plan reference.

The pilot runs as `postgres`. Later, create a `roadline_app` role and grant it
access only to the Roadline schema:

```sql
CREATE ROLE roadline_app LOGIN PASSWORD '<choose-a-secret>';
GRANT USAGE ON SCHEMA roadline TO roadline_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA roadline TO roadline_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA roadline TO roadline_app;
-- tables and sequences created by later migrations (run as the migrating role)
ALTER DEFAULT PRIVILEGES IN SCHEMA roadline GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roadline_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA roadline GRANT USAGE, SELECT ON SEQUENCES TO roadline_app;
```

## Import formats

Both AXC templates are supported; the layout is detected per file. 2.x files import exactly as before.

### AXC workbook 2.x (`.xlsx`)

Template as used by `[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027.xlsx` (tested with template versions 2.0 and 2.1):

- `Executive Summary` sheet — fiscal period (e.g. "September 2026 - August 2027"), team, `Version`.
- One sheet per target whose cell **A1** reads `T1 - <name>`, `T2 - <name>`, … Row 2 holds `Weight`, `Owner`, `Status`.
- Numbered blocks found **by their label**: `OBJECTIVE`, `WHAT THIS MUST ACHIEVE`, `ACTION PLAN`, `HOW WE WILL DO IT`, `WHAT THIS DEPENDS ON`, `RISK & MITIGATION`, `CHANGE HISTORY`.
- Action table columns (found by header name): `#`, `Quarter`, `Action`, `Deliverable`, `Success measure`, `Owner`, `Due`, `Status`. Rows like `A. Automation workflows` start a section.

Built-in values: quarter `Q1`–`Q4` or `ongoing`; due `Nov 2026`, `monthly` or `quarterly`; status `Not started`, `On track`, `At risk`, `Behind`, `Done` (blank = Not started). Anything else goes through the mapping dialog.

### AXC workbook 4.2 (`.xlsx`)

Template "4.2 (01/10/2026)" (`tests/fixtures/axc-fy2026-27-v4.2.xlsx`: 6 objectives, 84 actions):

- `Executive Summary`: **Start month (M1)** date (e.g. 2026-10-01), team and `Version`. The fiscal year is the 12 months from the Start month (Oct 2026 – Sep 2027, so Q1 = Oct–Dec).
- One sheet per **objective** whose cell **A1** reads `O1 - <name>`, `O2 - <name>`, … Row 2 holds `Owner` and `Status`. There is **no Weight**, so all objectives weigh the same (shown as "equal").
- Blocks `OBJECTIVE` and `ACTION PLAN`. Action table columns: `#`, `Quarter`, `Action`, `Owner`, `Partners`, `Due`, `Status`, `%`, `Reference document`, `Note`. `Deliverable` and `Success measure` are optional.
- **Objective details**: a row like `1.1 | (no quarter) | AI strategy & roadmap approved | Goal: … / Needs first: … / JD: …` starts a group; the actions below it belong to it. The page shows them in an "Objective details" card.
- **Progress = average `%`** of this year's actions (blank = 0%) whenever the action table has a `%` column; otherwise it is the share of actions marked Done.
- Due cells are dates (EDATE formulas are read as cached values), `Monthly` or `Quarterly`. Words like `Yearly`, `Per BOD schedule`, `Per BOD review`, `Per pilot` and `Per course` are asked about **once** in the mapping dialog (e.g. as "end of its quarter") and then remembered, as is the status `In progress`.
- The UI says **objective** for a 4.2 file and **target** for a 2.x file. Partners, %, reference documents and the full note show on the objective page and in the action drawer.

### Flat CSV (`.csv`)

One row per action. Required columns: `target_id`, `no`, `quarter`, `action`, `due`. Optional: `target_name`, `target_weight`, `target_owner`, `target_status`, `section`, `deliverable`, `success_measure`, `owner`, `status`. The fiscal year starts in September of the year of the earliest month due.

### Value mappings

Saved in `DATA_DIR/mappings.json`, shared by everyone:

```json
{
  "status": { "in progress": "on_track", "blocked": "behind" },
  "quarter": { "fy27-28": "next_year" },
  "due": { "tbd": "quarter_end" },
  "seenVersions": ["2.0", "2.1"]
}
```

To fix a wrong mapping, edit this file and import again. Meanings: status → `not_started` · `on_track` · `at_risk` · `behind` · `done`; quarter → `Q1`–`Q4` · `ongoing` · `next_year`; due → `next_year` · `quarter_end` (last month of the action's quarter).

## Development

```bash
npm run dev     # API server (tsx watch, :3000) + Vite dev server (:5173, proxies /api/)
npm test        # Vitest (unit, API and UI tests)
npm run lint    # ESLint + Prettier check
npm run build   # client → dist/client, server → dist/server
```

In dev mode open http://localhost:5173 (hot reload). http://localhost:3000 still works: page requests redirect to Vite, only `/api/*` is served there. Set `DEV_CLIENT_URL` if Vite runs elsewhere.

Run `npm run lint && npm test && npm run build` before merging.

### Project structure

```
src/shared/   plan model, fiscal calendar, AXC/CSV parsers, word resolver, next-action ranking (pure TS)
src/server/   Express app: GET/POST /api/plan, workbook reader, JSON stores, static web page
src/client/   React app: pages (timeline, target), components, hooks, styles.css
tests/        Vitest specs; fixtures/ holds the real v2.0 and v2.1 AXC workbooks
devspec/      specs, board, archived changes and reports (see devspec/context/ for conventions)
```

### API

Errors are `{ error: "<code>" }` (+ `fields` for form errors). Every `/api/*` call without a session answers `401 unauthenticated`. While a reset password is pending, only `/api/me` and `/api/me/password` answer (others `403 password_change_required`). Non-GET requests from a foreign `Origin` get `403 bad_origin`.

| Method | Path                                  | Who       | Result                                                                                                                                                                                                                        |
| ------ | ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/signup`                        | anyone    | `{ name, email, password, repeat }` → `200 Me` + cookie · `400 invalid_input { fields }` · `409 email_taken`                                                                                                                  |
| POST   | `/auth/signin`                        | anyone    | `{ email, password }` → `200 Me` + cookie · `401 invalid_credentials` · `403 account_disabled`                                                                                                                                |
| POST   | `/auth/signout`                       | anyone    | → `302 /signin?signedout=1`                                                                                                                                                                                                   |
| GET    | `/api/me`                             | signed in | `200 { id, email, name, role, mustChangePassword }`                                                                                                                                                                           |
| POST   | `/api/me/password`                    | signed in | `{ current?, password, repeat }` → `200 Me` · `400 invalid_input { fields }`                                                                                                                                                  |
| GET    | `/api/plan`                           | viewer+   | `200` plan · `404 { error: "no_plan" }` · `503 db_unavailable`                                                                                                                                                                |
| POST   | `/api/plan`                           | editor+   | multipart `file` (+ optional `mapping` JSON) → `200 { plan, warnings, applied }` · `400 invalid_plan` / `invalid_mapping` · `422 needs_mapping { unknown }` · `413 file_too_large` · `415 unsupported_type` · `403 forbidden` |
| GET    | `/api/admin/users`                    | admin     | `200 AdminUser[]`                                                                                                                                                                                                             |
| PATCH  | `/api/admin/users/:id`                | admin     | `{ role }` or `{ disabled }` → `200 AdminUser` · `400 invalid_body` · `404` · `409 locked` / `self`                                                                                                                           |
| POST   | `/api/admin/users/:id/reset-password` | admin     | → `200 AdminUser` · `404` · `409 locked` / `self`                                                                                                                                                                             |
| POST   | `/api/admin/users/:id/signout-all`    | admin     | → `200 { revoked }` · `404` · `409 self`                                                                                                                                                                                      |
| GET    | `/api/admin/imports?before&limit`     | admin     | `200 { items, nextBefore }` (limit ≤ 50)                                                                                                                                                                                      |

## Notes

- Uploads are limited to 5 MB and `.xlsx` / `.csv`. SheetJS is installed from cdn.sheetjs.com (0.20.3) — the npm 0.18.x release has a known flaw when reading crafted files.
- `tests/fixtures/` contains real internal plan data; keep this repository internal.
