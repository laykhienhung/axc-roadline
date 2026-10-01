# Proposal: roadline-v1

## Why
The AXC team's FY2026-27 objectives and action plan (4 targets, 66–75 actions depending on the template version) live in a formatted Excel workbook. It is hard to see at a glance what happens when, and what the team should do next. The team wants a simple shared web page that shows the plan on a timeline, lets anyone drill into a target, and highlights the next actions.

The template keeps changing (v2.1 added the action statuses "In progress" and "Blocked", and moved 14 actions to quarter "FY27-28" with due "Next year"). A strict import rejects such a file outright, so the page must adapt to new words instead of failing.

## What it delivers
- **Import**: anyone with the link uploads the plan as `.xlsx` or `.csv` (AXC template). The server checks the layout; a file whose layout can't be read is rejected with a list of problems and the current plan stays.
- **Adaptive import** *(revision 2)*: when a readable file contains words Roadline doesn't know (status, quarter or due values), a mapping dialog asks what each word means, pre-filled with suggestions. The choices are saved on the server and applied to every later import automatically. The words are collected from the rows and from the workbook's own dropdown lists.
- **Timeline page** (`/`): targets as rows, months (default) or quarters (toggle) as columns across the fiscal year Sep 2026 – Aug 2027, plus a **Next year** column for actions moved to the following fiscal year. Each cell lists the topics (deliverables) with a status dot. The current period is highlighted.
- **Next actions**: the top 5 open actions of this year — overdue and Behind/Blocked first, then by due date, target weight and order.
- **Target detail page** (`/target/:id`): header (weight, owner, status, this-year progress, objective), the next 3 actions for that target, the action plan grouped by quarter plus a Next-year block, and collapsible sections (what this must achieve, how, depends on, risks, change history).
- **Status colors**: five tones (Not started / On track / At risk / Behind / Done) with a legend that lists the file's own words under each tone. Color carries no other meaning.
- **Import notes**: after an import, a note lists the saved mappings that were applied, and a one-time warning appears when the template version is newer than the tested one.
- **Hosting**: one Node service on the internal server serving the API and the web page. No login.

## Scope
**In**
- AXC workbook template (sheets `Executive Summary`, `T1..Tn`), `.xlsx` and a flat `.csv` (one row per action).
- Read-only viewing; one shared current plan; previous plan kept as a backup file.
- Value mappings stored in `data/mappings.json`, shared by everyone.

**Out**
- Google Sheet URL / OAuth / scheduled auto-sync.
- Editing statuses or actions in the web page (the workbook stays the source of truth).
- A screen to review or edit saved mappings — edit `data/mappings.json` on the server instead.
- Mapping columns or sheet layout (only values are mapped; a changed layout is still an error).
- Meeting Log sheet, maturity-score charts, other teams' templates.
- Authentication / upload permissions (internal network, anyone with the link).

## Success
- Importing the v2.0 workbook shows 4 targets and 75 actions on the timeline, correctly placed by due month, with no dialog.
- Importing the v2.1 workbook opens the mapping dialog for "In progress", "Blocked" and "FY27-28" with suggestions; after applying, T1 shows `2 / 12 done · 7 next year`, the Next-year column lists 14 topics, and this year's progress totals 52 actions.
- Re-importing the v2.1 workbook imports straight away with only the "applied saved mappings" note.
- A workbook with a broken layout is rejected with row-level problems and the previous plan is still shown.
- On 28 Sep 2026 (v2.0) the next-actions list shows the monthly cost report (T3) first, then Q1 actions ranked by target weight.
