# Tasks: roadline-v1

No component library exists (greenfield) — UI subtasks build minimal components with plain CSS and the `ui.md` tokens.

## 1. Project scaffold [req-13]
- [x] 1.1 [backend] Create `package.json` (npm) with deps `express`, `multer`, `xlsx`, `react`, `react-dom`, `react-router-dom`; dev deps `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `supertest`, `@testing-library/react`, `jsdom`, `tsx`, `eslint`, `typescript-eslint`, `prettier`. Scripts: `dev`, `build` (vite build → `dist/client`, tsc → `dist/server`), `start` (`node dist/server/index.js`), `test` (`vitest run`), `lint`
- [x] 1.2 [backend] `tsconfig.json` (strict) + `tsconfig.server.json`, `vite.config.ts` (proxy `/api` → 3000 in dev), `vitest.config.ts`, `.prettierrc`, `eslint.config.js`
- [x] 1.3 [backend] `.gitignore`: `node_modules/`, `dist/`, `data/`
- [x] 1.4 [test] Copy the workbook to `tests/fixtures/axc-fy2026-27.xlsx` (source: `C:\Users\hung.lay\Downloads\[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027.xlsx`; fallback per Impact Area)
Verify: `npm install && npm run lint && npx tsc --noEmit`

## 2. Model and fiscal calendar [req-6, req-8]
- [x] 2.1 [service] `src/shared/model.ts` — types `Status`, `Quarter`, `Due`, `Action`, `Target`, `Plan`, `Problem`, `ParseResult` per design.md
- [x] 2.2 [service] `src/shared/status.ts` — `parseStatus(text)` (case-insensitive, blank → `not_started`), `STATUS_LABEL`, `STATUS_ORDER`
- [x] 2.3 [service] `src/shared/fiscal.ts` — `monthColumns(plan)`, `quarterColumns(plan)`, `placeMonth(action)`, `placeQuarter(action)`, `currentPeriod(plan, today)`
- [x] 2.4 [test] `tests/fiscal.test.ts` — 12 columns Sep 2026…Aug 2027 with Q labels; Feb 2027 → month col 6 / Q2; ongoing → none; 28 Sep 2026 → Sep/Q1; 1 Oct 2027 → null
Verify: `npx vitest run tests/fiscal.test.ts`

## 3. AXC workbook parser [req-1, req-2]
- [x] 3.1 [backend] `src/server/read-grid.ts` — `readGrid(buffer, fileName): Record<string, Cell[][]>` via SheetJS (`header: 1, raw: true, defval: null`)
- [x] 3.2 [service] `src/shared/parse-axc.ts` — `parseAxcWorkbook(grid, fileName, importedAt): ParseResult`: target sheets by A1 `^(T\d+)\s*-\s*(.+)$`; header weight/owner/status; block headings by label; action table by header aliases; section rows; value parsing (quarter, due, status); list blocks, risks, change history; Executive Summary period, version, title
- [x] 3.3 [service] Problems collected with `{ sheet, row, message }`; any problem → `{ ok: false }`; version > "2.0" → warning
- [x] 3.4 [test] `tests/parse-axc.test.ts` — fixture: 4 targets, 26/21/18/10 actions, fiscal {2026, 9}, version "2.0"; T1 #1 fields; T4 section "Actions"; T3 #9 ongoing monthly; T2 7 must-achieve + 3 depends-on; T4 2 risks
- [x] 3.5 [test] Same file, grid-mutation cases: remove T2 header row → problem "action table not found" on "T2 Adoption"; Due "Q5 2027" → problem with sheet + row; version "3.0" → ok with warning
Verify: `npx vitest run tests/parse-axc.test.ts`

## 4. Flat CSV parser [req-3]
- [x] 4.1 [service] `src/shared/parse-csv.ts` — `parseFlatCsv(grid, fileName, importedAt): ParseResult`; required columns per design.md; target fields from first row per target; fiscal start from earliest month due
- [x] 4.2 [test] `tests/parse-csv.test.ts` — 3-row T1 CSV → 1 target, 3 actions, fiscal start Sep; missing `due` column → problem naming it
Verify: `npx vitest run tests/parse-csv.test.ts`

## 5. Next-action ranking [req-7]
- [x] 5.1 [service] `src/shared/next-actions.ts` — `nextActions(plan, today, { limit, targetId? })` with `nextDate` rules and sort order from design.md; returns `{ action, nextDate, overdue }[]`
- [x] 5.2 [service] `src/shared/progress.ts` — `progress(target)` → `{ done, total }`
- [x] 5.3 [test] `tests/next-actions.test.ts` — fixture, 28 Sep 2026, limit 5 → T3#9, T1#1, T1#2, T1#3, T1#4; overdue first, done excluded; targetId T2 limit 3 → only T2, ≤3
Verify: `npx vitest run tests/next-actions.test.ts`

## 6. Server API and storage [req-4, req-5, req-13]
- [x] 6.1 [backend] `src/server/plan-store.ts` — `PlanStore(dataDir)`: `load(): Plan | null`, `save(plan, buffer, fileName)` (copy current → `plan.prev.json`, write `plan.tmp.json`, rename → `plan.json`, keep `uploads/<ISO>-<name>`); serialize saves with a promise queue
- [x] 6.2 [backend] `src/server/app.ts` — `createApp({ dataDir })`: `GET /api/plan` (200 | 404 `no_plan`); `POST /api/plan` via multer memory storage, 5 MB limit, `.xlsx`/`.csv` only → `readGrid` → `parseAxcWorkbook` (xlsx) or `parseFlatCsv` (csv) → 200 `{ plan, warnings }` | 400 `{ error: 'invalid_plan', problems }` | 413 `file_too_large` | 415 `unsupported_type`
- [x] 6.3 [backend] Static hosting of `dist/client` with `index.html` fallback for non-`/api` GETs
- [x] 6.4 [backend] `src/server/index.ts` — read `PORT` (3000) and `DATA_DIR` (`./data`), start the app
- [x] 6.5 [test] `tests/api.test.ts` (supertest, temp data dir) — 404 before import; valid upload → 200 + `plan.json`; second upload → `plan.prev.json` exists; invalid upload → 400 and GET returns previous; `.pdf` → 415; 6 MB → 413; `GET /target/T1` → HTML
Verify: `npx vitest run tests/api.test.ts`

## 7. Timeline page [req-8, req-9, req-10]
- [x] 7.1 [frontend] `src/client/styles.css` — `:root` tokens from `ui.md` (surface, `--now`, `--s-ns|ok|risk|behind|done`), base layout
- [x] 7.2 [frontend] `src/client/main.tsx` + `app.tsx` — React Router routes `/` and `/target/:id`; `use-plan.ts` hook (fetch `/api/plan`, `replace(plan)`); `use-today.ts` (local date, `?today=` override)
- [x] 7.3 [frontend] `components/app-header.tsx` — title, period, source file + import time, Month|Quarter toggle (Month default), Import button slot
- [x] 7.4 [frontend] `components/status-dot.tsx`, `components/status-legend.tsx` — five statuses + "colored cell edge" note
- [x] 7.5 [frontend] `components/next-actions.tsx` — list from `nextActions(plan, today, { limit })`; row = dot · target id · action text · status label · due text (`↻ due 30 Sep` / `due Nov`); links to `/target/:id`
- [x] 7.6 [frontend] `components/timeline-grid.tsx` — target column (dot, name, status · weight · owner, done/total, `↻ n ongoing`, "View detail →") + period cells (count, topic list with dots, `—` when empty, `now` highlight, red/amber left edge); every cell links to `/target/:id`
- [x] 7.7 [frontend] `pages/timeline-page.tsx` — header, next actions, legend, grid
- [x] 7.8 [test] `tests/timeline-page.test.tsx` (testing-library, fixture plan, today 28 Sep 2026) — Month active, 12 columns, Sep has "now", T1/Nov lists 7 topics; Quarter → 4 columns, T1/Q1 7 topics; first next action is T3 monthly report; Behind topic → cell has red edge class
Verify: `npx vitest run tests/timeline-page.test.tsx` and `/devspec-verify roadline-v1`

## 8. Import from the page [req-11]
- [x] 8.1 [frontend] `components/import-button.tsx` — hidden file input (`.xlsx,.csv`), posts `FormData` to `/api/plan`, calls `replace(plan)` on 200
- [x] 8.2 [frontend] `components/import-states.tsx` — empty (drop zone + Choose file, "shown to everyone with the link"), loading (file name + progress bar, current plan stays visible), error (problem list, "Nothing replaced — still showing the import from <date>", Choose another file)
- [x] 8.3 [test] `tests/import.test.tsx` (mocked fetch) — 404 → empty state; success → header shows new file name; 400 → error panel with problems and previous plan still rendered
Verify: `npx vitest run tests/import.test.tsx` and `/devspec-verify roadline-v1`

## 9. Target detail page [req-12]
- [x] 9.1 [frontend] `components/target-header.tsx` — dot + `<id> · <name>`, Weight / Owner / Status (colored) / Progress with bar, objective
- [x] 9.2 [frontend] `components/action-plan.tsx` — legend badges; one block per quarter (`Q<n> <range> · <n> actions`, `now` tag); table `# | Action (+ → deliverable) | Success measure | Owner | Due | Status badge`; risk/behind row edge; ongoing actions under their quarter-less block "Ongoing"
- [x] 9.3 [frontend] `components/target-sections.tsx` — `<details>`: What this must achieve (open), How we will do it, Depends on, Risks, Change history ("No changes recorded")
- [x] 9.4 [frontend] `pages/target-page.tsx` — back link, header, next 3 (`nextActions` with `targetId`), action plan, sections; "Target not found" state
- [x] 9.5 [test] `tests/target-page.test.tsx` — `/target/T1`: name, 34%, Developer, 0 / 26, 3 next items, Q1 has now, 5 sections; `/target/T9` → "Target not found"
Verify: `npx vitest run tests/target-page.test.tsx` and `/devspec-verify roadline-v1`

## 10. Model: status words, next year, mapping types [req-16, req-17]
- [x] 10.1 [service] `src/shared/model.ts` — add `statusWord: string` to `Action` and `Target`; `quarter: Quarter | 'ongoing' | 'next_year'`; `Due` adds `{ kind: 'next_year' }`; new `MappingField`, `QuarterMeaning`, `DueMeaning`, `Mappings`, `UnknownValue`, `AppliedMapping`; `ParseResult` adds `applied` on ok and the `{ ok: false; needsMapping }` branch (per design.md revision 2)
- [x] 10.2 [service] `src/shared/suggest.ts` (new) — `normWord(word)`, `suggestStatus`, `suggestQuarter`, `suggestDue` with the keyword lists in design.md
- [x] 10.3 [service] `src/shared/fiscal.ts` — `hasNextYear(plan)`, `nextFiscalLabel(plan)`; `monthColumns` / `quarterColumns` take `{ nextYear }` and append a `Next year` column; `placeMonth` → 12 and `placeQuarter` → 4 for next-year actions
- [x] 10.4 [service] `src/shared/progress.ts` — `progress(target)` → `{ done, total, nextYear }`, this year only
- [x] 10.5 [service] `src/shared/next-actions.ts` — skip next-year actions; overdue **or** tone `behind` first, then the existing order
- [x] 10.6 [test] Update `tests/fiscal.test.ts`, `tests/next-actions.test.ts` (Behind-first + next-year excluded; 28 Sep v2.0 order unchanged), add `tests/suggest.test.ts`
Verify: `npx vitest run tests/fiscal.test.ts tests/next-actions.test.ts tests/suggest.test.ts`

## 11. Parser: unknown words, mappings, dropdown lists [req-1, req-2, req-3, req-14]
- [x] 11.1 [backend] `src/server/read-grid.ts` — return `{ grid, dropdowns }`; read with SheetJS `bookFiles: true`, map sheet name → XML via `xl/workbook.xml` + `xl/_rels/workbook.xml.rels` (not `Directory.sheets` order), collect `<dataValidation type="list">` with inline `formula1`; CSV → `dropdowns = {}`
- [x] 11.2 [service] `src/shared/parse-axc.ts` — `parseAxcWorkbook(grid, fileName, importedAt, { mappings, dropdowns })`: keep the file word in `statusWord`; resolve words through built-ins then `mappings`; collect unknown status / quarter / due words (rows + status dropdown lists) with counts, first 10 locations, `fromDropdown`, suggestion; quarter `next_year` forces `due = { kind: 'next_year' }` and skips its due word; due `quarter_end` → last month of the quarter; order of checks per design.md; return `applied`
- [x] 11.3 [service] `src/shared/parse-csv.ts` — same word resolution, unknown collection and `applied` for `status`, `target_status`, `quarter`, `due`
- [x] 11.4 [test] Copy `C:\Users\hung.lay\Downloads\[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027 (1).xlsx` to `tests/fixtures/axc-fy2026-27-v2.1.xlsx`; `tests/parse-axc-v21.test.ts` — no mappings → needsMapping (In progress ×7, Blocked ×0 from dropdown, FY27-28 ×14, no due asked); with mappings → ok, T1 12 + 7 next year, T1 #4 `on_track`/"In progress", 52 this-year actions, `applied` has 3 entries; TBD + `quarter_end` on a Q3 row → May; layout break still gives problems
- [x] 11.5 [test] Update `tests/parse-axc.test.ts` (due "Nov 2028" → outside-fiscal-year problem; "Blocked" → needsMapping), `tests/parse-csv.test.ts`, `tests/helpers.ts` (`readGrid(...).grid`)
Verify: `npx vitest run tests/parse-axc.test.ts tests/parse-axc-v21.test.ts tests/parse-csv.test.ts`

## 12. API: mapping round trip [req-15, req-19]
- [x] 12.1 [backend] `src/server/mapping-store.ts` (new) — `MappingStore(dataDir)`: `load(): Mappings`, `merge(partial, version?)` atomic write of `data/mappings.json` (temp + rename), serialized like `PlanStore`
- [x] 12.2 [backend] `src/server/app.ts` `POST /api/plan` — read optional multipart `mapping` (JSON) → 400 `invalid_mapping` if bad; parse with saved ∪ submitted mappings; `needsMapping` → 422 `{ error: 'needs_mapping', unknown }` (nothing saved); success → `PlanStore.save`, `MappingStore.merge(submitted, version)`, respond `{ plan, warnings, applied }`; version warning only when newer than tested and not in `seenVersions`
- [x] 12.3 [test] `tests/api.test.ts` — v2.1 first upload → 422, no `plan.json` change, no `mappings.json`; retry with mapping → 200 + `mappings.json`; third upload without mapping → 200 with `applied`; bad JSON / unknown meaning → 400 `invalid_mapping`; version warning on first v2.1 import only
Verify: `npx vitest run tests/api.test.ts`

## 13. Status words and grouped legend [req-17]
- [x] 13.1 [frontend] `src/client/components/status-dot.tsx` — `StatusDot`, `StatusLabel`, `StatusBadge` take `{ status, word }`; text = word (empty → "Not started"), color = tone class `bg-<tone>` / `fg-<tone>`
- [x] 13.2 [frontend] `src/client/components/status-legend.tsx` — `StatusLegend({ plan })` groups the plan's words by tone: "On track (In progress)"; note adds "┆ Next year = not in this year's progress" when the plan has next-year actions
- [x] 13.3 [frontend] Pass `statusWord` everywhere status is shown: `next-actions.tsx`, `timeline-grid.tsx`, `target-header.tsx`, `action-plan.tsx` (grouped badge legend), `pages/target-page.tsx`
- [x] 13.4 [test] `tests/timeline-page.test.tsx` — mapped v2.1 plan: legend "On track (In progress)", T1 #4 dot has `bg-on_track` and title "In progress"
Verify: `npx vitest run tests/timeline-page.test.tsx` and `/devspec-verify roadline-v1`

## 14. Mapping dialog and import notes [req-18, req-19]
- [x] 14.1 [frontend] `src/client/api.ts` — `uploadPlan(file, mapping?)` sends `mapping` as a multipart JSON field; 422 → `{ ok: false, needsMapping }`; 200 → `{ ok: true, plan, warnings, applied }`
- [x] 14.2 [frontend] `src/client/components/import-mapping-dialog.tsx` (new) — modal per `mockups/import-mapping.html`: groups Status / Quarter / Due, rows = word · found (count + locations, or "listed in the file's Status dropdown") · `<select>` with suggestion + "suggested" · status preview (`StatusDot` + word); footer note, `.btn` Cancel, `.btn.primary` "Apply & import"; applying state disables both and shows "Importing…"
- [x] 14.3 [frontend] `src/client/components/import-notes.tsx` (new) — dismissable info line "Applied saved mappings: …" and amber warning line for warnings (template version), per `mockups/timeline.html`
- [x] 14.4 [frontend] `src/client/pages/timeline-page.tsx` — import flow: `needsMapping` → open dialog with the file kept in state; Apply → `uploadPlan(file, mapping)`; Cancel → note "Import cancelled — <file> was not imported."; success → `replace(plan)` + notes
- [x] 14.5 [test] `tests/import.test.tsx` — 422 → dialog lists 3 words with suggestions; Apply posts the same file with `mapping` and renders the plan + applied note; Cancel shows the cancelled note and posts nothing more
Verify: `npx vitest run tests/import.test.tsx` and `/devspec-verify roadline-v1`

## 15. Next-year UI [req-16, req-20]
- [x] 15.1 [frontend] `src/client/styles.css` — token `--next: #f3f4f8`; `.hd.ny`, `.cell.ny` (background `--next`, 2px dashed left border); `.q.ny` block and `.ny-tag`
- [x] 15.2 [frontend] `src/client/components/timeline-grid.tsx` — append the Next-year column (`hasNextYear`, `nextFiscalLabel`) in both views; target cell `<done> / <total> done · n next year`
- [x] 15.3 [frontend] `src/client/components/next-actions.tsx` — subtitle adds "· n moved to next year"
- [x] 15.4 [frontend] `src/client/components/target-header.tsx` — progress this year + sub-line "this year · n more next year"; `src/client/components/action-plan.tsx` — "Next year · FY27-28 · n actions" block after Q4 with tag and hint
- [x] 15.5 [test] `tests/timeline-page.test.tsx` + `tests/target-page.test.tsx` — mapped v2.1 plan: 13 columns, Next-year topics 7/5/2/0, T1 "2 / 12 done · 7 next year"; T1 page Next-year block with 7 rows; v2.0 plan has no Next-year column or block
Verify: `npx vitest run tests/timeline-page.test.tsx tests/target-page.test.tsx` and `/devspec-verify roadline-v1`

## 16. End-to-end check and sign-off [req-9, req-12, req-13, req-18, req-20]
- [x] 16.1 [test] `npm run build && npm start`; import the v2.0 fixture (no dialog), then the v2.1 fixture (dialog → Apply), then v2.1 again (no dialog, info note only); open `/?today=2026-09-29` and `/target/T1?today=2026-09-29`; compare against `mockups/timeline.html`, `mockups/target.html`, `mockups/import-mapping.html`; screenshots to `verify/`
- [x] 16.2 MANUAL: BA approves screenshots of the timeline, T1 detail and mapping dialog
Verify: `/devspec-verify roadline-v1` and MANUAL: BA approves screenshot
