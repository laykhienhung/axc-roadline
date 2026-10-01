# Rules

- **Don't commit**: `node_modules/`, `dist/`, `data/`, `data.bak-*/` (`.gitignore`). `tests/fixtures/*.xlsx` are real plan workbooks — keep them internal.
- **Before merge**: `npm run lint && npm test && npm run build` all pass (the build also type-checks the server with `tsconfig.server.json`).
- **A failed or mapping-needed import never replaces the plan or writes mappings** — save only after `ok: true` (`src/server/app.ts`).
- **Security**: no auth by design (internal network, anyone with the link can view, import and map). Uploads capped at 5 MB, `.xlsx` / `.csv` only (`app.ts:12`). Keep SheetJS at 0.20.3+ from cdn.sheetjs.com — the npm 0.18.x line has a prototype-pollution bug on crafted files. Workbook formulas are read as cached values, never executed.
- **Fixing a wrong mapping**: edit `data/mappings.json` on the server (no UI), then re-import.

## Gotchas
- Fiscal year runs **Sep → Aug** (Q1 = Sep–Nov). Due values are month-only ("Nov 2026") or recurring ("monthly" / "quarterly"); next-year actions have `quarter: 'next_year'` and sit in a 13th column.
- The action table starts on a different row per sheet (T4 is 2 rows earlier) — find it by header labels.
- SheetJS `wb.Directory.sheets` is **not** in sheet order; map sheet names to XML via `xl/workbook.xml` + rels (`src/server/read-grid.ts:29`).
- The v2.0 workbook already lists "In progress" / "Blocked" in its Status dropdown — that's why dropdown-only words don't open the dialog.
- Server/shared imports need the `.js` extension (NodeNext); the client's must not have it.
- jsdom has no `window.scrollTo`; `renderApp` stubs it (`tests/render.tsx:23`).
- 13 grid columns only fit at ≥1440px because the minimum is 80px (`styles.css` `.grid`); raising it clips the Next-year column.
- `multer` decodes multipart filenames as latin1 — re-decode as UTF-8 (`app.ts`).
- Dev mode: the Vite proxy key must stay `'/api/'` (with the slash) — `'/api'` also catches the client module `/api.ts`. When the server runs from source it redirects page requests to Vite (`src/server/index.ts`, `DEV_CLIENT_URL`).
