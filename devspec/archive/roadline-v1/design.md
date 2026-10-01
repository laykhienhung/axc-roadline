# Design: roadline-v1

Greenfield. Conventions and layout follow the charter in `devspec/context/` (TypeScript strict, `src/shared` / `src/server` / `src/client`, Vitest).

## Architecture

```
Browser (anyone with the link)
  React SPA ── GET  /api/plan ─────────────┐
    TimelinePage  /                        │
    TargetPage    /target/:id              ▼
    ImportButton ─ POST /api/plan ──▶ Express (src/server)
                    (multipart file)       │  upload guard (≤5 MB, .xlsx/.csv)
                                           ▼
                                   readGrid (SheetJS)  ─▶ { sheet: Cell[][] }
                                           ▼
                        parseAxcWorkbook | parseFlatCsv   (src/shared)
                                           │ problems? ─▶ 400 {error, problems}  (plan untouched)
                                           ▼ plan
                                   PlanStore.save()  data/plan.json (+ plan.prev.json, uploads/)
                                           ▼
                                   200 { plan, warnings }

Client-side derived views (src/shared, pure, `today` injected):
  fiscal.ts (quarters, month columns, current period) · next-actions.ts · progress
```

One Node process serves the API and the built SPA (SPA fallback for `/target/*`).

## Data model (`src/shared/model.ts`)

```ts
type Status = 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'done';
type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type Due =
  | { kind: 'month'; year: number; month: number }          // "Nov 2026" → {2026, 11}
  | { kind: 'recurring'; every: 'monthly' | 'quarterly' };
interface Action {
  targetId: string; section: string; no: number;
  quarter: Quarter | 'ongoing';
  action: string; deliverable: string; measure: string | null;
  owner: string; due: Due; status: Status;
}
interface Target {
  id: string; name: string; weight: number;                 // 0..1
  owner: string; status: Status; objective: string;
  mustAchieve: string[]; how: string[]; dependsOn: string[];
  risks: { risk: string; mitigation: string }[];
  changes: { date: string; what: string; reason: string; by: string }[];
  actions: Action[];
}
interface Plan {
  title: string;
  fiscal: { startYear: number; startMonth: number };        // FY26-27 → {2026, 9}
  templateVersion: string | null;
  source: { fileName: string; importedAt: string };         // ISO timestamp
  targets: Target[];
}
interface Problem { sheet?: string; row?: number; message: string }
type ParseResult = { ok: true; plan: Plan; warnings: Problem[] } | { ok: false; problems: Problem[] };
```

## Parsing

- **Grid first.** `readGrid(buffer, fileName)` (`src/server/read-grid.ts`) uses SheetJS `read` + `sheet_to_json(ws, { header: 1, raw: true, defval: null })` per sheet → `Record<string, Cell[][]>`. Formulas are read as cached values. CSV goes through the same call (one sheet).
- **AXC template** (`src/shared/parse-axc.ts`), located by label, never by row number:
  - Target sheets: A1 matches `^(T\d+)\s*-\s*(.+)$`. Sheet order = target order.
  - Header row 2: `Weight` → B, `Owner` → D, `Status` → G (blank = `not_started`).
  - Blocks start at a row whose A cell matches `^\d+\s+<LABEL>` with LABEL in `OBJECTIVE`, `WHAT THIS MUST ACHIEVE`, `ACTION PLAN`, `HOW WE WILL DO IT`, `WHAT THIS DEPENDS ON`, `RISK & MITIGATION`, `CHANGE HISTORY`. A block runs until the next block heading. Unknown headings (e.g. `LINK TO THE MATURITY SCORE`) are skipped.
  - Action table: the header row is found by column names through an alias map (`#`, `Quarter`, `Action`, `Deliverable`, `Success measure`, `Owner`, `Due`, `Status`), so column order may change. Rows where A matches `^[A-Z]\.\s+` are section headers. Rows where A is a number are actions. The table ends at `ACTIONS DONE` or the next block. A target with no section rows gets section `Actions`.
  - List blocks read column B. Risks: B = risk, E = mitigation. Change history: B date, C what, E reason, G by; rows with only a number are skipped.
  - `Executive Summary`: A2 gives the fiscal period (`September 2026 - August 2027` → start {2026, 9}); the `Version` row gives `templateVersion`; the plan title comes from C5 (team) plus the period.
  - Value parsing: Quarter `Q1..Q4` or `ongoing` (case-insensitive, spaces trimmed). Due `Mon YYYY` → month; `monthly` / `quarterly` → recurring. Status labels map case-insensitively; blank → `not_started`. All text cells are trimmed and runs of whitespace collapsed (`A.  Automation workflows` → `A. Automation workflows`).
- **Flat CSV** (`src/shared/parse-csv.ts`): header row with columns `target_id, target_name, target_weight, target_owner, target_status, section, no, quarter, action, deliverable, success_measure, owner, due, status`. Target fields are taken from the first row of each target. Fiscal start = September of the fiscal year containing the earliest month due. Detail blocks (objective, risks…) are empty for CSV.
- **Fail loud.** Any problem → `{ ok: false, problems }`; never a partial plan. A template version newer than `2.0` is a warning, not a problem.

## Fiscal calendar (`src/shared/fiscal.ts`)

- Q1 = start month + 0..2, Q2 = +3..5, Q3 = +6..8, Q4 = +9..11 (FY26-27: Q1 Sep–Nov 2026).
- `monthColumns(plan)` → 12 `{ year, month, quarter }`; `quarterColumns(plan)` → 4 with date-range labels.
- Placement: month view puts an action in its due-month column; quarter view in its quarter. Recurring (`ongoing`) actions are not placed in cells.
- `currentPeriod(plan, today)` → current month index and quarter, or `null` when today is outside the fiscal year.

## Next actions (`src/shared/next-actions.ts`)

`nextActions(plan, today, { limit, targetId? })`:
1. Candidates = actions with status ≠ `done`.
2. `nextDate`: month due → last day of that month; `monthly` → last day of today's month; `quarterly` → last day of today's fiscal quarter.
3. Sort by: overdue first (`nextDate < today`), then `nextDate` ascending, then target weight descending, then target order, then action `no`.
4. Return the first `limit` (5 on the timeline, 3 on a target page).

On 28 Sep 2026 with the AXC workbook: T3 #9 (monthly, 30 Sep) first, then the Nov-2026 actions of T1 (weight 34%).

## API (`src/server`)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/plan` | — | `200 Plan` · `404 { error: 'no_plan' }` |
| POST | `/api/plan` | `multipart/form-data`, field `file` | `200 { plan, warnings }` · `400 { error: 'invalid_plan', problems }` · `413 { error: 'file_too_large' }` · `415 { error: 'unsupported_type' }` |
| GET | `/*` | — | built SPA (`index.html` fallback) |

- Upload via `multer` memory storage, limit 5 MB, extension `.xlsx` or `.csv`.
- `PlanStore` (`src/server/plan-store.ts`): `load()` / `save(plan, originalBuffer, fileName)`. Writes `data/plan.tmp.json` then renames over `data/plan.json`; the old file is copied to `data/plan.prev.json` first; the upload is kept as `data/uploads/<ISO-timestamp>-<name>`. Imports are serialized (one at a time).
- Config: `PORT` (default 3000), `DATA_DIR` (default `./data`).

## Client (`src/client`)

- Routes: `/` → `TimelinePage`, `/target/:id` → `TargetPage` (React Router).
- `usePlan()` fetches `/api/plan` once; `ImportButton` posts the file and replaces the plan on success.
- `today` = local date; `?today=YYYY-MM-DD` overrides it (for tests and demos).
- Styling: plain CSS, tokens from `ui.md` on `:root`. No component library.

## Revision 2 — adaptive import (template v2.1)

Agreed 2026-09-29. A file whose **layout** can't be read is still rejected with problems. A readable file with **unknown words** in the Status, Quarter or Due columns is not rejected: the server answers `needs_mapping`, the page asks the user what each word means, and the answer is saved and applied to every later import.

### Architecture (revision 2)

```
ImportButton ─▶ uploadPlan(file, mapping?) ─▶ POST /api/plan  (multipart: file, mapping?)
                                                  │
                        readGrid → { grid, dropdowns }      (dropdowns: data-validation lists)
                                                  │
                  MappingStore.load()  ∪  submitted mapping   (data/mappings.json)
                                                  │
                     parseAxcWorkbook / parseFlatCsv(grid, { mappings, dropdowns })
                   ├─ problems (layout / non-mappable)  → 400 invalid_plan
                   ├─ needsMapping (unknown words)      → 422 needs_mapping  → ImportMappingDialog
                   │                                                  └─ re-POST same file + mapping
                   └─ ok → PlanStore.save + MappingStore.merge(submitted, version seen)
                         → 200 { plan, warnings, applied }  → ImportNotes
```

### Model changes (`src/shared/model.ts`)

The existing `Status` type stays the **tone** (5 values), so ranking, progress and colors keep working on tones. Each status also keeps the **file's word**:

```ts
interface Action { …; status: Status; statusWord: string; quarter: Quarter | 'ongoing' | 'next_year'; due: Due }
interface Target { …; status: Status; statusWord: string }
type Due = … | { kind: 'next_year' };
type MappingField = 'status' | 'quarter' | 'due';
type QuarterMeaning = Quarter | 'ongoing' | 'next_year';
type DueMeaning = 'next_year' | 'quarter_end';
interface Mappings {                         // data/mappings.json and the submitted `mapping` field
  status: Record<string, Status>;            // key = normalized word ("in progress")
  quarter: Record<string, QuarterMeaning>;   // "fy27-28" → "next_year"
  due: Record<string, DueMeaning>;           // "tbd" → "quarter_end"
  seenVersions?: string[];                   // server-only: template versions already warned about
}
interface UnknownValue {
  field: MappingField; word: string; count: number;
  where: { sheet?: string; row: number }[];  // first 10 locations
  fromDropdown: boolean;                     // word seen only in the file's dropdown list
  suggestion: Status | QuarterMeaning | DueMeaning;
}
interface AppliedMapping { field: MappingField; word: string; meaning: string }
type ParseResult =
  | { ok: true; plan: Plan; warnings: Problem[]; applied: AppliedMapping[] }
  | { ok: false; problems: Problem[] }
  | { ok: false; needsMapping: UnknownValue[] };
```
- Empty status cell → word `""`, shown as "Not started".
- A word is **known** when it is built in (the 5 status labels, `Q1`–`Q4`, `ongoing`, a month due, `monthly`, `quarterly`) or present in the mappings. Words are compared normalized: trimmed, whitespace collapsed, lower-case.

### Parsing changes

- `parseAxcWorkbook(grid, fileName, importedAt, { mappings, dropdowns })` and `parseFlatCsv(…, { mappings })`.
- Order of checks: (1) layout problems → `{ problems }`. (2) Unknown words, collected over **all** rows plus the file's dropdown lists → `{ needsMapping }`. (3) Non-mappable value problems (action # not a number, month due outside the fiscal year) → `{ problems }`. (4) Otherwise `ok`.
- Quarter meaning `next_year` → the action's `quarter = 'next_year'` and `due = { kind: 'next_year' }`, whatever its due cell says. Due words on such rows are never asked.
- Due meaning `quarter_end` → month due = last month of the action's quarter (e.g. Q3 → May). Due meaning `next_year` → the action becomes next-year.
- `applied` lists every saved or submitted mapping actually used by this file.
- **Suggestions** (`src/shared/suggest.ts`): status — `done|complete|completed|finished` → done; `in progress|on track|started|wip|ongoing` → on_track; `at risk|risk|delayed|slipping` → at_risk; `behind|blocked|overdue|late|stuck|on hold` → behind; anything else → not_started. Quarter — `FYyy-yy`, `next year`, `later`, `deferred` → next_year; `Q 1`-style → that quarter; else next_year. Due — `next year|later` → next_year; else quarter_end.

### Dropdown lists (`src/server/read-grid.ts`)

- `readGrid` returns `{ grid, dropdowns }` where `dropdowns[sheet] = { ref: string; values: string[] }[]`.
- Read with SheetJS `bookFiles: true`. Map each sheet name to its XML path through `xl/workbook.xml` (sheet `r:id`) and `xl/_rels/workbook.xml.rels` (target). **`wb.Directory.sheets` is not in sheet order** — checked on the v2.1 file, where its second entry holds T3's lists.
- From the sheet XML take `<dataValidation type="list" sqref="…">` with an inline `<formula1>"a,b,c"</formula1>` (XML entities decoded). A range-reference formula (e.g. `=Lists!A1:A5`) is skipped.
- A list is a status list when its `sqref` covers the target status cell (row 2) or the action table's Status column. Its values that are not known become unknown `status` words with `count: 0`, `fromDropdown: true`.

### Mapping store (`src/server/mapping-store.ts`)

- `MappingStore(dataDir)`: `load(): Mappings` (missing file → empty), `merge(partial, version?)` writes `data/mappings.json` atomically (temp + rename, like `PlanStore`) and adds `version` to `seenVersions`. Writes are serialized.

### API changes

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/plan` | multipart `file` + optional `mapping` (JSON string, `Mappings` without `seenVersions`) | `200 { plan, warnings, applied }` · `400 { error: 'invalid_plan', problems }` · `400 { error: 'invalid_mapping' }` (unparseable or unknown meaning) · `422 { error: 'needs_mapping', unknown: UnknownValue[] }` · `413` · `415` |

- The mapping is saved **only** when the import succeeds. A 422 saves nothing.
- The version warning is added only when the version is newer than tested **and** not in `seenVersions`; a successful import then records the version.

### Derived data changes

- `fiscal.ts`: `hasNextYear(plan)`, `nextFiscalLabel(plan)` → `FY27-28`; `placeMonth` returns 12 and `placeQuarter` returns 4 for next-year actions; `monthColumns` / `quarterColumns` take `{ nextYear: boolean }` and append a `Next year` column.
- `progress.ts`: `{ done, total, nextYear }` counts **this year only**; next-year actions are counted in `nextYear`.
- `next-actions.ts`: next-year actions are never candidates. Sort key: (overdue **or** tone `behind`) first, then next date, weight, target order, action no.

### Client changes

- `api.ts` `uploadPlan(file, mapping?)` → `{ ok: true, plan, warnings, applied } | { ok: false, problems } | { ok: false, needsMapping }`.
- `ImportMappingDialog` (new), `ImportNotes` (new), grouped `StatusLegend`, `StatusDot` / `StatusLabel` / `StatusBadge` show the word, Next-year column in `TimelineGrid`, Next-year block in `ActionPlan`, progress line in `TargetHeader`. Token `--next: #f3f4f8` added to `styles.css`.

### Rejected (revision 2)

- **Hardcoding the v2.1 words**: breaks again on the next template change.
- **Silent auto-mapping without asking**: a wrong guess would go unnoticed; the user chose to confirm once.
- **AI/LLM mapping**: not testable deterministically and sends plan data outside the company.
- **Keeping the upload on the server between the 422 and the retry**: the browser still has the file; re-sending it avoids pending-upload storage and cleanup.
- **A screen to edit saved mappings**: out of scope; edit `data/mappings.json`.

## Rejected approaches

- **Browser-only SPA with IndexedDB**: every viewer would have to import the file themselves; the user wants one shared plan.
- **Google Sheet URL (OAuth / service account / daily sync)**: dropped from v1 by the user; the grid → adapter split leaves room to add it later without touching the parser.
- **Fixed-row parsing**: T4's table starts two rows earlier than the others; the template is a draft and will change.

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|---|---|---|
| Next-actions ranking floods with one target (T1 has the highest weight) | Keep the pure ranking in this design (weight, then order) | — (change the rule later in a new change) |
| Test fixture | Copy the real workbook to `tests/fixtures/axc-fy2026-27.xlsx` | If it's unavailable, build a synthetic workbook with the same layout in `tests/fixtures/build-fixture.ts` |
| Due month outside the fiscal year | Problem → import rejected | — |
| Unknown status / quarter / due word *(revision 2 — replaces "unknown status → reject")* | Ask through the mapping dialog (422 `needs_mapping`) | — |
| Same word appears as target status and action status | One status mapping per word, shared by both | — |
| Word already mapped but the user submits a different meaning | Submitted mapping wins and overwrites the saved one | — |
| Dropdown list is a range reference or can't be read | Skip it silently; rows are still checked | — |
| Unmapped words only in a dropdown list, none in rows *(decided 2026-09-29 during build)* | Import proceeds without the dialog; the words are listed only when the dialog opens for a row word | — |
| Next fiscal-year label | `FY` + last two digits of start year + 1 and + 2 (`FY27-28`) | — |
| Next-year column when a plan has no next-year actions | Hidden (grid ends at Aug / Q4) | — |
| Import notes after page reload | Not shown again (notes come from the import response only) | — |
| Mapping keys | Normalized: trimmed, whitespace collapsed, lower-case | — |
| Test fixture for v2.1 | Copy `…FY2026-2027 (1).xlsx` to `tests/fixtures/axc-fy2026-27-v2.1.xlsx` | Build a mutated copy of the v2.0 fixture in the test |
| Empty deliverable | Use the action text as the topic label | — |
| Topic label length in cells | Full deliverable text, CSS wraps it | — |
| Target id not found on `/target/:id` | "Target not found" state per `ui.md` | — |
| No plan imported yet | Empty state per `ui.md` (`404 no_plan`) | — |
| Two uploads at once | Serialize; the second waits and wins | — |
| Error message wording | Short, sheet + row + what is wrong (see `ui.md` examples) | — |
| Port / hosting details on the internal server | `PORT` env var, default 3000; run with `npm start` | Reverse proxy is the ops team's choice, out of scope |
| Where CSS lives | One `src/client/styles.css` with `:root` tokens | — |

### Blast Radius

Greenfield — everything is new.
- `package.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore` (new) — safe/reversible
- `src/shared/*` (model, fiscal, parse-axc, parse-csv, next-actions) (new) — safe/reversible
- `src/server/*` (index, read-grid, plan-store, routes) (new) — safe/reversible
- `src/client/*` (pages, components, styles) (new) — safe/reversible
- `data/` runtime files (created at run time, git-ignored) — safe/reversible (the previous plan is kept)
- *(revision 2)* `src/shared/model.ts` (Status stays the tone; adds `statusWord`, `next_year`, mapping types) — safe/reversible, touches every consumer of `Action` / `Target`
- *(revision 2)* `src/shared/{suggest,parse-axc,parse-csv,fiscal,progress,next-actions}.ts` — safe/reversible
- *(revision 2)* `src/server/{read-grid,mapping-store,app}.ts`, `data/mappings.json` (new runtime file) — safe/reversible; a wrong mapping is fixed by editing the JSON and re-importing
- *(revision 2)* `src/client/{api.ts,pages/timeline-page.tsx,components/*}` and all UI tests — safe/reversible
- *(revision 2)* `tests/fixtures/axc-fy2026-27-v2.1.xlsx` (new) — safe/reversible
- `tests/fixtures/axc-fy2026-27.xlsx` (new, internal plan data) — safe/reversible

No database. No destructive operations. No auth by design (internal network) — accepted by the user.
