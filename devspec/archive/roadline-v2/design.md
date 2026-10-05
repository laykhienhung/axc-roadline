# Design: roadline-v2

A client-only redesign. The server, API, parsers, stores and mappings do not change. Two new pure functions in `src/shared/` feed the new summary and Next-actions views (pattern "derived data", `devspec/context/patterns.md`).

## Architecture

```
GET /api/plan ──► usePlan() ──► App ──► TimelinePage
                                          ├─ AppHeader (logo, meta, Month|Quarter, ImportButton)
                                          ├─ SummaryTiles ◄── planSummary(plan, today)        [new, shared/summary.ts]
                                          ├─ NextActions  ◄── openNow(plan, today)            [new, shared/next-actions.ts]
                                          │     ├─ NextBoard  (columns by tone)
                                          │     └─ NextTasks  (groups by when due)
                                          └─ TimelineGrid ◄── placeMonth/placeQuarter/currentPeriod (unchanged)
                                                ├─ StatusBar + chips per cell                  [new, components/status-bar.tsx]
                                                └─ All-year strip per target
                                    ──► TargetPage
                                          ├─ TargetHeader (+ fact tiles, Next for this target ◄── nextActions limit 3)
                                          ├─ QuarterTiles                                      [new, components/quarter-tiles.tsx]
                                          ├─ ActionPlan (groups Q1..Q4, ongoing, next_year)
                                          └─ TargetSections (always-open cards)
styles.css: new :root tokens + restyled classes (system fonts only)
```

## Decisions

- **One `openNow` built on `nextActions`.** `openNow(plan, today)` calls `nextActions(plan, today, { limit: Infinity })` (same exclusions: done and next-year) and assigns each item a `when`:
  - `overdue` — `item.overdue` is true (next due date before today);
  - `allYear` — else the action is recurring (`due.kind === 'recurring'`, i.e. quarter `ongoing`);
  - `thisQuarter` — else `action.quarter === currentPeriod(plan, today)?.quarter`;
  - otherwise the item is left out (a later quarter).
  It returns `{ items: OpenItem[], counts: { open, overdue, thisQuarter, allYear } }` where `OpenItem = NextAction & { when }`. Views sort for themselves (below). Reusing the ranking keeps one definition of "overdue" and "next due".
- **Board order** (per tone column): `when` overdue → thisQuarter → allYear, then target weight (high first), then target order, then action number. **Tasks order** (per `when` group): tone Behind → At risk → On track → Not started, then the same tie-breaks. Board columns are the four open tones in the order Behind, At risk, On track, Not started (done never appears).
- **`planSummary(plan, today)`** in new `src/shared/summary.ts` returns `{ yearProgress, done, total, openThisQuarter, overdue, attention }`:
  - `yearProgress` = Σ(weight × done/total) / Σ(weight) over targets with `total > 0`, using `progress(target)` (this year only). 0 when no weight.
  - `done`, `total` = sums of `progress()`.
  - `openThisQuarter` = open, non-next-year actions whose quarter is the current one; `null` when `currentPeriod` is null.
  - `overdue` = `openNow(...).counts.overdue`.
  - `attention` = targets whose tone is `at_risk` or `behind`, in plan order.
- **Status words.** Every data status is rendered through `StatusDot` / `StatusLabel` / `StatusBadge` with the file's word (`conventions.md`, Status display). Board column headers and the legend are tone labels (`STATUS_LABEL`), which is the legend exception v1 already uses.
- **Board/Tasks state** is local `useState('board')` in `NextActions`; not in the URL, not in storage (user decision).
- **Timeline widths** are computed in `TimelineGrid` and set as an inline `grid-template-columns`: target `260px`; month view: a month with ≥1 topic in any target → `minmax(220px, 1fr)`, empty month → `60px`, the current month when empty → `88px`; Next-year column → `minmax(220px, 1fr)`; quarter view: `repeat(N, minmax(220px, 1fr))`. The grid card gets `overflow-x: auto`; the target column is `position: sticky; left: 0`. This replaces the 80 px minimum that forced ≥1440 px (`rules.md` gotcha) — narrower screens scroll instead of clipping.
- **Cells keep their hooks.** Cells stay `Link`s with `data-target` / `data-col`; topics stay `li` with `.dot.bg-<tone>`; the count text stays "N topics" (a separate "· N done" span is added only when N > 0) so existing queries keep working.
- **Fonts**: system stacks only (see `ui.md`); no `<link>` to any font service, no font files.
- **No new dependencies, no component library** (`conventions.md` UI). New components are small files in `src/client/components/`.

### Rejected

- A Board/Tasks preference in `localStorage` or `?next=` — user said no.
- Web fonts (Google Fonts or `@fontsource`) — user chose system fonts; the app runs on an internal network.
- A fixed 1920 px layout like the canvas — the page must stay fluid; horizontal scroll inside the timeline card instead.
- Keeping the top-5 list — replaced by the Board/Tasks views (the `limit` option of `nextActions` stays for the target page).

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|---|---|---|
| Where `openNow` lives | `src/shared/next-actions.ts`, next to `nextActions` | a sibling `src/shared/open-now.ts` |
| Where `planSummary` lives | new `src/shared/summary.ts` | `src/shared/progress.ts` |
| Today outside the fiscal year | "Open this quarter" shows "—"; `thisQuarter` group empty; overdue/all-year still shown | — |
| No open items in the window | Board and Tasks both show "Nothing open right now — every action due so far is done." | — |
| Target with `status` At risk/Behind but no word | pill shows the tone label via `statusText()` | — |
| Due text on cards/rows | overdue → "Overdue · Nov"; month due → "Due Feb"; recurring → "↻ monthly" / "↻ quarterly" (via `src/client/format.ts`, add helpers there) | reuse `dueText` |
| Headline count line in Next actions | "N open · N overdue · N due by end of <last month of current quarter> · N all year", plus " · N moved to next year" when > 0 | drop the "due by" part when no current quarter |
| Column/scroll height | Board columns and the Tasks box are 460 px tall with `overflow-y: auto` | 420 px if it looks cramped at 1080p |
| Deliverable vs action text on cards | card/row headline = `deliverable`; target page table shows action + "→ deliverable" (as v1) | action text when deliverable is blank |
| Depends-on chip | leading `T<n>` or a word before " - " (e.g. `HR`) becomes the chip; the rest is the text | no chip, whole text |
| Old classes no longer used (`.next`, `.badges`, `details` styles) | remove them from `styles.css` | leave if another component still uses them |
| Aria-labels | keep every existing one (`Timeline`, `Next actions`, `Status legend`, `Target`, `Next for this target`, `Action plan`, `Target details`, `No plan loaded`, `Importing`, `Import failed`, `Map new values`, `Import notes`); add `Summary`, `Quarters`, `Next actions view` | — |
| Test fixture date | UI tests keep `today = 28 Sep 2026` (fixture all Not started); new shared tests also use 10 Dec 2026 on a copy with statuses set in the test | — |

### Blast Radius

- `src/client/styles.css` (tokens + most classes rewritten) — safe/reversible
- `src/client/components/app-header.tsx`, `import-button.tsx` — safe/reversible
- `src/client/components/next-actions.tsx` (rewritten: Board/Tasks) — safe/reversible
- `src/client/components/timeline-grid.tsx`, `status-legend.tsx` — safe/reversible
- `src/client/components/status-bar.tsx`, `summary-tiles.tsx`, `quarter-tiles.tsx` (new) — safe/reversible
- `src/client/components/target-header.tsx`, `action-plan.tsx`, `target-sections.tsx` — safe/reversible
- `src/client/components/import-states.tsx`, `import-mapping-dialog.tsx`, `import-notes.tsx` — safe/reversible
- `src/client/pages/timeline-page.tsx`, `target-page.tsx` — safe/reversible
- `src/client/format.ts` (due-text helpers) — safe/reversible
- `src/shared/next-actions.ts` (add `openNow`), `src/shared/summary.ts` (new) — safe/reversible
- `tests/next-actions.test.ts`, `tests/summary.test.ts` (new), `tests/timeline-page.test.tsx`, `tests/target-page.test.tsx`, `tests/import.test.tsx` (assertions on the old layout rewritten) — safe/reversible
- No server, API, parser, storage or data-file changes.

Risk: none irreversible. The main review focus is the rewritten UI tests — they must still assert behaviour (counts, links, states), not just markup.
