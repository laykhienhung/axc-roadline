# Spec: roadline-v1

### Requirement: parse AXC workbook [req-1]
The system SHALL turn an AXC-template `.xlsx` into a Plan with its targets, sections, actions and target details, locating each block by its label rather than its row number.

#### Scenario: real FY2026-27 workbook
- **WHEN** `tests/fixtures/axc-fy2026-27.xlsx` is parsed
- **THEN** the plan has 4 targets (T1–T4) with 26, 21, 18 and 10 actions, fiscal start September 2026 and template version "2.0"

#### Scenario: fields of one action
- **WHEN** the same workbook is parsed
- **THEN** T1 action #1 has quarter Q1, due Nov 2026, owner "Developer", deliverable "Process inventory + needs survey", section "A. Automation workflows" and status not_started

#### Scenario: shifted table and recurring actions
- **WHEN** the same workbook is parsed
- **THEN** T4's actions are read even though its table starts at a different row, T4 has section "Actions", and T3 #9 has quarter "ongoing" with a monthly recurring due

#### Scenario: target details
- **WHEN** the same workbook is parsed
- **THEN** T2 has 7 "must achieve" items, 3 "depends on" items, and T4 has 2 risks with mitigations

### Requirement: reject invalid files [req-2]
The system SHALL reject a file whose layout does not match the template, or whose values cannot be mapped (action # not a number, month due outside the fiscal year), with a list of problems naming the sheet, row and issue, and SHALL never return a partial plan. Unknown status, quarter or due words are not problems; they are handled by [req-14].

#### Scenario: missing action table
- **WHEN** a workbook's T2 sheet has no action-table header row
- **THEN** parsing fails with a problem for sheet "T2 Adoption" saying the action table was not found

#### Scenario: due month outside the fiscal year
- **WHEN** an action's Due cell is "Nov 2028"
- **THEN** parsing fails with a problem naming that sheet and row and saying the due month is outside the fiscal year

#### Scenario: newer template version
- **WHEN** the workbook's version is "3.0" and otherwise valid
- **THEN** parsing succeeds with a warning that the version is newer than the tested "2.0"

### Requirement: parse flat CSV [req-3]
The system SHALL accept a `.csv` file with one row per action and the documented columns, producing the same Plan shape.

#### Scenario: valid CSV
- **WHEN** a CSV with header `target_id,target_name,target_weight,target_owner,target_status,section,no,quarter,action,deliverable,success_measure,owner,due,status` and 3 rows for T1 is parsed
- **THEN** the plan has one target T1 with 3 actions and fiscal start September of the fiscal year of the earliest due

#### Scenario: missing column
- **WHEN** the CSV has no `due` column
- **THEN** parsing fails with a problem naming the missing column

### Requirement: import and store the plan [req-4]
The server SHALL accept an uploaded `.xlsx` or `.csv` file, replace the shared current plan only if parsing succeeds, and keep the previous plan and the uploaded file.

#### Scenario: valid upload
- **WHEN** `POST /api/plan` receives the fixture workbook
- **THEN** it returns 200 with the plan, `data/plan.json` holds it, and the earlier plan is in `data/plan.prev.json`

#### Scenario: invalid upload keeps the current plan
- **WHEN** `POST /api/plan` receives a file that fails parsing
- **THEN** it returns 400 `{ error: "invalid_plan", problems }` and `GET /api/plan` still returns the previous plan

#### Scenario: wrong type or too large
- **WHEN** the upload is a `.pdf`, or larger than 5 MB
- **THEN** it returns 415 `unsupported_type`, or 413 `file_too_large`, and nothing is stored

### Requirement: serve the current plan [req-5]
The server SHALL return the current shared plan to any caller.

#### Scenario: plan exists
- **WHEN** a plan was imported and `GET /api/plan` is called
- **THEN** it returns 200 with that plan

#### Scenario: nothing imported
- **WHEN** no plan has been imported and `GET /api/plan` is called
- **THEN** it returns 404 `{ error: "no_plan" }`

### Requirement: fiscal calendar and placement [req-6]
The system SHALL lay out the plan on the fiscal year from its start month, placing each action by due month (month view) or quarter (quarter view), and identify the current period.

#### Scenario: month columns
- **WHEN** month columns are built for a plan starting September 2026
- **THEN** there are 12 columns Sep 2026 … Aug 2027, labelled Q1 for Sep–Nov and Q4 for Jun–Aug

#### Scenario: placement
- **WHEN** an action is due Feb 2027 in quarter Q2
- **THEN** it is placed in the Feb 2027 column in month view and the Q2 column in quarter view; an ongoing action is placed in no column

#### Scenario: current period
- **WHEN** today is 28 Sep 2026
- **THEN** the current month is Sep 2026 and the current quarter Q1; when today is 1 Oct 2027 there is no current period

### Requirement: rank next actions [req-7]
The system SHALL list open actions of this fiscal year ordered by overdue or Behind-tone first, then next due date, then target weight, then target order, then action number.

#### Scenario: plan-wide on 28 Sep 2026
- **WHEN** next actions are computed for the fixture plan with today 28 Sep 2026 and limit 5
- **THEN** the first is T3 #9 (monthly, next 30 Sep 2026) followed by T1 #1, #2, #3, #4

#### Scenario: overdue and done
- **WHEN** an action due Aug 2026 is not done and another action is done
- **THEN** the overdue action is listed first and the done action is not listed

#### Scenario: per target
- **WHEN** next actions are computed for target T2 with limit 3
- **THEN** only T2 actions are returned, 3 at most

#### Scenario: Behind and next-year actions
- **WHEN** an action due Aug 2027 has a status word mapped to Behind (e.g. "Blocked") and another action is next-year
- **THEN** the Behind action is listed before actions due earlier that are not Behind, and the next-year action is never listed

### Requirement: status colors [req-8]
The UI SHALL show status only through the five status colors (Not started grey, On track green, At risk amber, Behind red, Done blue), always with a visible legend.

#### Scenario: legend and dots
- **WHEN** the timeline page renders a plan
- **THEN** a legend with the five statuses is shown above the grid and each topic and target shows a dot in its status color

### Requirement: timeline page [req-9]
The timeline page SHALL show one row per target and one column per month (default) or quarter, each cell listing the topics placed there, with the current period highlighted.

#### Scenario: default month view
- **WHEN** the page loads with the fixture plan and `?today=2026-09-28`
- **THEN** Month is the active view, 12 month columns are shown with Sep highlighted as now, and the T1 / Nov 2026 cell lists 7 topics

#### Scenario: quarter toggle
- **WHEN** the user clicks Quarter
- **THEN** 4 quarter columns with date ranges are shown and the T1 / Q1 cell lists 7 topics

#### Scenario: flagged cell
- **WHEN** a cell contains a topic with status Behind (or At risk and no Behind)
- **THEN** the cell shows a red (or amber) left edge

#### Scenario: navigate to detail
- **WHEN** the user clicks a target cell or any period cell of T2
- **THEN** the browser goes to `/target/T2`

### Requirement: next actions panel [req-10]
The timeline page SHALL show the top 5 next actions with status, target, action text and due text, each linking to its target page.

#### Scenario: panel content
- **WHEN** the page loads with the fixture plan and `?today=2026-09-28`
- **THEN** the panel shows 5 rows, the first "T3 · Publish the monthly usage and cost report" (the action text) with due text "↻ due 30 Sep"

### Requirement: import from the page [req-11]
The page SHALL let the user import a file and show empty, loading and error states without losing the current plan on failure.

#### Scenario: empty state
- **WHEN** no plan exists
- **THEN** the page shows "No plan loaded" with a file drop zone and a Choose file button

#### Scenario: successful import
- **WHEN** the user imports the fixture workbook
- **THEN** a loading state shows during upload and the timeline then renders the new plan and its file name and import time in the header

#### Scenario: failed import
- **WHEN** the user imports an invalid file
- **THEN** an error panel lists the problems, says nothing was replaced, and the previous plan stays on screen

### Requirement: target detail page [req-12]
The target page SHALL show the target's header facts, its next 3 actions, its action plan grouped by quarter with status badges, and collapsible detail sections.

#### Scenario: T1 page
- **WHEN** the user opens `/target/T1` with the fixture plan and `?today=2026-09-28`
- **THEN** the page shows "T1 · Build AI Tools & Automation", weight 34%, owner Developer, progress 0 / 26, 3 next actions, quarter blocks Q1–Q4 with Q1 tagged now, and sections What this must achieve (open), How we will do it, Depends on, Risks, Change history

#### Scenario: unknown target
- **WHEN** the user opens `/target/T9`
- **THEN** the page shows "Target not found" with a link back to the timeline

### Requirement: single-service hosting [req-13]
The system SHALL run as one Node process that serves the API and the built web page, including direct links to target pages.

#### Scenario: deep link
- **WHEN** the built app runs with `npm start` and a browser requests `/target/T1` directly
- **THEN** the server returns the web page, which renders the T1 detail

### Requirement: detect unknown words and suggest meanings [req-14]
The system SHALL collect every status, quarter and due word that is neither built in nor saved in the mappings from the file's rows, and return them with counts, locations and a suggested meaning instead of a plan. Unmapped words from the file's status dropdown lists SHALL be added to that list, but SHALL NOT on their own stop an import (decided 2026-09-29: the v2.0 file already lists "In progress" and "Blocked" in its dropdown).

#### Scenario: v2.1 workbook without mappings
- **WHEN** `tests/fixtures/axc-fy2026-27-v2.1.xlsx` is parsed with empty mappings
- **THEN** the result is `needsMapping` with status "In progress" (7 actions, suggestion On track), status "Blocked" (0 actions, from the dropdown list, suggestion Behind) and quarter "FY27-28" (14 actions, suggestion Next year), and no due word is asked

#### Scenario: v2.1 workbook with mappings
- **WHEN** the same workbook is parsed with mappings `in progress → on_track`, `blocked → behind`, `fy27-28 → next_year`
- **THEN** parsing succeeds, T1 has 12 this-year and 7 next-year actions, T1 #4 has status on_track with word "In progress", and `applied` lists the three mappings used by the file

#### Scenario: dropdown-only words
- **WHEN** the v2.0 fixture is parsed with empty mappings (its Status dropdown lists "In progress" and "Blocked", no row uses them)
- **THEN** parsing succeeds without asking for a mapping

#### Scenario: due word on a normal quarter
- **WHEN** a Q3 action's Due cell is "TBD" and the mappings say `tbd → quarter_end`
- **THEN** the action is due May of that fiscal year

#### Scenario: layout still wins
- **WHEN** a v2.1 workbook also has a sheet without an action-table header
- **THEN** parsing fails with problems and no mapping is asked

### Requirement: mapping round trip through the API [req-15]
The server SHALL answer an upload with unknown words by 422 `needs_mapping` without saving anything, accept the same file again with a `mapping` field, and on success save both the plan and the merged mappings so later imports need no dialog.

#### Scenario: first upload of v2.1
- **WHEN** `POST /api/plan` receives the v2.1 fixture and no mappings are saved
- **THEN** it returns 422 `{ error: "needs_mapping", unknown }`, `data/plan.json` is unchanged and `data/mappings.json` is not written

#### Scenario: retry with mapping
- **WHEN** the same file is posted with `mapping` = the three suggested meanings
- **THEN** it returns 200 with the plan and `applied`, and `data/mappings.json` contains the three mappings

#### Scenario: second import
- **WHEN** the v2.1 fixture is posted again without a mapping
- **THEN** it returns 200 directly with `applied` listing the saved mappings

#### Scenario: bad mapping field
- **WHEN** the `mapping` field is not valid JSON or maps a word to an unknown meaning
- **THEN** it returns 400 `{ error: "invalid_mapping" }` and nothing is saved

### Requirement: next-year actions [req-16]
The system SHALL treat actions mapped to Next year as outside this fiscal year: placed in a Next-year column, excluded from this year's progress and from next actions.

#### Scenario: placement and label
- **WHEN** a plan starting Sep 2026 has next-year actions
- **THEN** month and quarter columns end with a "Next year" column labelled "FY27-28", and next-year actions are placed only there

#### Scenario: progress
- **WHEN** progress is computed for T1 of the mapped v2.1 plan
- **THEN** it is 2 done of 12 with 7 next year, and the four targets total 52 this-year actions

### Requirement: status words and tones [req-17]
The UI SHALL show each status as the file's own word in the color of its tone, and the legend SHALL group the file's words under each tone.

#### Scenario: word and color
- **WHEN** an action's word is "In progress" mapped to On track
- **THEN** its dot and badge use the On track color and the text reads "In progress"

#### Scenario: grouped legend
- **WHEN** the timeline renders the mapped v2.1 plan
- **THEN** the legend shows "On track (In progress)" and the other four tones without extra words

### Requirement: mapping dialog [req-18]
The page SHALL show a mapping dialog when an import returns `needs_mapping`, pre-filled with the suggestions, and SHALL re-send the same file with the chosen mapping on "Apply & import".

#### Scenario: dialog content
- **WHEN** the user imports the v2.1 fixture with no saved mappings
- **THEN** a dialog lists Status "In progress" (7 actions) and "Blocked" (listed in the file's dropdown) and Quarter "FY27-28" (14 actions), each with its suggestion selected

#### Scenario: apply
- **WHEN** the user clicks "Apply & import"
- **THEN** both buttons are disabled while the file is re-sent with the mapping, and the timeline then shows the new plan

#### Scenario: cancel
- **WHEN** the user clicks "Cancel"
- **THEN** the dialog closes, nothing is imported, and a note says the file was not imported

### Requirement: import notes [req-19]
The page SHALL show, after an import, a dismissable note listing the mappings applied, and a dismissable warning when the template version is newer than tested, only on the first import of that version.

#### Scenario: first and second import of v2.1
- **WHEN** the v2.1 fixture is imported for the first time with a mapping, then imported again
- **THEN** the first import shows the applied-mappings note and the version warning; the second shows only the applied-mappings note

#### Scenario: built-in words only
- **WHEN** the v2.0 fixture is imported after the v2.0 version was already seen
- **THEN** no import note is shown

### Requirement: next-year UI [req-20]
The timeline and target page SHALL show next-year actions in their own column and block, and show this-year progress with the next-year count.

#### Scenario: timeline
- **WHEN** the timeline renders the mapped v2.1 plan with `?today=2026-09-29`
- **THEN** there are 13 columns ending with "Next year / FY27-28", that column lists 7, 5, 2 and 0 topics for T1–T4, and the T1 cell reads "2 / 12 done · 7 next year"

#### Scenario: target page
- **WHEN** `/target/T1` renders the mapped v2.1 plan
- **THEN** progress reads "2 / 12 done" with "this year · 7 more next year", and after Q4 a "Next year · FY27-28 · 7 actions" block lists 7 rows

#### Scenario: no next-year actions
- **WHEN** the v2.0 plan is shown
- **THEN** there is no Next-year column or block
