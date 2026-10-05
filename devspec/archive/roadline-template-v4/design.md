# Design: roadline-template-v4

## Approach

`parseAxcWorkbook` keeps its one pipeline (`patterns.md` "file → plan": blocks and headers found **by label**, results are a union, and the check order is layout → unknown words → unmappable values). It learns the 4.2 variants in place; there is no second parser.

- **Layout detection** comes from the sheets themselves. Any sheet whose A1 matches `^(T|O)\d+\s*[-–—]\s*name` is a plan sheet. The plan's `layout` is `'objectives'` if those ids start with `O`, else `'targets'`. Mixed ids is a layout problem.
- **Each 4.2 difference is a fallback that only applies when the 2.x element is missing.** So every 2.x workbook parses to the same plan as today; the existing fixture tests are the regression net.
- New fields are **optional** in the model (`?` or `null`), so stored 2.x plans (`plans.plan` jsonb, `data/plan.json`) stay valid without a migration.
- **Progress mode** is a plan property (`progressBy: 'done' | 'percent'`), set when the action table has a `%` column. `progress()` / `planSummary()` read it.
- **Wording** comes from one helper, `nounFor(plan)` → `{ one: 'objective' | 'target', many, One, Many }`, used everywhere the UI says "target".

## Architecture

```
xlsx ─ readGrid ─▶ parseAxcWorkbook(grid, …)
                    ├ parseSummary: period text "Sep 2026 – Aug 2027"         (2.x)
                    │               else label "Start month (M1)" + date cell  (4.2) → fiscal {startYear, startMonth}
                    │               version: leading "x.y" of the Version cell ("4.2 (01/10/2026)" → "4.2")
                    ├ plan sheets: A1 /^(T|O)\d+ - name/  → layout 'targets' | 'objectives'
                    └ parseTargetSheet
                        ├ weight: "Weight" label → value (2.x) | no label → null → equalWeights() after all sheets
                        ├ header: # Quarter Action [Deliverable] [Success measure] Owner [Partners] Due Status [%] [Reference document] [Note]
                        ├ row kinds: "ACTIONS DONE" stop · "A.  Title" section (2.x)
                        │            · detail row: # like "1.1", no quarter, has action text → Detail {id,title,goal,needsFirst,jd}
                        │            · action row → Action {+ detailId, partners, percent, references, note}
                        └ dues: dates/Monthly/Quarterly built in; other words → WordResolver (map once)
Plan {layout, progressBy, targets[{…, weightSource, details[]}]}
   ├ shared/progress.ts  progress(target, plan) → {done,total,nextYear, percent?}
   ├ shared/summary.ts   planSummary → yearProgress = Σ weight·progress / Σ weight (percent mode: average %)
   └ client: TargetHeader · ObjectiveDetails (new) · ActionPlan/ActionTable · ActionDrawer · nounFor(plan) wording
```

## Data shapes (`src/shared/model.ts`, additive)

```ts
export interface Detail {          // a 4.2 "objective detail" row
  id: string;                      // "1.1"
  title: string;                   // "AI strategy & roadmap approved"
  goal: string | null;             // text after "Goal:"
  needsFirst: string | null;       // text after "Needs first:"
  jd: string | null;               // text after "JD:" ("1.1, 1.2")
}
export interface Action {
  // … existing fields …
  detailId?: string | null;        // "1.1" (4.2), absent for 2.x
  partners?: string | null;
  percent?: number | null;         // 0..100, null when blank
  references?: string[];           // "a; b; c" → ["a","b","c"]
  note?: string | null;
}
export interface Target {
  // … existing fields …
  weightSource?: 'file' | 'equal'; // absent = 'file'
  details?: Detail[];
}
export interface Plan {
  // … existing fields …
  layout?: 'targets' | 'objectives';   // absent = 'targets'
  progressBy?: 'done' | 'percent';     // absent = 'done'
}
```
- For a 4.2 action, `section` = its detail's `"1.1 · title"`, so the existing tree and grouping keep working. `deliverable` = the action text when there is no Deliverable column, as in the current fallback.
- `measure` stays `null`.

## Decisions
- **Fallbacks, not a template switch.** Each rule ("no Weight label → equal", "no Deliverable column → action text", "no period text → Start month") is local and keeps 2.x untouched. A `templateVersion` switch would break on the next minor version.
- **Average % with blank = 0** (`improve/decisions.md`). Next-year actions are excluded, as today. The year progress keeps the weighted formula, and with equal weights that's the plain average across objectives.
- **% value forms**: a number `0 ≤ n ≤ 1` is a fraction (Excel % cell), `1 < n ≤ 100` is a percent, `"40%"` is a percent. Anything else is a values problem (`row`, "% must be 0–100").
- **Free-text due words map once** through the existing `WordResolver.due` (`improve/decisions.md`). No new `Due` kind.
- **Optional model fields**, so stored plans and the Postgres jsonb need no migration.
- **Version** is the leading `x.y` of the Version cell. Tested versions become `['2.0', '2.1', '4.2']`, so 4.2 raises no "newer than tested" warning.

### Rejected
- **A separate `parse-axc-v4.ts`**: duplicates block/header/word handling and doubles the test surface.
- **Treating detail rows as actions with a blank quarter**: they'd raise "unknown quarter" questions and inflate the counts (84 → 102).
- **A schema migration for the new fields**: the plan is one JSON document; nothing queries these fields in SQL.

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|-----------|------------------|---------------------------------|
| Start-month cell value | Excel date serial (number), JS `Date`, or text "Oct 2026" / "2026-10-01" → `{startYear, startMonth}` | none readable → the existing "fiscal period not found" problem, with the message also naming "Start month (M1)" |
| Where the Start-month label sits | any row of the Executive Summary whose first non-empty cell starts with "start month" (case-insensitive); value = next non-empty cell to the right | — |
| Period text and Start month both present | the period text wins (2.x rule) | — |
| Detail-row detection | col A matches `^\d+\.\d+$` (as text, or a number with a fraction like `1.1`), quarter cell blank, action text present | a row with a blank quarter that isn't detail-shaped → today's unknown-quarter path |
| Goal / Needs first / JD source | the first non-empty cell right of the action column in the detail row, split by lines starting `Goal:`, `Needs first:`, `JD:` (labels stripped, trimmed); text without those labels becomes `goal` | — |
| Action `#` like `1.0` | `Number()` → 1 (already the case) | — |
| `%` column aliases | `%`, `progress`, `percent`, `% done` | — |
| Other column aliases | partners: `partners`, `partner`; reference: `reference document`, `reference documents`, `reference`, `references`; note: `note`, `notes` | — |
| References split | on `;` and newlines, trimmed, empties dropped | — |
| Weight label present but empty or invalid | today's values problem (2.x behaviour) | — |
| Some objectives with a weight, some without | values problem on the ones without ("weight not found") | — |
| Equal weight value | `1 / count(targets)`, `weightSource: 'equal'` | — |
| Mixed `T` and `O` sheet ids | layout problem "plan sheets mix T… and O… ids" | — |
| Progress of an objective with 0 this-year actions | 0 | — |
| Detail progress | average % of that detail's this-year actions | — |
| Noun | `layout === 'objectives'` → objective, else target | — |
| Table column switch | Partners column if any action in the plan has partners, else Success measure; % column if `progressBy === 'percent'` | — |
| Reference display in the table | first two names joined by " · " plus "+n" | — |
| Note clamp | 2 lines in the table (CSS line-clamp), full in the drawer | — |
| CSV import (`parse-csv.ts`) | unchanged (2.x semantics); new fields absent | — |
| Fixture file | copy the user's workbook to `tests/fixtures/axc-fy2026-27-v4.2.xlsx` | — |
| Test mappings for 4.2 | `V42_MAPPINGS`: status `in progress → on_track`; due `yearly`, `per bod schedule`, `per bod review`, `per pilot`, `per course` → `quarter_end` | — |
| Commit message | `roadline-template-v4: <summary>` | — |

### Blast Radius
- `src/shared/model.ts` (optional fields): safe/reversible
- `src/shared/parse-axc.ts` (detection, fallbacks, row kinds, columns): **risky**, because every import goes through it. The 2.x fixture tests must stay green unchanged
- `src/shared/values.ts` (`parsePercent`, `parseStartMonth`, `versionText` leading x.y): safe/reversible
- `src/shared/progress.ts`, `summary.ts` (percent mode): safe/reversible, though it changes the numbers shown for 4.2 only
- `src/shared/noun.ts` (new `nounFor`): safe/reversible
- `src/client/components/target-header.tsx`, `action-plan.tsx`, `action-drawer.tsx`, `objective-details.tsx` (new), `percent.tsx` (new), `pages/target-page.tsx`, the timeline / summary wording, `styles.css`: safe/reversible
- `tests/fixtures/axc-fy2026-27-v4.2.xlsx` (new, internal data), `tests/helpers.ts` (`FIXTURE_V42`, `V42_MAPPINGS`, `fixturePlanV42`), new and adjusted tests: safe/reversible
- `README.md` import formats, `devspec/context/*`: safe/reversible
- No DB change

## Open questions
None.
