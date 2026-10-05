# Spec: roadline-v2

Today in scenarios is 28 Sep 2026 on the v2.0 fixture (all actions Not started) unless a scenario says otherwise. "Dec plan" means the same fixture with statuses set in the test as in the mockups, viewed on 10 Dec 2026.

### Requirement: new look with system fonts [req-1]
The client SHALL use the token set in `ui.md` on `:root` and system font stacks only, loading no external font or stylesheet.

#### Scenario: tokens applied
- **WHEN** the timeline page renders
- **THEN** the body background is `--bg` (`#F4F2EC`) and cards use `--surface` with `--line` borders

#### Scenario: no web fonts
- **WHEN** the built `index.html` and `styles.css` are inspected
- **THEN** they contain no `fonts.googleapis.com`, `@import url(` or `@font-face`, and headings use the serif system stack

### Requirement: app header [req-2]
The header SHALL show the logo mark, "Roadline", the plan title and meta, the Month/Quarter segmented control and an "Import workbook" button; on the target page it SHALL show a breadcrumb back to the timeline instead of the view control.

#### Scenario: timeline header
- **WHEN** a plan is loaded on `/`
- **THEN** the header shows the plan title, "Sep 2026 – Aug 2027 · from <file> · updated <date time>", a `Month` button with `aria-pressed="true"`, a `Quarter` button and an "Import workbook" button

#### Scenario: target breadcrumb
- **WHEN** `/target/T3` is open
- **THEN** a "Timeline" link points to `/` (keeping `?today=`), followed by "T3 · AI Management"

### Requirement: summary tiles [req-3]
The timeline page SHALL show a `Summary` section with four tiles: weighted year progress, open this quarter, overdue, and targets needing attention, computed by `planSummary(plan, today)`.

#### Scenario: fixture at the start of the year
- **WHEN** the fixture is viewed on 28 Sep 2026
- **THEN** year progress is "0%" with "0 of 75 actions done", open this quarter is 21 with "Q1 · Sep – Nov", overdue is 0, and targets needing attention is 0

#### Scenario: Dec plan
- **WHEN** the Dec plan is viewed on 10 Dec 2026
- **THEN** year progress is "19%" with "15 of 75 actions done", open this quarter is 19, overdue is 6, and attention lists T1 and T3 with their status words

#### Scenario: outside the fiscal year
- **WHEN** today is 1 Oct 2027
- **THEN** "Open this quarter" shows "—"

### Requirement: next-actions window [req-4]
`openNow(plan, today)` SHALL return every open, this-year action that is overdue, due in the current quarter, or recurring, each tagged `overdue`, `thisQuarter` or `allYear`, with counts.

#### Scenario: Dec plan window
- **WHEN** `openNow` runs on the Dec plan on 10 Dec 2026
- **THEN** it returns 29 items: 6 overdue, 19 thisQuarter, 4 allYear; no done, Q3, Q4 or next-year action is included

#### Scenario: count line
- **WHEN** the Next actions section renders the Dec plan
- **THEN** its header reads "29 open · 6 overdue · 19 due by end of Feb · 4 all year"

#### Scenario: next-year actions noted
- **WHEN** the v2.1 fixture (with next-year actions) is shown
- **THEN** the count line ends with "· 14 moved to next year" and no next-year action appears in the views

### Requirement: Board and Tasks views [req-5]
The Next actions section SHALL offer a Board view (default) with columns Behind, At risk, On track, Not started, and a Tasks view grouped Overdue, Due this quarter, All year; every card and row SHALL link to its target page and show the file's status word.

#### Scenario: opens on Board
- **WHEN** the timeline page loads
- **THEN** the `Board` button has `aria-pressed="true"` and four columns show counts 3, 4, 11, 11 for the Dec plan

#### Scenario: switch to Tasks
- **WHEN** the user clicks `Tasks`
- **THEN** three groups show counts 6, 19, 4, the first Overdue row is a Behind action, and reloading the page shows Board again

#### Scenario: card content and link
- **WHEN** a Board card for T1 #3 is shown on the Dec plan
- **THEN** it shows "T1", "#3", "Overdue · Nov", "1 workflow live" and the owner, and it links to `/target/T1`

#### Scenario: empty window
- **WHEN** every action in the window is done
- **THEN** both views show "Nothing open right now — every action due so far is done."

### Requirement: timeline cells [req-6]
Each timeline cell with topics SHALL show a status bar by tone, the topic count, "N overdue" / "N at risk" chips when non-zero, and every topic with its full text and an OVERDUE tag when overdue.

#### Scenario: all topics listed
- **WHEN** the month view shows T1 on the fixture
- **THEN** the Nov cell reads "7 topics", lists 7 `li` items with `.dot.bg-not_started`, and has no "+N more" and no ellipsis

#### Scenario: chips and tags
- **WHEN** the Dec plan is shown in month view on 10 Dec 2026
- **THEN** the T1 Nov cell shows a "3 overdue" chip and 3 topics tagged OVERDUE, and the T1 Feb cell shows "1 at risk"

### Requirement: timeline layout [req-7]
The timeline SHALL size month columns by content (months with topics wide, empty months narrow), keep the target column visible while scrolling horizontally, mark the current column "NOW", and keep the Next-year column when the plan has next-year actions.

#### Scenario: adaptive widths
- **WHEN** the fixture is shown in month view
- **THEN** the grid template gives Nov, Feb, May and Aug `minmax(220px, 1fr)` and the other months `60px` (the current month `88px` when empty)

#### Scenario: narrow window
- **WHEN** the viewport is 1280 px wide in quarter view with a Next-year column
- **THEN** no column is clipped; the grid card scrolls horizontally and the target column stays in view

#### Scenario: next-year column
- **WHEN** the v2.1 fixture is shown
- **THEN** a 13th column "Next year" lists each target's next-year topics and the legend notes it is not in this year's progress

### Requirement: all-year strip [req-8]
The timeline SHALL show, under each target that has ongoing actions, a strip across the period columns listing each ongoing action with its cadence.

#### Scenario: T3 monthly report
- **WHEN** the fixture is shown
- **THEN** T3 has an "All year" strip with "12 monthly reports · monthly" and T1 has no strip

### Requirement: target page overview [req-9]
The target page SHALL show a header card with the id, status word, name, objective and four fact tiles (weight, owner, progress, overdue), a "Next for this target" list of 3, and a `Quarters` row of tiles linking to each quarter group.

#### Scenario: T3 header
- **WHEN** `/target/T3` is open on the fixture
- **THEN** the `h1` is "AI Management", tiles show "28%", "AXC Lead + Coordinator", "0 / 18 done" and overdue 0, and "Next for this target" has 3 items

#### Scenario: quarter tiles
- **WHEN** `/target/T3` is open
- **THEN** the Quarters row has Q1–Q4 and "All year" tiles, Q1 is marked NOW, and each links to `#<group>` of the action plan

### Requirement: target action plan and notes [req-10]
The target page SHALL group the action plan by Q1–Q4, ongoing and next year (as `data-quarter` groups), and show must-achieve, depends-on, risks, how and change history as always-open cards.

#### Scenario: groups
- **WHEN** `/target/T1` is open on the fixture
- **THEN** groups Q1–Q4 exist, Q1 has 7 rows, and there is no `next_year` group

#### Scenario: next-year group
- **WHEN** `/target/T1` is open on the v2.1 fixture
- **THEN** a `next_year` group has 7 rows and says "not in this year's progress"

#### Scenario: always-open notes
- **WHEN** `/target/T3` is open
- **THEN** the `Target details` area shows the 7 must-achieve items, 3 depends-on items with chips T1, T2, HR, and 3 risks with mitigations, with no `<details>` elements

### Requirement: import screens [req-11]
The empty, uploading, rejected and map-new-values screens SHALL use the new layout from `ui.md` while keeping v1 behaviour: nothing replaced on failure, the mapping dialog re-sends the same file.

#### Scenario: empty
- **WHEN** no plan exists
- **THEN** `No plan loaded` shows "Drop the workbook here", a "Choose file…" button and the .xlsx and .csv format cards

#### Scenario: rejected
- **WHEN** an upload returns 400 with problems
- **THEN** `Import failed` lists each problem as sheet, row and message, says nothing was replaced, and the previous plan stays rendered

#### Scenario: mapping
- **WHEN** an upload returns 422 `needs_mapping`
- **THEN** `Map new values` shows one row per word with its suggestion pre-selected, and "Apply & import" re-sends the file with the mapping

### Requirement: nothing else changes [req-12]
The change SHALL keep routes, API use, `?today=` link suffixes, read-only behaviour and the lint/test/build gate unchanged.

#### Scenario: gate
- **WHEN** `npm run lint && npm test && npm run build` runs
- **THEN** all pass

#### Scenario: today suffix
- **WHEN** the page is opened with `?today=2026-12-10`
- **THEN** every card, row, cell and breadcrumb link keeps `?today=2026-12-10`
