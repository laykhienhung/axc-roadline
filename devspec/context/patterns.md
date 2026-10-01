# Patterns

## file → plan (parsing pipeline)
Upload → `readGrid(buffer, name)` returns `{ grid, dropdowns }` (`src/server/read-grid.ts:70`) → `parseAxcWorkbook` / `parseFlatCsv(grid, name, importedAt, { mappings, dropdowns })` (`src/shared/parse-axc.ts:373`). Blocks and table headers are found **by label text**, never by row number. Results are a union: `{ ok: true, plan, warnings, applied }` | `{ ok: false, problems }` | `{ ok: false, needsMapping }` — never a partial plan. Check order is fixed: layout problems → unknown words → unmappable values (`parse-axc.ts:413`).

## words → meanings
Every status / quarter / due cell goes through `WordResolver` (`src/shared/resolve.ts:25`): built-in words first, then saved `Mappings` (keys normalized by `normWord`), else recorded as an `UnknownValue` with a suggestion (`src/shared/suggest.ts`). Actions keep the tone in `status` and the file's text in `statusWord` (`src/shared/model.ts:22`). Dropdown-only words never block an import on their own (`resolve.ts` `unknownValues`).

## storage
Stores are small classes over JSON files in `DATA_DIR`: write `*.tmp.json`, then `rename` over the real file; writes serialized with a promise queue (`src/server/plan-store.ts:28`, `src/server/mapping-store.ts:78`). `PlanStore` also keeps `plan.prev.json` and the raw upload under `uploads/`.

## HTTP handler shape
`createApp({ dataDir, clientDir })` (`src/server/app.ts:20`) builds the Express app (tests use it with temp dirs). Handlers validate → early `res.status(...).json({ error })` → do the work → `res.json(...)`. SPA fallback `app.get(/.*/)` after `/api` (`app.ts:107`).

## derived data
Pure functions of `(plan, today)` in `src/shared/`: `nextActions` (`next-actions.ts:24`, urgent = overdue or Behind first), `progress` (this year only + `nextYear`, `progress.ts:5`), `placeMonth` / `placeQuarter` / `currentPeriod` (`fiscal.ts:72`, `:97`). No hidden clock.

## client data flow
`usePlan()` loads once and exposes `replace(plan)` (`src/client/use-plan.ts:12`); `App` owns it and passes it to pages. Import flow lives in `TimelinePage.send` (`src/client/pages/timeline-page.tsx`): 422 → keep the `File` in state → `ImportMappingDialog` → re-send the same file with `mapping`. Scroll resets on route change (`src/client/app.tsx:8`).

## component shape
Page = composition of section components, each a `<section className="card" aria-label="…">` (aria-labels are what tests query). Grid cells are `Link`s to `/target/:id` with `data-target` / `data-col` hooks (`src/client/components/timeline-grid.tsx:34`).
