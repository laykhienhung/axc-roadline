# Proposal: roadline-v2

## Why

Roadline v1 works, but its screens are plain and hard to scan. The month timeline squeezes topics into narrow equal columns, Next actions shows only the top 5 with no sense of how much is open or late, and the target page hides most of its notes behind collapsed sections. The team wants one screen that summarises the whole plan at a glance and a clearer view per target.

## What it delivers

A redesign of every screen, following the design canvas reviewed on 2026-09-29 (`ui.md`, `mockups/`):

- **New look** — a new token set in `styles.css` (warm neutral ground, ink accents, status tones with text/fill/dot variants) and **system fonts only**.
- **Header** — logo mark, plan meta, segmented Month/Quarter, "Import workbook".
- **Summary** — four tiles: weighted year progress, open this quarter, overdue, targets needing attention.
- **Next actions** — replaces the top-5 list with a **Board** (default; columns Behind / At risk / On track / Not started) and a **Tasks** view (grouped Overdue / Due this quarter / All year). Both show every open action that is overdue, due this quarter, or recurring. The choice is not remembered.
- **Timeline** — per-cell status bar, overdue / at-risk chips, full topic text (no truncation), an "All year" strip per target, adaptive month widths (empty months narrow), fluid layout with horizontal scroll when narrow; Next-year column kept.
- **Target page** — header with fact tiles, quarter tiles, action plan beside always-open cards (must achieve, depends on, risks, how, change history); Next-year group kept.
- **Import** — restyled empty, uploading, rejected and map-new-values screens (same behaviour).

## Scope

**In**: client UI (`src/client/`), new pure derived-data functions in `src/shared/` for the summary and the Next-actions window, and updating the UI tests that assert the old layout.

**Out**:
- No server, API, parser, storage or mapping changes.
- No editing of actions (still read-only; cards and rows only link to the target page).
- No web fonts, no component library, no new dependencies.
- No remembered Board/Tasks preference, no filters, no drag and drop.
- No mobile-specific layout beyond the fluid timeline (desktop first, as v1).

## Notes

- Local, uncommitted `styles.css` padding tweaks were reverted on 2026-09-29; this change sets the new spacing. The unrelated `vite.config.ts` ngrok `allowedHosts` edit is left as is.
- Depends on nothing pending; `roadline-v1` is done.
