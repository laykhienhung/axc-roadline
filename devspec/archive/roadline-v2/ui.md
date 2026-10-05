# UI: roadline-v2

**Mockups**: `mockups/timeline.html` (Month + Board, Quarter + Tasks), `mockups/target.html`, `mockups/import.html` (empty, uploading, rejected, map new values). Rendered from the design canvas reviewed with the user on 2026-09-29 (Roadline UI Redesign). Approved 2026-09-29.
**References**: roadline-v1 screens (`devspec/archive/roadline-v1/ui.md`, `src/client/`). Data in the mockups comes from `tests/fixtures/axc-fy2026-27.xlsx`; statuses are illustrative as of 10 Dec 2026, since the fixture has every action Not started.
**Style source**: this change is a redesign. It **replaces** the `:root` tokens in `src/client/styles.css` with the tokens below and restyles the existing classes. There is no component library; components stay in `src/client/components/`.

Principles kept from v1: read-only view, color = status only (always with a legend), show the file's own status word (`StatusDot` / `StatusLabel` / `StatusBadge`), click a target → its own page.

## Tokens (new `:root` in `styles.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F4F2EC` | page ground (warm neutral) |
| `--surface` | `#FFFFFF` | cards |
| `--surface-2` | `#FAF8F3` | table heads, side tiles, "All year" strip |
| `--line` / `--line-soft` | `#E3DFD4` / `#EFECE5` | borders / inner dividers |
| `--text` / `--text-2` / `--muted` | `#1A1D23` / `#4A4F59` / `#666B74` | ink, secondary, captions (all ≥4.5:1 on white) |
| `--ink` | `#1A1D23` | primary buttons, "NOW" pill |
| `--link` | `#22407F` | "Open target", links |
| `--now` / `--now-line` / `--now-text` | `#FFF4D4` / `#EFD9A0` / `#6B4A00` | current month/quarter tint |
| `--chip` | `#EEEBE3` | target id chips (`T1`), segmented-control track |
| `--r` / `--r-lg` | `10px` / `14px` | control / card radius |

Status tones: each has `dot` (marks), `fg` (text) and `bg` (pill fill); dots also differ in lightness, not hue alone.

| Tone | dot | fg | bg |
|---|---|---|---|
| not_started | `#A3A7AE` | `#50545C` | `#EEEDE8` |
| on_track | `#23895A` | `#1B6B43` | `#E2F1E8` |
| at_risk | `#D08A1C` | `#8A4F00` | `#FBEBD0` |
| behind | `#C0342A` | `#A01E14` | `#FBE3DF` |
| done | `#3A62D0` | `#2A4DB3` | `#E3E9FA` |

Fonts: **system only**, no web fonts. Headings `'Iowan Old Style', 'Palatino Linotype', Georgia, serif`; body `system-ui, 'Segoe UI', sans-serif`; numbers/ids `ui-monospace, 'Cascadia Mono', Consolas, monospace`.

---

## app header (both pages)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ [▪] Roadline │ AI Transformation Team (AXC) · FY2026-27        [Month|Quarter] [⇪ Import workbook] │
│              │ Sep 2026 – Aug 2027 · from <file> · updated <date time>                │
└───────────────────────────────────────────────────────────────────────────────────┘
```
- Logo mark (inline SVG) + "Roadline" wordmark, divider, plan title + meta (as v1).
- Month/Quarter is a segmented control with a sliding white "on" pill; `aria-pressed` stays.
- Target page: the same bar with a breadcrumb `← Timeline / T3 · AI Management` instead of the view switch.
- Components: `AppHeader` (`src/client/components/app-header.tsx`), `ImportButton` (`import-button.tsx`, label "Import workbook" + upload icon).

## timeline (home, route `/`)

```
┌ header ──────────────────────────────────────────────────────────────────────────┐
├ summary: 4 tiles in one row ─────────────────────────────────────────────────────┤
│ Year progress 19%  │ Open this quarter 19 (now tint) │ Overdue 6 (red) │ Targets needing attention 2 [T1 At risk][T3 Behind] │
├ Next actions ────────────────────────────── 29 open · 6 overdue · …  [Board|Tasks] ┤
│ BOARD (default)                                                                   │
│ ┌ ● Behind 3 ─┐ ┌ ● At risk 4 ┐ ┌ ● On track 11 ┐ ┌ ● Not started 11 ┐            │
│ │ T1 #3  Overdue·Nov│ …          │ …             │ …                  │ 460px tall, │
│ │ 1 workflow live   │            │               │                    │ scroll each │
│ │ Developer · Build…│            │               │                    │ column      │
│ └─────────────┘ └────────────┘ └──────────────┘ └──────────────────┘            │
│ TASKS                                                                              │
│ ▸ Overdue 6 · Q1 · was due end of Nov        (sticky group head, red tint)        │
│   ○ T1  1 workflow live #3   Build AI Tools…  Developer  [Behind]   Overdue · Nov │
│ ▸ Due this quarter 19 · Q2 · by end of Feb    (now tint)                          │
│ ▸ All year 4 · Repeating actions                                                   │
├ Timeline ───────────────── hint ─────────────── legend ● Done ● On track … ───────┤
│ (month view) quarter band:  Q1 · Sep – Nov │ Q2 · Dec – Feb · this quarter │ …    │
│ Target        │Sep│Oct│ Nov (wide)     │Dec NOW│Jan│ Feb (wide) │…│ Aug │ Next year │
│ T1 [At risk]  │ — │ — │ ▬▬▬▬▬ bar      │  —    │ — │ ▬▬▬        │ │     │ (dashed)  │
│ Build AI …    │   │   │ 7 topics·4 done│       │   │ 6 topics   │ │     │           │
│ 34% · Dev     │   │   │ [3 overdue]    │       │   │ [1 at risk]│ │     │           │
│ ▬▬ 4 / 26     │   │   │ ● full name…   │       │   │ ● …        │ │     │           │
│ Open target → │   │   │ ● full name…   │       │   │            │ │     │           │
│               ├─ ↻ All year  (Session records · quarterly) (…) ──────────────────┤
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Summary** (`aria-label="Summary"`): 4 tiles.
- Year progress = weight-weighted done share across targets (this year only), with a bar and "Weighted by target · D of N actions done".
- Open this quarter = open actions whose quarter is the current one; now-tinted tile; "Q2 · Dec – Feb".
- Overdue = open actions whose next due date is before today, red number.
- Targets needing attention = count of targets whose tone is At risk or Behind, with a pill per target showing the file's status word.
- No plan period (today outside the fiscal year) → "Open this quarter" shows "—".

**Next actions** (`aria-label="Next actions"`), full width.
- Window: every open action of this year that is overdue, due in the current quarter, or recurring (all year). Next-year actions are excluded (as v1).
- Header right: "N open · N overdue · N due by end of <month> · N all year" + a `[Board|Tasks]` segmented control (`role="group" aria-label="Next actions view"`, `aria-pressed`). Always opens on **Board**; the choice is not remembered.
- **Board**: 4 columns by tone — Behind, At risk, On track, Not started — each with a dot, label, count pill and a fixed-height (460 px) body that scrolls. Card = target chip + `#no` + due text (red + bold when overdue: "Overdue · Nov"; "Due Feb"; "↻ quarterly") / deliverable (bold) / "owner · target name". Order in a column: overdue first, then due-this-quarter, then all-year; ties by target weight (high first), then action number. Each card links to `/target/:id`.
- **Tasks**: one 460 px scroll box with three groups — Overdue, Due this quarter, All year — each with a sticky tinted head (label, count, "Q1 · was due end of Nov" / "Q2 · by end of Feb" / "Repeating actions"). Row = status ring / target chip / deliverable + `#no` / target name / owner / status pill (file word) / due. Order in a group: Behind, At risk, On track, Not started; then weight. Each row links to `/target/:id`.
- Empty window → "Nothing open right now — every action due so far is done." (both views).

**Timeline** (`aria-label="Timeline"`), inside one card with a header (title, view hint, legend).
- Month view: a quarter band row above the month headers (each quarter spans its 3 months; current quarter now-tinted, "· this quarter").
- **Adaptive widths (month view)**: a month with at least one topic in any target gets `minmax(220px, 1fr)`; an empty month gets 60 px (the current month 88 px so its "NOW" pill fits); the Next-year column (when present) gets `minmax(220px, 1fr)`. Quarter view: target column + 4 (or 5 with Next year) equal columns. Target column 260 px.
- **Fluid page**: no fixed 1920 px; the grid fills the card, and when the columns cannot reach their minimums the card scrolls horizontally (the target column stays visible, sticky left).
- Header cell: label, sub (quarter or range), "NOW" pill on the current column; current column cells are lightly tinted.
- **Cell with topics**: a status bar (one segment per tone, width by count, order Done → On track → At risk → Behind → Not started), "N topics · N done", chips "N overdue" (red) and "N at risk" (amber, at-risk topics not already overdue), then **every** topic: dot + full deliverable text (wraps; no ellipsis, no "+N more"), with an "OVERDUE" tag on overdue topics. Empty cell: a faint "—".
- **Target cell** (sticky left, spans the row): id chip + status pill (file word), name, "W% weight · owner", progress bar + "D / N", "Open target →". Whole cell links to `/target/:id`.
- **All year strip**: under each target that has ongoing actions, a dashed-top strip spanning all period columns: "↻ All year" + one pill per ongoing action (dot, deliverable, "· monthly/quarterly").
- **Next-year column** (only when the plan has next-year actions): header "Next year / FY2027-28", cells on `--surface-2` with a dashed left border; the legend adds "Next year = not in this year's progress". Topics listed like other cells.
- Components: `TimelineGrid` (`timeline-grid.tsx`), `StatusLegend` (`status-legend.tsx`), `StatusDot`/`StatusLabel`/`StatusBadge` (`status-dot.tsx`).

States: loading ("Loading plan…" muted line) | load error (error card) | empty (import screen below) | filled (above).

## target detail (route `/target/:id`)

```
┌ header with breadcrumb ← Timeline / T3 · AI Management ─────────────── plan meta ┐
├ Target card ─────────────────────────────────────────────────┬ Next for this target ┤
│ [T3] [Behind]                                                │ #2 [Behind] Overdue·Nov│
│ AI Management  (serif, 44px)                                 │ Allocation standard …  │
│ objective paragraph (max ~760px)                             │ AXC Lead               │
│ [Weight 28%] [Owner …] [Progress 3/18 ▬] [Overdue 2 (red)]    │ (3 cards)              │
├ quarter tiles: Q1 · 3 of 5 done · 2 overdue │ Q2 NOW │ Q3 │ Q4 │ All year │ (Next year) ┤
├ Action plan ─────────────────────────────────────┬ side cards (400px) ─────────────┤
│ Q1  Sep – Nov 2026 · 5 actions                   │ What this must achieve (01…07)  │
│ # │ Action → deliverable │ Success │ Owner │ Due │ Status │ Depends on [T1] [T2] [HR] │
│ Q2  … NOW (tinted head)                          │ Risks & mitigation (tiles)      │
│ Q3 · Q4 · All year · Next year (dashed, "not in this year's progress")  │ How we will do it │
│                                                  │ Change history (or "No changes recorded") │
└──────────────────────────────────────────────────┴─────────────────────────────────┘
```
- Target card (`aria-label="Target"`): id chip + status pill, `h1` name, objective, 4 fact tiles; Overdue tile red when >0.
- Next for this target (`aria-label="Next for this target"`): 3 cards (`li`) from `nextActions(..., { limit: 3, targetId })` — `#no`, status pill, due, deliverable, owner.
- Quarter tiles (`aria-label="Quarters"`): one per quarter plus "All year" (and "Next year" when present); each an in-page link to its group, with a status bar and "D of N done · N overdue"; current quarter now-tinted with "NOW".
- Action plan (`aria-label="Action plan"`): one group per quarter (`data-quarter="Q1"…`, `"ongoing"`, `"next_year"`), each a header row (label, range, count, NOW) + table (# / action with "→ deliverable" underneath / success measure / owner / due / status pill). Done rows' action text muted; overdue due text red + bold "Overdue · Nov". Next-year group: dashed head + "not in this year's progress".
- Side cards (`aria-label="Target details"` wraps them): **always open** — no `<details>`. Order: What this must achieve (numbered 01…), Depends on (chip for `T1`/`T2`/`HR` prefix + text), Risks & mitigation (tile per risk, warning icon), How we will do it, Change history. Empty → "Not recorded" / "No risks recorded" / "No changes recorded".
- Not found: card "Target not found" + link back (as v1).
- Components: `TargetHeader`, `ActionPlan`, `TargetSections` (`src/client/components/`), `StatusBadge`.

## import flow

- **Empty** (`aria-label="No plan loaded"`): centered column, serif heading "No plan loaded yet", intro line, dashed drop zone (file icon, "Drop the workbook here", ".xlsx workbook or flat .csv", `[Choose file…]`), two format cards (.xlsx AXC workbook / .csv flat), note "An import replaces the plan for everyone…". Drag-over: drop zone border turns `--ink`, background `--surface-2`.
- **Uploading** (`aria-label="Importing"`, `aria-busy`): banner card above the current plan: "Uploading & reading <file>", progress bar, "The current plan stays visible until this finishes."
- **Rejected** (`role="alert"`, `aria-label="Import failed"`): red-tinted head (icon, "Couldn't import <file>", "N problems in the file's layout. Nothing was replaced — everyone still sees the import from <date>." or "Nothing was imported."), dismiss ×; problems as a table Sheet / Row / Problem; footer "Fix these rows in the workbook, save it, and import again." + `[Keep current plan]` (dismiss) + `[Choose another file]`.
- **Map new values** (`role="dialog"`, `aria-label="Map new values"`): heading "This file uses N words Roadline doesn't know yet", one row per word grouped by Status / Quarter / Due — word, count + where, labelled `select` "Means · suggested" (suggestion pre-selected), preview (status pill in the chosen tone, or a one-line note for next-year / quarter-end). Footer: saved-for-everyone note + `[Cancel]` `[Apply & import]` (spinner "Importing…" while applying).
- Import notes after success (`aria-label="Import notes"`): unchanged content, restyled as tinted dismissable lines.
- Components: `EmptyState`, `UploadingState`, `ImportError`, `ProblemList` (`import-states.tsx`), `ImportMappingDialog` (`import-mapping-dialog.tsx`), `ImportNotes` (`import-notes.tsx`), `ImportButton`.
