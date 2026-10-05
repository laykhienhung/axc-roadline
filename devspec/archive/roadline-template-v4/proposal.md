# Proposal: roadline-template-v4

## Why

The AXC team moved its plan to **template 4.2** (version "4.2 (01/10/2026)"). Importing it today fails with "No target sheets found" and "Fiscal period not found". Behind those two errors, 4.2 differs from 2.x in a number of ways:

- **Six objective sheets** `O1 - Name` instead of `T1 - Name`.
- **No Weight.**
- The fiscal year runs **12 months from a "Start month (M1)" date** (Oct 2026 → Sep 2027) instead of a "September 2026 - August 2027" period.
- New action columns **Partners, %, Reference document, Note**, and no Deliverable or Success measure.
- **Objective-detail rows** ("1.1 … Goal: … Needs first: … JD: …") group the actions, where 2.x used "A. …" sections.
- Progress is defined as the **average % of all actions**.

The team still has 2.x workbooks (backups like v2.4) and wants both to import (`devspec/improve/decisions.md`).

## What it delivers

- **Both layouts import**, detected per file: 2.x (targets) behaves exactly as today; 4.2 (objectives) imports its 6 objectives, 84 actions and 18 objective details.
- **4.2 rules**:
  - The fiscal year comes from the Start month.
  - With no Weight, every objective weighs the same.
  - Deliverable is optional.
  - Actions keep Partners, % (0–100), Reference documents and Note.
  - Each action is linked to its objective detail, and each detail keeps its title, Goal, Needs first and JD refs.
- **Progress = average %** for a file with a `%` column (blank = 0%), for an objective, a detail and the whole year. Files without `%` keep "share of actions Done".
- **Free-text due words** in 4.2 ("Yearly", "Per BOD schedule", "Per BOD review", "Per pilot", "Per course") go through the existing mapping dialog **once** and are remembered. "Monthly" and "Quarterly" are already built in.
- **UI** (approved mockups `objective.html`, `drawer.html`):
  - The word "objective" for 4.2 files.
  - Weight shown as "equal", progress as average %.
  - A new **Objective details** card.
  - Action table columns Partners and %, with a detail chip, references and note on each action.
  - The drawer shows Partners, Progress %, Detail, the detail's Goal / Needs first / JD, Reference documents and the full Note.
- **Template version 4.2** counts as tested (no "newer than tested" warning).

## Scope

**In**:
- `src/shared/` parser (`parse-axc.ts`), model, progress, fiscal and summary.
- The target page, action plan, drawer and wording in `src/client/`.
- The 4.2 fixture plus tests, README import-format docs, and the context pack.

**Out**:
- Editing `%` or notes in the web page (the workbook stays the source of truth).
- The Meeting Log and Job Description sheets.
- Numeric targets (4.2 says they come later).
- A new "on request" due kind (decided: map once).
- DB schema changes: the plan is stored as a JSON document, so the new fields ride inside it.

## Notes

- **No dependency.** `roadline-auth` is blocked only on its BA screenshot sign-off; its code is already in the tree, and this change builds on it (target page header, `UserMenu`).
- **Fixture data:** the 4.2 workbook becomes a test fixture (`tests/fixtures/axc-fy2026-27-v4.2.xlsx`). It holds real internal plan data, like the existing fixtures, so the repository stays internal (`rules.md`).
