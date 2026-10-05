# Rules

- **Don't commit**: `node_modules/`, `dist/`, `data/`, `data.bak-*/` (`.gitignore`). `tests/fixtures/*.xlsx` are real plan workbooks — keep them internal.
- **Before merge**: `npm run lint && npm test && npm run build` all pass (the build also type-checks the server with `tsconfig.server.json`).
- **A failed or mapping-needed import never replaces the plan or writes mappings** — save only after `ok: true` (`src/server/app.ts`).
- **Security**: every page and `/api/*` route needs a session except `/signin`, `/signup`, `/update-password`, `/auth/*` and the static bundle (`src/server/auth.ts` `pageGate` / `apiGate`). Roles live in `users.role` (viewer < editor < admin) and are read on every request; imports need editor+, `/api/admin/*` admin (`requireRole`). `ADMIN_EMAILS` is the break-glass: forced admin at sign-in, locked in the admin API. Passwords are scrypt hashes with the cost stored in the hash; sessions store only `sha256(token)`. Never log passwords, hashes or tokens. While `mustChangePassword` is set only `/api/me` + `POST /api/me/password` answer. Keep the auth routes and `GET /api/me` before `apiGate` in `createApp`. Non-GET requests are Origin-checked against `PUBLIC_URL`; behind a tunnel or proxy set `PUBLIC_URL` to the public URL. Accepted risks (user decision): open sign-up, no throttle, reset password `1111`. Uploads capped at 5 MB, `.xlsx` / `.csv` only (`app.ts:12`). Keep SheetJS at 0.20.3+ from cdn.sheetjs.com (the npm 0.18.x line has a prototype-pollution bug on crafted files). Workbook formulas are read as cached values, never executed.
- **Fixing a wrong mapping**: edit `data/mappings.json` on the server (no UI), then re-import.

- **Database safety**: migrations are forward-only and must never contain `DROP`. Automated tests never connect to a database. Never log `DATABASE_URL`; diagnostics may log only its host and database name.

## Gotchas
- Fiscal year start is **per file**: 2.x period text ("September 2026 - August 2027": Sep → Aug, Q1 = Sep–Nov) or 4.2 "Start month (M1)" (Oct → Sep). Two layouts are detected per file (`plan.layout`: `targets` = `T1 - …` sheets, `objectives` = `O1 - …` sheets); every 4.2 rule is a fallback when the 2.x element is missing, and the 2.x fixture tests are the regression net (never edit them to pass). `plan.progressBy === 'percent'` (a `%` column) makes progress the average % (blank = 0). Use `nounFor(plan)` for any user-visible "target" word. Due values are month-only ("Nov 2026") or recurring ("monthly" / "quarterly"); next-year actions have `quarter: 'next_year'` and sit in a 13th column.
- The action table starts on a different row per sheet (T4 is 2 rows earlier) — find it by header labels.
- SheetJS `wb.Directory.sheets` is **not** in sheet order; map sheet names to XML via `xl/workbook.xml` + rels (`src/server/read-grid.ts:29`).
- The v2.0 workbook already lists "In progress" / "Blocked" in its Status dropdown — that's why dropdown-only words don't open the dialog.
- Server/shared imports need the `.js` extension (NodeNext); the client's must not have it.
- jsdom has no `window.scrollTo`; `renderApp` stubs it (`tests/render.tsx:23`).
- 13 grid columns only fit at ≥1440px because the minimum is 80px (`styles.css` `.grid`); raising it clips the Next-year column.
- `multer` decodes multipart filenames as latin1 — re-decode as UTF-8 (`app.ts`).
- Dev mode: the Vite proxy keys must stay `'/api/'` and `'/auth/'` (with the slash) — `'/api'` also catches the client module `/api.ts`. When the server runs from source it redirects page requests to Vite (`src/server/index.ts`, `DEV_CLIENT_URL`).
- `node-postgres` returns `bigint` columns as strings and sends JS arrays as Postgres arrays: convert ids with `Number()` and pass `jsonb` values as `JSON.stringify(...)` (`src/server/pg-storage.ts`, `pg-auth-store.ts`).
- Auth tests hash with scrypt (slow on purpose); `vitest.config.ts` sets `testTimeout: 20_000`. jsdom tests have no `jest-dom`: use `getAttribute`, not `toHaveAttribute`.
- `tests/encoding.test.ts` fails on mis-decoded UTF-8 (mojibake) in `src/` and `tests/`; save files as UTF-8.
