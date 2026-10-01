# UI: roadline-v1

**Mockups**: `mockups/timeline.html`, `mockups/target.html` (approved 2026-09-28, revised for template v2.1 and approved 2026-09-29), `mockups/import-mapping.html` (approved 2026-09-29)
**References**: the running app (`src/client/`) and the import-error screenshot the user shared on 2026-09-29. Data from `[AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027.xlsx` (template v2.0) and `… (1).xlsx` (template v2.1).
**Style source**: `src/client/styles.css` — tokens on `:root` (`--bg`, `--surface`, `--line`, `--text`, `--muted`, `--accent`, `--now`, `--now-line`, `--s-not_started|on_track|at_risk|behind|done`, `--r`) and component classes (`.card`, `.btn`, `.btn.primary`, `.seg`, `.dot` + `.bg-<tone>`, `.fg-<tone>`, `.badge`, `.legend`, `.grid`, `.hd`, `.cell`, `.topic`, `.state.err`). Revision 2 adds one token, `--next: #f3f4f8` (Next-year background).
**Components**: existing components in `src/client/components/` are reused and extended (named per section below). No external component library.

Principles agreed: keep it simple — no drawer, no filters, no per-action bars. Click a target → separate detail page. Color = status only, always with a visible legend. Read-only view; anyone with the link sees the same data.

---

## timeline (home, route `/`)

Layout:
```
┌ Header ─────────────────────────────────────────────────────────────┐
│ AXC Action Plan · FY2026-27                     [Month|Quarter] [Import…]
│ Sep 2026 – Aug 2027 · data from <file> · updated <date time>        │
├ Next actions ───────────────────────────────────────────────────────┤
│ ● T3  Monthly usage & cost report      On track     ↻ due 30 Sep    │  top 5
│ ● T1  Process inventory + needs survey On track       due Nov       │
├ Legend: Status ● Not started ● On track ● At risk ● Behind ● Done ──┤
│ ┌ Target ────────┬ Sep (now) ┬ Oct ┬ Nov ──────────┬ … ┬ Aug ┐       │
│ │● T1 · Build AI │    —      │  —  │ 7 topics      │   │     │       │
│ │ On track · 34% │           │     │ ● Process inv │   │     │       │
│ │ 0/26 done      │           │     │ ● Backlog     │   │     │       │
│ │ View detail →  │           │     │               │   │     │       │
│ └────────────────┴───────────┴─────┴───────────────┴───┴─────┘       │
└─────────────────────────────────────────────────────────────────────┘
```
- **Header** (`AppHeader`): plan title, fiscal period, source file name + last import time. View toggle **Month (default)** | Quarter. `Import…` primary button.
- **Next actions** (`NextActions`): one list, top 5. Row = status dot · target id · action text (full action, not the deliverable — deliverables like "12 monthly reports" read poorly out of context) · status label · due text (`↻ due 30 Sep` for recurring, `due Nov` otherwise). Subtitle: `Q<n> · <count> open this quarter`. Row click → that target's detail page.
- **Status legend** (`StatusLegend`): above grid, 5 statuses + note "colored cell edge = has an At risk / Behind topic".
- **Timeline grid** (`TimelineGrid`):
  - Columns: first column "Target" (220px), then 12 months Sep→Aug (Month view, header sub-label Q1..Q4) or 4 quarters with date ranges (Quarter view). Current month/quarter column highlighted (`--now`) with "now" sub-label.
  - Rows: one per target (T1..Tn, in sheet order).
  - Target cell (`TargetCell`): status dot + `T1 · <name>`; line 2 `<status label> · <weight>% · <owner>`; line 3 `<done>/<total> done` + `↻ n ongoing` when any; link text `View detail →`.
  - Period cell (`PeriodCell`): `<n> topics` count + list of topics (deliverable short name), each with status dot. Empty → `—`. Month view places a topic at its **due month**; Quarter view at its quarter. Ongoing actions are not placed in cells (counted on target cell only).
  - Cell containing any Behind topic → 3px red left edge; else any At risk → 3px amber left edge.
  - Whole target cell and every period cell are links → `/target/<id>`.

States (stacked in mockup):
- **filled** — above.
- **empty** (nothing imported yet): card "No plan loaded", drop zone "Drop .xlsx / .csv here" + `Choose file…`, note "The imported plan is shown to everyone with the link."
- **loading** (importing): "Uploading & reading <file>", progress bar, "Current plan stays visible until done".
- **error** (file doesn't match template): "Couldn't import this file" + list of per-sheet/per-row problems (e.g. `T2 — action table not found`, `T3 row 27 — due "Q5 2027" is not a month`), "Nothing replaced — still showing the import from <date>", `Choose another file`.

Interactions:
- Month/Quarter toggle re-renders grid; Month is default on load.
- `Import…` → file picker (.xlsx, .csv) → upload → server validates → success replaces plan for everyone; failure shows error state, keeps previous plan.
- Click target / cell / next-action row → navigate to `/target/<id>`.

## target (detail page, route `/target/:id`)

Layout:
```
┌ ← Back to timeline                         AXC Action Plan · FY2026-27 ┐
├ ● T1 · Build AI Tools & Automation ────────────────────────────────────┤
│ Weight 34% │ Owner Developer │ Status On track │ Progress 1/26 ▓░░░     │
│ <objective paragraph>                                                   │
├ Next for this target ──────────────────────────────────────────────────┤
│ 1. Process inventory + needs survey — Developer · due Nov 2026         │  top 3
├ Action plan  [legend badges] ──────────────────────────────────────────┤
│ Q1  Sep – Nov 2026 · 7 actions  (now)                                  │
│  # │ Action → deliverable │ Success measure │ Owner │ Due │ [Status]   │
│ Q2 … Q3 … Q4 …                                                          │
├ ▸ What this must achieve (open) ▸ How we will do it ▸ Depends on       │
│ ▸ Risks ▸ Change history                                               │
└────────────────────────────────────────────────────────────────────────┘
```
- **Back link** → `/` (timeline).
- **Header card** (`TargetHeader`): status dot + `<id> · <name>`; facts row Weight / Owner / Status (colored) / Progress `<done>/<total> done` + bar; objective paragraph.
- **Next for this target** (`NextActions` scoped to target): ordered list, top 3: `<deliverable> — <owner> · due <due>`.
- **Action plan** (`ActionPlan`): status legend badges under heading; one block per quarter `Q<n> <date range> · <n> actions`, current quarter tagged `now`; table columns `# | Action (+ "→ deliverable" sub-line) | Success measure | Owner | Due | Status`. Status = filled color badge. At risk / Behind rows get colored left edge. Empty measure → `—`. Ongoing actions listed in their section with Due `monthly`/`quarterly`.
- **Details** (`TargetSections`): collapsible `<details>` — What this must achieve (open by default), How we will do it, Depends on, Risks, Change history ("No changes recorded" when empty).

States:
- **filled** — above.
- **not found**: "Target not found — "T5" isn't in the current import. Back to timeline".

Interactions: back link; expand/collapse sections. No editing (read-only).

---

## Revision 2 — adaptive import (template v2.1)

Agreed 2026-09-29: a file whose **layout** can't be read still shows the error panel; a file with **new words** opens a mapping dialog; mappings are saved and applied to later imports automatically.

### Status words and tones (all screens)
- A status has a **word** (from the file, e.g. "In progress") and a **tone** (one of 5: Not started / On track / At risk / Behind / Done). Color always comes from the tone; the text shown is always the file's own word.
- Built-in words map to their own tone. Other words map through saved mappings.

### import-mapping dialog (`mockups/import-mapping.html`) — new `ImportMappingDialog`
```
┌ New values in "<file name>" ──────────────────────────────────────────┐
│ This file uses words Roadline doesn't know yet. Choose what each means │
│ STATUS   Word │ Found (n actions + rows) │ Means [select] suggested │ Shown as ● word │
│ QUARTER  Word │ Found (n actions, per target) │ Means [Q1–Q4/Ongoing/Next year] │ note │
│ DUE      (only for words on rows whose quarter is not Next year) [Next year / End of its quarter] │
│ ⓘ Due "Next year" on these rows follows the quarter — nothing to choose │
├──────────────────────────────────────────────────────────────────────┤
│ Saved for everyone … edit data/mappings.json      [Cancel] [Apply & import] │
└──────────────────────────────────────────────────────────────────────┘
```
- Modal over the timeline (scrim), 760px wide, `.card`-style surface, header / scrolling body / footer.
- One group per field that has new words: Status, Quarter, Due. Each row: word, where it was found (count + sheet rows, or "listed in the file's Status dropdown" when it appears only in the file's dropdown list), a `<select>` pre-filled with the suggestion and labelled "suggested", and for status a live preview (`.dot` + word in the chosen tone color).
- Buttons reuse `.btn` / `.btn.primary`.
- States: **filled** (above) · **applying** (both buttons disabled, primary shows spinner "Importing…") · **cancelled** (dialog closes, nothing imported or saved, note under header "Import cancelled — <file> was not imported.") · **layout broken** → no dialog, existing error panel (`ImportError`) with the note "Mapping is only offered once the layout can be read."

### timeline changes (`mockups/timeline.html`)
- **Import notes** (`ImportNotes`, new) under the header, each dismissable (×):
  - info (grey, ⓘ): "Applied saved mappings: <word> → <meaning> · …" — shown after an import that used saved mappings.
  - warning (amber, ⚠): "Template version <v> is newer than tested <tested>. Shown once for this version." — only on the first import of that version.
- **Next year column**: after Aug (month view) or Q4 (quarter view), header "Next year" / sub-label "FY27-28" (the next fiscal year). Background `--next`, 2px dashed left border. Lists next-year topics like any cell. Hidden when no action is next-year.
- **Target cell**: progress counts **this year only** (`2 / 12 done`) and adds `· n next year` when any.
- **Legend** (`StatusLegend`): grouped by tone; after each tone label, the file words mapped to it that appear in the plan, e.g. "● On track (In progress)". Note text adds "┆ Next year = not in this year's progress".
- **Next actions**: never lists next-year actions; subtitle adds "· n moved to next year". Rows show the file's word (e.g. "In progress") in the tone color. Behind-tone actions (incl. "Blocked") rank first together with overdue ones.
- States: built-in words only → no notes; same file re-imported → only the info line; no next-year actions → no Next-year column.

### target changes (`mockups/target.html`)
- **Progress**: `<done> / <this-year total> done`, bar, and sub-line "this year · n more next year" when any.
- **Badge legend**: grouped like the timeline legend ("On track (In progress)").
- **Status badges**: file's own word, tone color.
- **Next year block** after Q4: "Next year · FY27-28 · n actions" + tag "not in this year's progress" + hint "Mapped from quarter "FY27-28"."; same table; `--next` background, dashed border. Hidden when none.
- **Next for this target**: excludes next-year actions.

## Verify hooks (for capture's tasks.md)
- `Verify: /devspec-verify roadline-v1` — timeline: header, Month default active, 12 month columns + Q labels, 4 target rows, status legend present, cells show status dots, flagged-cell edge color computed (not default), Quarter toggle → 4 columns; click target → `/target/T1` renders header/next/action plan/details; back link returns; empty + error states render on bad import.
- Revision 2: import the v2.1 fixture → mapping dialog lists In progress / Blocked / FY27-28 with suggestions; apply → timeline shows 13 columns (Next year last), T1 `2 / 12 done · 7 next year`, legend "On track (In progress)", info + version notes; re-import → no dialog, info note only; `/target/T1` shows the Next year block (7 rows).
- `Verify: MANUAL: BA approves screenshot` — with matching `- [ ] MANUAL: BA approves screenshot` subtask.
