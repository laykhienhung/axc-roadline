# Spec: roadline-template-v4

### Requirement: both template layouts import [req-1]
The importer SHALL read a workbook whose plan sheets are titled `T<n> - Name` (2.x) or `O<n> - Name` (4.2) and SHALL keep every 2.x result unchanged.

#### Scenario: 4.2 workbook
- **WHEN** the 4.2 fixture is imported with `V42_MAPPINGS`
- **THEN** the plan has `layout: 'objectives'`, 6 targets `O1`…`O6` named "Strategy & Roadmap" … "Safety & Governance", 84 actions (7, 21, 15, 14, 12, 15), template version `4.2`, and no "newer than tested" warning

#### Scenario: 2.x unchanged
- **WHEN** the v2.0 and v2.1 fixtures are imported
- **THEN** every existing parser, summary and next-action test passes unchanged, and the plan has `layout` absent or `'targets'`

#### Scenario: mixed ids
- **WHEN** a workbook has both a `T1 - …` and an `O1 - …` sheet
- **THEN** the import is rejected with the layout problem "plan sheets mix T… and O… ids"

### Requirement: fiscal year from the Start month [req-2]
The importer SHALL take the fiscal year from the Executive Summary's period text, or else from its "Start month (M1)" date, as 12 months starting that month.

#### Scenario: Start month
- **WHEN** the 4.2 Executive Summary has "Start month (M1)" = 2026-10-01 and no period text
- **THEN** `fiscal` is `{ startYear: 2026, startMonth: 10 }`, the quarters are Q1 Oct–Dec 2026 … Q4 Jul–Sep 2027, and due dates Oct 2026 – Sep 2027 all fall inside the year

#### Scenario: neither present
- **WHEN** the Executive Summary has neither
- **THEN** the import is rejected with a problem naming both the period text and "Start month (M1)"

### Requirement: optional weight, equal by default [req-3]
The importer SHALL use each target's Weight when the sheet has a Weight label, and SHALL give every target an equal weight when no sheet has one.

#### Scenario: no weights
- **WHEN** the 4.2 fixture is imported
- **THEN** every objective has `weight` 1/6 and `weightSource: 'equal'`

#### Scenario: some missing
- **WHEN** one sheet has a Weight label and another has none
- **THEN** the import is rejected with "weight not found" on the sheet without one

### Requirement: 4.2 action columns [req-4]
The importer SHALL accept an action table without Deliverable and Success measure, and SHALL read Partners, %, Reference document and Note when present.

#### Scenario: columns read
- **WHEN** O1 action 2 is read from the 4.2 fixture
- **THEN** it has `partners: 'BOD sponsor'`, `references` with 3 file names, a `note` starting "Roadmap + objectives drafted", `percent: null`, `deliverable` equal to its action text, and `measure: null`

#### Scenario: percent forms
- **WHEN** `%` cells hold `0.4`, `40`, `"40%"`, blank, or `150`
- **THEN** they read as 40, 40, 40 and null, and `150` is rejected with "% must be 0–100" on that row

### Requirement: objective details [req-5]
The importer SHALL read a `1.1`-style row with no quarter as an objective detail (id, title, goal, needs first, JD) and SHALL link the actions below it to that detail until the next detail.

#### Scenario: O1 details
- **WHEN** O1 is read from the 4.2 fixture
- **THEN** it has 2 details:
  - `1.1` "AI strategy & roadmap approved", goal "One company AI strategy and 12-month roadmap, approved by the BOD, that all functions follow.", needsFirst starting "BOD names a sponsor", jd "1.1, 1.2"
  - `1.2` "Quarterly transformation review"
- **AND** actions 1–3 have `detailId: '1.1'` and actions 4–7 `'1.2'`, each with `section` "1.1 · AI strategy & roadmap approved" or "1.2 · …"

#### Scenario: totals
- **WHEN** the whole 4.2 fixture is read
- **THEN** there are 18 details (2, 4, 3, 3, 3, 3) and no detail row is counted as an action

### Requirement: free-text due words map once [req-6]
The importer SHALL treat due words other than dates, "Monthly" and "Quarterly" as unknown words for the mapping dialog, and SHALL import once they are mapped.

#### Scenario: first import
- **WHEN** the 4.2 fixture is imported with no saved mappings
- **THEN** the result is `needsMapping` listing due words "Yearly", "Per BOD schedule", "Per BOD review", "Per pilot", "Per course" and status "In progress"

#### Scenario: mapped
- **WHEN** it is imported with `V42_MAPPINGS`
- **THEN** it succeeds, and an action due "Per BOD schedule" in quarter "ongoing" shows its mapped meaning

### Requirement: progress as average % [req-7]
Progress SHALL be the average `%` of this year's actions (blank = 0%) for a plan read with a `%` column, and the share of actions Done otherwise.

#### Scenario: percent mode
- **WHEN** a 4.2 plan's O1 has this-year percents 40, blank, blank, blank, blank, blank, blank
- **THEN** O1 progress is 40/7 ≈ 5.7%, detail 1.1 (40, blank, blank) is 13.3%, and the year progress is the equal-weight average over the six objectives

#### Scenario: done mode unchanged
- **WHEN** the v2.0 fixture on 28 Sep 2026 is summarised
- **THEN** `planSummary` gives yearProgress 0, total 75, as today

### Requirement: objective page shows 4.2 fields [req-8]
The target page SHALL use the word "objective" for a 4.2 plan, show equal weight and average-% progress, an Objective details card, and the Partners / % / reference / note columns, matching `mockups/objective.html`. A 2.x plan SHALL look as today.

#### Scenario: 4.2 page
- **WHEN** `/target/O1` renders a 4.2 plan
- **THEN**:
  - the card `aria-label` is "Objective" and the side panel reads "Next for this objective"
  - the Weight fact shows "17%" with "equal · 1 of 6"
  - the Progress fact shows the average % and "0 / 7 done"
  - an "Objective details" region lists 1.1 and 1.2 with their goals
  - the Q1 table has headers `# · Action · Partners · Owner · Due · % · Status`, the action-2 row shows the "1.1" chip, a 📎 reference line and a note line

#### Scenario: 2.x page
- **WHEN** `/target/T1` renders the v2.0 plan
- **THEN** it shows "Target", the weight from the file, done/total progress, no Objective details region, and the Success measure column with no % column

### Requirement: drawer shows 4.2 fields [req-9]
The action drawer SHALL show Partners, Progress %, Detail, the detail's Goal / Needs first / JD, Reference documents and the full Note for a 4.2 action, matching `mockups/drawer.html`, and SHALL leave out empty sections.

#### Scenario: 4.2 action
- **WHEN** the drawer opens on O1 action 2
- **THEN** the facts include Partners "BOD sponsor", Progress, and Detail "1.1 · AI strategy & roadmap approved"; sections "Objective detail 1.1 · …", "Reference documents" (3 items) and "Note" (the full text) appear; and the button reads "Open objective O1"

#### Scenario: empty fields
- **WHEN** it opens on O1 action 5 (no references, no note, blank %)
- **THEN** there is no Reference documents or Note section, and Progress reads "— (counts as 0%)"

### Requirement: wording follows the layout [req-10]
Every user-visible "target" word SHALL read "objective" for a 4.2 plan.

#### Scenario: timeline
- **WHEN** the timeline renders a 4.2 plan
- **THEN** the summary and next-action texts say "objective(s)" and none of the plan-related copy says "target"
