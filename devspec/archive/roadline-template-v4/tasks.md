# Tasks: roadline-template-v4

General notes:
- There's no component library. Reuse the existing target-page and drawer components and the classes in `src/client/styles.css`. The NEW rules come from `mockups/objective.html` and `mockups/drawer.html`.
- Server and shared imports use `.js` extensions; client imports don't.
- **The 2.x fixture tests must stay green unchanged**: they are the regression net for every parser change.
- Tests never touch a DB (`improve/decisions.md`).

## 1. Fixture and shared values [req-2, req-4]
- [x] 1.1 [test] Copy `C:\Users\hung.lay\Downloads\[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027 (3).xlsx` to `tests/fixtures/axc-fy2026-27-v4.2.xlsx`. In `tests/helpers.ts`, add `FIXTURE_V42`, `V42_MAPPINGS` (design.md Decision Defaults) and `fixturePlanV42()`.
- [x] 1.2 [service] `src/shared/values.ts`:
  - `parsePercent(cell): number | null | 'invalid'` (rules in design.md).
  - `parseStartMonth(cell): { startYear; startMonth } | null` (Excel serial, `Date`, "Oct 2026", "2026-10-01").
  - `versionText` returns the leading `x.y` of text like "4.2 (01/10/2026)".
- [x] 1.3 [test] `tests/values.test.ts` (new):
  - percent forms 0.4 / 40 / "40%" / blank / 150
  - start-month forms
  - `versionText('4.2 (01/10/2026)') === '4.2'`, while `'2.0'` and number `2` keep today's results
Verify: `npx vitest run tests/values.test.ts`

## 2. Model and parser: layout, fiscal, weight [req-1, req-2, req-3]
- [x] 2.1 [service] `src/shared/model.ts`: add the optional fields from design.md:
  - `Detail`
  - `Action.detailId/partners/percent/references/note`
  - `Target.weightSource/details`
  - `Plan.layout/progressBy`
- [x] 2.2 [service] `src/shared/parse-axc.ts`:
  - `TARGET_TITLE` → `/^([TO]\d+)\s*[-–—]\s*(.+)$/`.
  - Set `layout`; mixed ids → layout problem.
  - `parseSummary` falls back to the "Start month (M1)" label via `parseStartMonth`.
  - The fiscal-not-found message names both forms.
  - `TESTED_TEMPLATE_VERSION` becomes a tested list `['2.0','2.1','4.2']`, used by the newer-than-tested warning.
- [x] 2.3 [service] Same file, weight:
  - No `Weight` label on any sheet → `weight = 1/n`, `weightSource: 'equal'`.
  - Labels on some sheets but not others → values problem "weight not found" on the missing ones.
  - A present but invalid weight → today's problem.
- [x] 2.4 [test] `tests/parse-axc-v42.test.ts` (new):
  - 4.2 with `V42_MAPPINGS` → layout `objectives`, ids O1…O6 + names, action counts 7/21/15/14/12/15 (84), version `4.2`, no version warning, fiscal `{2026, 10}`, weights 1/6 `equal`
  - mixed T/O sheets (synthetic grid) → problem
  - summary with neither period nor start month → problem
  - The existing `tests/parse-axc.test.ts` and `tests/parse-axc-v21.test.ts` still pass unchanged
Verify: `npx vitest run tests/values.test.ts tests/parse-axc.test.ts tests/parse-axc-v21.test.ts tests/parse-axc-v42.test.ts`

## 3. Parser: columns, details, due words [req-4, req-5, req-6]
- [x] 3.1 [service] `src/shared/parse-axc.ts` `ACTION_COLUMNS`:
  - Add `partners`, `percent`, `reference`, `note` aliases (design.md).
  - Remove `deliverable` from `REQUIRED_COLUMNS` (fallback: the action text).
  - Read the new fields per action. `references` are split on `;` and newlines. An invalid % → values problem "% must be 0–100".
  - `progressBy = 'percent'` when the header has a `%` column.
- [x] 3.2 [service] Same file, row kinds: a detail row (design.md rule) creates a `Detail`.
  - Parse the goal / needsFirst / jd lines from the first non-empty cell right of the action column.
  - Following actions get `detailId` and `section = "<id> · <title>"` until the next detail or "A. …" section.
  - Details are stored on `Target.details`.
- [x] 3.3 [service] Due words: no code change expected (`WordResolver.due` already asks for unknown words). Make sure detail rows never reach the quarter or due resolver.
- [x] 3.4 [test] `tests/parse-axc-v42.test.ts`:
  - O1 action 2 columns (partners, 3 references, note prefix, percent null, deliverable = action, measure null)
  - O1 details 1.1/1.2 with goal / needsFirst / jd and the action→detail links
  - 18 details in total
  - no mappings → `needsMapping` with the five due words + "In progress"
  - a synthetic grid with `%` values 0.4 / 40 / "40%" / 150 → 40 ×3 and the 150 problem
Verify: `npx vitest run tests/parse-axc-v42.test.ts tests/parse-axc.test.ts tests/parse-axc-v21.test.ts`

## 4. Progress, summary and wording helper [req-7, req-10]
- [x] 4.1 [service] `src/shared/progress.ts`:
  - `progress(target, plan?)` adds `percent` (average of this-year `percent ?? 0`) when `plan.progressBy === 'percent'`.
  - New `detailProgress(target, detailId)`.
- [x] 4.2 [service] `src/shared/summary.ts:planSummary`: in percent mode, `yearProgress = Σ weight·(percent/100) / Σ weight`. Done mode is unchanged.
- [x] 4.3 [service] New `src/shared/noun.ts:nounFor(plan)` → `{ one, many, One, Many }`: objective/objectives for `layout === 'objectives'`, else target/targets.
- [x] 4.4 [test] `tests/progress.test.ts` (new):
  - O1 with percents [40, blank×6] → 40/7; detail 1.1 → 13.3
  - year progress = average over objectives
  - `tests/summary.test.ts` 2.x cases unchanged
  - `nounFor` both ways
Verify: `npx vitest run tests/progress.test.ts tests/summary.test.ts`

## 5. Objective page [req-8, req-10]
- [x] 5.1 [frontend] New `src/client/components/percent.tsx:Percent({ value, width })`: `.pct` bar + "40%", or "—" for null.
- [x] 5.2 [frontend] `src/client/components/target-header.tsx:TargetHeader`:
  - `aria-label` and "Next for this …" use `nounFor(plan).One/one`.
  - Weight fact adds muted "equal · 1 of n" when `weightSource === 'equal'`.
  - In percent mode, the Progress fact shows the average % ("6% avg of 7") with `.pbar` plus a muted "d / t done" line.
- [x] 5.3 [frontend] New `src/client/components/objective-details.tsx:ObjectiveDetails({ target })`:
  - `section.card.details` with `aria-label="Objective details"`, one `.detail` per detail (id, title, Goal / Needs first / JD, detail average % + action count).
  - Renders nothing without details.
  - Render it in `src/client/pages/target-page.tsx` between the header card and the action plan.
- [x] 5.4 [frontend] `src/client/components/action-plan.tsx:ActionTable`:
  - Column set per design.md: Partners column if any action has partners, else Success measure; `%` column (via `Percent`) in percent mode.
  - `.dchip` with `detailId` before the action text.
  - `.ref` "📎 first two · +n" and `.note` (2-line clamp) under the text.
  - `ActionPlan` passes `plan` for the switch.
  - `src/client/pages/target-page.tsx` and `components/target-sections.tsx`: "… not found" and `aria-label` text via `nounFor`.
- [x] 5.5 [frontend] `src/client/styles.css`: the NEW rules from `mockups/objective.html` (`.details`, `.detail*`, `.pct*`, `.dchip`, `.ap table td .note`, `.ap table td .ref`).
- [x] 5.6 [test] `tests/target-page.test.tsx`:
  - 4.2 `/target/O1`: region "Objective", "Next for this objective", "equal · 1 of 6", "Objective details" region with 1.1 and 1.2, Q1 headers `# Action Partners Owner Due % Status`, the "1.1" chip, the 📎 line and the note on action 2
  - 2.x `/target/T1` unchanged: "Target", Success measure header, no % header, no Objective details region
Verify: `npx vitest run tests/target-page.test.tsx`

## 6. Action drawer and wording [req-9, req-10]
- [x] 6.1 [frontend] `src/client/components/action-drawer.tsx:ActionDrawer`:
  - Facts: Partners (when set), Progress (`Percent` 80px, or "— (counts as 0%)" in percent mode), and "Detail" instead of "Section" when `detailId` is set. Weight gets the "· equal" suffix.
  - Sections in the `ui.md` order: Objective detail (Goal / Needs first / JD), Deliverable, Success measure, Reference documents (`ul.drawer-refs`), Note (`p.drawer-note`), Next.
  - Empty sections are left out.
  - Button text "Open {noun} {id}".
- [x] 6.2 [frontend] Wording sweep: every remaining user-visible "target" string in `src/client` goes through `nounFor(plan)` (timeline, summary, next actions, drawer). Ids, prop names and code identifiers stay as they are.
- [x] 6.3 [frontend] `src/client/styles.css`: `.drawer-refs`, `.drawer-note`, the drawer `.pct` from `mockups/drawer.html`.
- [x] 6.4 [test] `tests/timeline-page.test.tsx` (drawer cases):
  - 4.2 O1-2 → Partners, Detail "1.1 · …", Reference documents (3), the full Note, "Open objective O1"
  - O1-5 → no references or note, "— (counts as 0%)"
  - 2.x drawer unchanged ("Open target T1", Deliverable, Success measure)
  - 4.2 timeline copy contains no "target"
Verify: `npx vitest run tests/timeline-page.test.tsx tests/target-page.test.tsx`

## 7. Docs and context pack [req-1]
- [x] 7.1 [backend] `README.md` "Import formats": add an "AXC workbook 4.2" subsection covering:
  - objective sheets, Start month, no weight → equal, the columns, objective details
  - progress = average %
  - the due words to map once
  - "both templates are supported"
- [x] 7.2 [backend] `devspec/context/summary.md` and `rules.md`:
  - two layouts (targets / objectives) detected per file, 2.x fixtures as the regression net
  - percent progress mode
  - the fiscal year can start in any month (4.2: October)
  - the Sep → Aug gotcha is now "per file"
- [x] 7.3 [test] Full check
Verify: `npm run lint && npm test && npm run build`

## 8. Browser verify [req-8, req-9]
- [x] 8.1 [test] Run a throwaway file-storage instance (`DATABASE_URL= DATA_DIR=<tmp> ADMIN_EMAILS=admin@example.com`) and sign up the admin.
  - Import the 4.2 fixture through the UI, answering the mapping dialog once (five due words + In progress).
  - Open `/target/O1` and the O1-2 / O1-5 drawers, and compare computed styles against `mockups/objective.html` and `mockups/drawer.html`.
  - Re-import the same file: no dialog.
  - Import the v2.0 fixture: today's page.
  - Save screenshots to `verify/`.
Verify: `/devspec-verify roadline-template-v4`

## 9. Visual sign-off [req-8, req-9]
- [x] 9.1 MANUAL (BA approved in chat 2026-10-01): BA approves the screenshots in `verify/` (objective page, drawer A/B, mapping dialog, 2.x page unchanged).
Verify: MANUAL: BA approves the 4.2 screenshots against the mockups
