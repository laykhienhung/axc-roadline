# Roadline

A small internal web app that turns the AXC team's objectives & action-plan workbook into a shared, read-only view:

- **Timeline** — targets as rows, months (default) or quarters as columns across the fiscal year (Sep → Aug), with a **Next year** column for actions moved to the following year. Each cell lists the topics due then, with a status dot.
- **Next actions** — the top 5 open actions of this year: overdue and Behind/Blocked first, then by due date and target weight.
- **Target detail** (`/target/:id`) — weight, owner, status, this-year progress, objective, the next 3 actions, the action plan by quarter (+ Next year) and the target's notes (must achieve, how, depends on, risks, change history).
- **Import** — anyone with the link uploads `.xlsx` or `.csv`; the plan is replaced for everyone. A file whose layout can't be read is rejected with row-level problems and the current plan stays.
- **Adaptive import** — when a file uses new words (e.g. status "In progress", quarter "FY27-28"), a dialog asks once what each means, pre-filled with suggestions. The answer is saved and reused on every later import.

The workbook stays the source of truth; the web page never edits it. There is no login — it is meant for the internal network.

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000 and import a workbook (e.g. `tests/fixtures/axc-fy2026-27.xlsx`).

Add `?today=YYYY-MM-DD` to any URL to view the plan as of another date (handy for demos).

### Configuration

| Env var      | Default       | Meaning                                                                      |
| ------------ | ------------- | ---------------------------------------------------------------------------- |
| `PORT`       | `3000`        | HTTP port                                                                    |
| `DATA_DIR`   | `./data`      | Where the current plan, previous plan, uploads and value mappings are stored |
| `CLIENT_DIR` | `dist/client` | Built web page to serve                                                      |

## Import formats

### AXC workbook (`.xlsx`)

Template as used by `[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027.xlsx` (tested with template versions 2.0 and 2.1):

- `Executive Summary` sheet — fiscal period (e.g. "September 2026 - August 2027"), team, `Version`.
- One sheet per target whose cell **A1** reads `T1 - <name>`, `T2 - <name>`, … Row 2 holds `Weight`, `Owner`, `Status`.
- Numbered blocks found **by their label**: `OBJECTIVE`, `WHAT THIS MUST ACHIEVE`, `ACTION PLAN`, `HOW WE WILL DO IT`, `WHAT THIS DEPENDS ON`, `RISK & MITIGATION`, `CHANGE HISTORY`.
- Action table columns (found by header name): `#`, `Quarter`, `Action`, `Deliverable`, `Success measure`, `Owner`, `Due`, `Status`. Rows like `A. Automation workflows` start a section.

Built-in values: quarter `Q1`–`Q4` or `ongoing`; due `Nov 2026`, `monthly` or `quarterly`; status `Not started`, `On track`, `At risk`, `Behind`, `Done` (blank = Not started). Anything else goes through the mapping dialog.

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

| Method | Path        | Result                                                                                                                                                                                                      |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/plan` | `200` plan · `404 { error: "no_plan" }`                                                                                                                                                                     |
| POST   | `/api/plan` | multipart `file` (+ optional `mapping` JSON) → `200 { plan, warnings, applied }` · `400 invalid_plan` / `invalid_mapping` · `422 needs_mapping { unknown }` · `413 file_too_large` · `415 unsupported_type` |

## Notes

- Uploads are limited to 5 MB and `.xlsx` / `.csv`. SheetJS is installed from cdn.sheetjs.com (0.20.3) — the npm 0.18.x release has a known flaw when reading crafted files.
- `tests/fixtures/` contains real internal plan data; keep this repository internal.
