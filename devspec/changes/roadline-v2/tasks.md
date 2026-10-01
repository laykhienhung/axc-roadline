# Tasks: roadline-v2

No component library exists — reuse the project's own components in `src/client/components/` and the classes in `src/client/styles.css`; new pieces are small plain components. Tokens, layouts and states come from `ui.md` and `mockups/*.html`.

## 1. Tokens and base styles [req-1]
- [x] 1.1 [frontend] `src/client/styles.css`: replace the `:root` block with the `ui.md` tokens (`--bg`, `--surface`, `--surface-2`, `--line`, `--line-soft`, `--text`, `--text-2`, `--muted`, `--ink`, `--link`, `--now`, `--now-line`, `--now-text`, `--chip`, `--r`, `--r-lg`) and per-tone `--s-<tone>` (dot), `--s-<tone>-fg`, `--s-<tone>-bg`
- [x] 1.2 [frontend] Same file: system font stacks — `--font-body`, `--font-display` (serif), `--font-mono`; `h1`/`h2` use `--font-display`; ids and counts use `--font-mono`
- [x] 1.3 [frontend] Same file: restyle shared classes `.card` (radius `--r-lg`), `.btn` / `.btn.primary` (ink fill, 40–44 px tall), `.seg` (track `--chip`, white "on" pill), `.dot` + `.bg-<tone>`, `.fg-<tone>`, `.badge` (pill `--s-<tone>-bg` / `-fg`), new `.chip` (target id); page `main` padding 28px 32px, no max-width on the timeline
- [x] 1.4 [test] `tests/styles.test.ts` (node): read `src/client/styles.css` and `src/client/index.html` — no `fonts.googleapis.com`, `@import url(`, `@font-face`; `:root` defines `--bg: #f4f2ec` (case-insensitive)
Verify: `npx vitest run tests/styles.test.ts`

## 2. Shared derived data [req-3, req-4]
- [x] 2.1 [service] `src/shared/next-actions.ts`: add `type When = 'overdue' | 'thisQuarter' | 'allYear'`, `OpenItem = NextAction & { when: When }`, and `openNow(plan, today): { items: OpenItem[]; counts: { open; overdue; thisQuarter; allYear; nextYear } }` built on `nextActions(plan, today, { limit: Infinity })` with the `when` rules in design.md; `nextYear` = count of open next-year actions
- [x] 2.2 [service] Same file: `boardColumns(items)` → `[{ status, items }]` for behind, at_risk, on_track, not_started (Board order), and `taskGroups(items)` → `[{ when, items }]` for overdue, thisQuarter, allYear (Tasks order), tie-breaks per design.md
- [x] 2.3 [service] New `src/shared/summary.ts`: `planSummary(plan, today)` → `{ yearProgress, done, total, openThisQuarter: number | null, overdue, attention: Target[] }` per design.md, using `progress()` (`src/shared/progress.ts`) and `currentPeriod()` (`src/shared/fiscal.ts`); `.js` import extensions (NodeNext)
- [x] 2.4 [test] `tests/next-actions.test.ts`: add `openNow` cases — fixture on 28 Sep 2026 (window = Q1 open + recurring, 0 overdue); Dec plan (statuses set in the test, today 10 Dec 2026) → 29 items, counts 6 / 19 / 4, board column sizes 3 / 4 / 11 / 11, first overdue task is Behind; v2.1 fixture → `nextYear` 14 and no next-year item
- [x] 2.5 [test] New `tests/summary.test.ts`: fixture 28 Sep 2026 → yearProgress 0, total 75, openThisQuarter 21, overdue 0, attention []; Dec plan → round(yearProgress×100) = 19, done 15, openThisQuarter 19, overdue 6, attention ids [T1, T3]; 1 Oct 2027 → openThisQuarter null
Verify: `npx vitest run tests/next-actions.test.ts tests/summary.test.ts`

## 3. App header [req-2]
- [x] 3.1 [frontend] `src/client/components/app-header.tsx:AppHeader`: inline-SVG logo mark + "Roadline" wordmark, divider, title + meta line (reuse `fiscalRange`, `formatDateTime` from `src/client/format.ts`), `.seg` Month/Quarter (keep `aria-pressed`, `role="group"`)
- [x] 3.2 [frontend] `src/client/components/import-button.tsx:ImportButton`: default label "Import workbook" with an upload icon; keep `data-testid="import-input"`
- [x] 3.3 [frontend] `src/client/pages/target-page.tsx`: replace `page-h` with the same header bar showing a breadcrumb — `Link` "Timeline" to `/${suffix}` (`useLinkSuffix`), then "<id> · <name>", plan meta on the right
- [x] 3.4 [test] `tests/timeline-page.test.tsx`: header shows `Month` pressed and an "Import workbook" button; `tests/target-page.test.tsx`: breadcrumb link "Timeline" href `/?today=2026-09-28`
Verify: `npx vitest run tests/timeline-page.test.tsx tests/target-page.test.tsx`

## 4. Summary tiles [req-3]
- [x] 4.1 [frontend] New `src/client/components/summary-tiles.tsx:SummaryTiles({ plan, today })` — `<section aria-label="Summary">` with 4 `.card` tiles from `planSummary`: year progress (big % + bar + "Weighted by target · D of N actions done"), open this quarter (now-tinted, "Q2 · Dec – Feb", "—" when null), overdue (red number when > 0), targets needing attention (count + one `StatusBadge` per target with "<id> <word>")
- [x] 4.2 [frontend] `src/client/pages/timeline-page.tsx:TimelinePage`: render `SummaryTiles` above Next actions when a plan is loaded
- [x] 4.3 [test] `tests/timeline-page.test.tsx`: `Summary` on the fixture shows "0%", "0 of 75 actions done", 21, 0; with `?today=2027-10-01` (outside the fiscal year) the open tile shows "—"
Verify: `npx vitest run tests/timeline-page.test.tsx`

## 5. Next actions Board and Tasks [req-4, req-5]
- [x] 5.1 [frontend] `src/client/format.ts`: add `dueShort(item: OpenItem)` → "Overdue · Nov" / "Due Feb" / "↻ monthly" per design.md
- [x] 5.2 [frontend] Rewrite `src/client/components/next-actions.tsx:NextActions({ plan, today })`: `openNow`; header with h2, hint, count line (+ " · N moved to next year" when > 0), `.seg` `role="group" aria-label="Next actions view"` Board/Tasks with `useState('board')`
- [x] 5.3 [frontend] Board: `boardColumns` → 4 columns (dot, tone label, count pill), 460 px bodies with `overflow-y: auto`; card = `Link` to `/target/:id${suffix}` with `.chip` id, `#no`, `dueShort`, deliverable, "owner · target name", and `StatusDot` with the file word as title
- [x] 5.4 [frontend] Tasks: `taskGroups` → one 460 px scroll box, sticky tinted group heads (label, count, sub text), rows as `Link` with status ring, `.chip`, deliverable + `#no`, target name, owner, `StatusBadge` (file word), `dueShort`
- [x] 5.5 [frontend] Empty window → "Nothing open right now — every action due so far is done." in both views
- [x] 5.6 [test] `tests/timeline-page.test.tsx`: replace the old top-5 assertions — Board pressed by default; on the fixture 4 columns, Not started count 25 (Q1 open + recurring), every card link starts with `/target/`; click Tasks → 3 group heads and rows; v2.1 fixture → count line contains "14 moved to next year"
Verify: `npx vitest run tests/timeline-page.test.tsx` and `/devspec-verify roadline-v2`

## 6. Timeline cells and layout [req-6, req-7, req-8]
- [x] 6.1 [frontend] New `src/client/components/status-bar.tsx:StatusBar({ actions })` — segments per tone (order done, on_track, at_risk, behind, not_started), width by count
- [x] 6.2 [frontend] `src/client/components/timeline-grid.tsx:TimelineGrid`: compute `grid-template-columns` per design.md (adaptive month widths, Next-year `minmax(220px, 1fr)`, quarter view `minmax(220px, 1fr)`) and set it inline; wrap in a scroll container with `overflow-x: auto`; target column `position: sticky; left: 0`
- [x] 6.3 [frontend] Same file: month-view quarter band row above the headers (each quarter spans its months, current one tinted "· this quarter"); header "NOW" pill on the current column
- [x] 6.4 [frontend] Same file: cell = `StatusBar`, "N topics" (+ separate "· N done" span when > 0), chips "N overdue" / "N at risk" (use `openNow`-consistent overdue: `nextDate < today`), every topic `li` with `StatusDot small` + full deliverable text + OVERDUE tag; remove the red/amber edge classes (`w-behind`, `w-at_risk`); keep `data-target` / `data-col` and cell `Link`s
- [x] 6.5 [frontend] Same file: target cell — `.chip` id + `StatusBadge` (file word), name, "W% weight · owner", progress bar + "D / N", "Open target →"; keep class `topic`
- [x] 6.6 [frontend] Same file: "All year" strip row under targets with `quarter === 'ongoing'` actions, spanning the period columns, one pill per action (dot, deliverable, "· monthly/quarterly")
- [x] 6.7 [frontend] Next-year column: dashed left border, `--surface-2` cells; `src/client/components/status-legend.tsx:StatusLegend` note → "Next year = not in this year's progress" (drop the "colored cell edge" note)
- [x] 6.8 [test] `tests/timeline-page.test.tsx`: keep "7 topics" / 7 `li` / `.dot.bg-not_started` assertions; add — no "more" text in any cell; month grid template has `minmax(220px, 1fr)` for Nov and `60px` for Oct; T3 row has an "All year" strip with "12 monthly reports", T1 has none; v2.1 → column 12 still lists next-year topics
Verify: `npx vitest run tests/timeline-page.test.tsx` and `/devspec-verify roadline-v2`

## 7. Target page [req-9, req-10]
- [x] 7.1 [frontend] `src/client/components/target-header.tsx:TargetHeader`: two-column card — left: `.chip` id + `StatusBadge`, `h1` name only, objective, 4 fact tiles (Weight, Owner, This year's progress with bar, Overdue red when > 0); right: "Next for this target" (`aria-label` kept) as 3 cards (`li`) from `nextActions(..., { limit: 3, targetId })` — move that list out of `target-page.tsx`
- [x] 7.2 [frontend] New `src/client/components/quarter-tiles.tsx:QuarterTiles({ plan, target, currentQuarter })` — `<nav aria-label="Quarters">` tiles Q1–Q4, "All year" (if any ongoing), "Next year" (if any); each `<a href="#q1">`… with `StatusBar` and "D of N done · N overdue"; current quarter "NOW"
- [x] 7.3 [frontend] `src/client/components/action-plan.tsx:ActionPlan`: group heads with `id` anchors (`q1`…`q4`, `ongoing`, `next_year`), keep `data-quarter`; table rows with muted done text, red "Overdue · Nov" due; drop the `StatusBadgeLegend` row
- [x] 7.4 [frontend] `src/client/components/target-sections.tsx:TargetSections`: always-open cards (no `<details>`) inside `aria-label="Target details"` — must achieve (numbered 01…), depends on (chip parsed per design.md), risks (tile with warning icon + mitigation), how, change history; empty texts as v1
- [x] 7.5 [frontend] `src/client/pages/target-page.tsx:TargetPage`: layout header → QuarterTiles → grid (ActionPlan | TargetSections 400 px); not-found card unchanged
- [x] 7.6 [test] `tests/target-page.test.tsx`: h1 is the name only; Next for this target has 3 `li`; `Quarters` has Q1–Q4 links with `#q1`…; Q1 of T1 has 7 rows; T2 ongoing 2 rows; v2.1 next_year 7 rows; `Target details` has no `details` element and shows the depends-on chips; not-found still links "Back to timeline"
Verify: `npx vitest run tests/target-page.test.tsx` and `/devspec-verify roadline-v2`

## 8. Import screens [req-11]
- [x] 8.1 [frontend] `src/client/components/import-states.tsx:EmptyState` — heading "No plan loaded yet", intro, dashed drop zone ("Drop the workbook here", ".xlsx workbook or flat .csv", `ImportButton` "Choose file…"), two format cards, note line; keep drag-over state and `aria-label="No plan loaded"`
- [x] 8.2 [frontend] Same file: `UploadingState` banner (file name, bar, "The current plan stays visible until this finishes."); `ImportError` red-tinted head + `ProblemList` as a Sheet / Row / Problem table + footer "Keep current plan" (dismiss) and "Choose another file"
- [x] 8.3 [frontend] `src/client/components/import-mapping-dialog.tsx:ImportMappingDialog`: new layout (heading with word count, one row per word: word, count + where, labelled `select` with "· suggested", preview); behaviour unchanged. `import-notes.tsx:ImportNotes`: restyle only
- [x] 8.4 [test] `tests/import.test.tsx`: empty state text "Drop the workbook here"; failed upload still shows problems and keeps the previous plan; 422 flow still re-sends with the mapping
Verify: `npx vitest run tests/import.test.tsx` and `/devspec-verify roadline-v2`

## 9. Regression gate [req-12]
- [x] 9.1 [frontend] Remove classes no longer used (`.next`, `.next-h`, `.badges`, `.badge-group`, `details`/`summary` styles, `.w-behind`, `.w-at_risk`) from `styles.css`
- [x] 9.2 [test] `tests/timeline-page.test.tsx`: with `?today=2026-12-10`, every Board card, timeline cell and target link keeps `?today=2026-12-10`
- [x] 9.3 [test] Run the full gate
Verify: `npm run lint && npm test && npm run build`

## 10. Visual sign-off [req-1, req-5, req-7, req-9, req-11]
- [x] 10.1 [test] `/devspec-verify roadline-v2` against `mockups/*.html`: regions present, styling not plain (tokens applied, serif headings), columns aligned, Board columns scroll, timeline scrolls horizontally at 1280 px; screenshots of `/`, `/?today=2026-12-10`, `/target/T3`, the empty and mapping states into `devspec/changes/roadline-v2/verify/`
- [ ] 10.2 MANUAL: BA approves the screenshots in `devspec/changes/roadline-v2/verify/`
Verify: MANUAL: BA approves the redesign screenshots against the mockups
